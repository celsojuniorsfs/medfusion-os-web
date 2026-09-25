import { HttpClient } from '@angular/common/http';
import { effect, inject } from '@angular/core';
import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import { addEntity, removeAllEntities, setAllEntities, withEntities } from '@ngrx/signals/entities';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { components } from '../../../core/api-types';
import { AuthSessionStore } from '../../../core/auth/auth-session.store';

type Order = components['schemas']['Order'] & { id: string };
type OrderInput = components['schemas']['OrderInput'];
type OrderStatus = components['schemas']['OrderStatus'];
type Pagination = components['schemas']['Pagination'];

export interface OrdersFilters {
  client_id?: string;
  status?: OrderStatus;
  date_from?: string;
  date_to?: string;
}

interface OrdersState {
  loading: boolean;
  error: string | null;
  page: number;
  lastPage: number;
  total: number;
  filters: OrdersFilters;
}

/**
 * Read model + comandos da feature de Ordens de Serviço — equivalente do front ao par
 * Projector/Application do módulo Orders no backend (ver docs/architecture.md da API).
 */
export const OrdersStore = signalStore(
  { providedIn: 'root' },
  withEntities<Order>(),
  withState<OrdersState>({
    loading: false,
    error: null,
    page: 1,
    lastPage: 1,
    total: 0,
    filters: {},
  }),
  withMethods((store, http = inject(HttpClient)) => ({
    /**
     * GET /orders/next-number — só uma sugestão de UI, o valor não é reservado (ver
     * api-conventions.md § Concorrência na numeração da OS). Resposta sem o envelope { data }
     * de sempre: não é um recurso, é `{ number: 1337 }`.
     */
    async nextNumber(): Promise<number> {
      const response = await firstValueFrom(http.get<{ number: number }>(`${environment.apiUrl}/orders/next-number`));

      return response.number;
    },

    // Erro (409 de número duplicado, 422 de validação) sobe pra quem chamou tratar — mesmo
    // padrão de EquipmentsStore.create, a página decide a mensagem certa pra cada status.
    async create(input: OrderInput): Promise<Order> {
      const response = await firstValueFrom(http.post<{ data: Order }>(`${environment.apiUrl}/orders`, input));

      patchState(store, addEntity(response.data));

      return response.data;
    },

    /**
     * GET /orders — sempre ordenado por data desc (decisão do backend, sem parâmetro de
     * ordenação). Mesmo padrão de paginação de `ClientsStore.load` — só entra no `params` o
     * filtro que tiver valor, pra não mandar `client_id=` vazio pra API.
     */
    async load(page = 1, filters: OrdersFilters = {}): Promise<void> {
      patchState(store, { loading: true, error: null });

      try {
        const params: Record<string, string | number> = { page };
        if (filters.client_id) params['client_id'] = filters.client_id;
        if (filters.status) params['status'] = filters.status;
        if (filters.date_from) params['date_from'] = filters.date_from;
        if (filters.date_to) params['date_to'] = filters.date_to;

        const response = await firstValueFrom(
          http.get<Pagination & { data: Order[] }>(`${environment.apiUrl}/orders`, { params }),
        );

        patchState(store, setAllEntities(response.data ?? []), {
          loading: false,
          filters,
          page: response.meta?.current_page ?? 1,
          lastPage: response.meta?.last_page ?? 1,
          total: response.meta?.total ?? 0,
        });
      } catch {
        patchState(store, { loading: false, error: 'Não foi possível carregar as ordens de serviço.' });
      }
    },

    async findOne(id: string): Promise<Order> {
      const response = await firstValueFrom(http.get<{ data: Order }>(`${environment.apiUrl}/orders/${id}`));

      patchState(store, addEntity(response.data));

      return response.data;
    },

    /** Ver EquipmentsStore.reset()/ClientsStore.reset() — mesmo achado do code review de 13/09/2026. */
    reset(): void {
      patchState(store, removeAllEntities(), { loading: false, error: null, page: 1, lastPage: 1, total: 0, filters: {} });
    },
  })),
  // `core/` não conhece nenhuma feature (ver README) — a feature injeta o AuthSessionStore de
  // core/, nunca o contrário.
  withHooks((store) => {
    const auth = inject(AuthSessionStore);

    return {
      onInit() {
        effect(() => {
          if (!auth.isAuthenticated()) {
            store.reset();
          }
        });
      },
    };
  }),
);
