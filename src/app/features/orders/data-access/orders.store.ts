import { HttpClient } from '@angular/common/http';
import { effect, inject } from '@angular/core';
import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import { addEntity, removeAllEntities, withEntities } from '@ngrx/signals/entities';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { components } from '../../../core/api-types';
import { AuthSessionStore } from '../../../core/auth/auth-session.store';

type Order = components['schemas']['Order'] & { id: string };
type OrderInput = components['schemas']['OrderInput'];

/**
 * Read model + comandos da feature de Ordens de Serviço — equivalente do front ao par
 * Projector/Application do módulo Orders no backend (ver docs/architecture.md da API).
 */
export const OrdersStore = signalStore(
  { providedIn: 'root' },
  withEntities<Order>(),
  withState({ loading: false, error: null as string | null }),
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

    /** Ver EquipmentsStore.reset()/ClientsStore.reset() — mesmo achado do code review de 13/09/2026. */
    reset(): void {
      patchState(store, removeAllEntities(), { loading: false, error: null });
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
