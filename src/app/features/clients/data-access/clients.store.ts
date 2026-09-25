import { HttpClient } from '@angular/common/http';
import { effect, inject } from '@angular/core';
import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import {
  addEntity,
  removeAllEntities,
  removeEntity,
  setAllEntities,
  updateEntity,
  upsertEntity,
  withEntities,
} from '@ngrx/signals/entities';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { components } from '../../../core/api-types';
import { AuthSessionStore } from '../../../core/auth/auth-session.store';

type Client = components['schemas']['Client'] & { id: string };
type ClientInput = components['schemas']['ClientInput'];
type Pagination = components['schemas']['Pagination'];

interface ClientsState {
  loading: boolean;
  error: string | null;
  search: string;
  page: number;
  lastPage: number;
  total: number;
}

/**
 * Read model + comandos da feature de clientes — equivalente do front ao par
 * Projector/Application do módulo Clients no backend (ver docs/architecture.md da API).
 */
export const ClientsStore = signalStore(
  { providedIn: 'root' },
  withEntities<Client>(),
  withState<ClientsState>({
    loading: false,
    error: null,
    search: '',
    page: 1,
    lastPage: 1,
    total: 0,
  }),
  withMethods((store, http = inject(HttpClient)) => ({
    async load(page = 1, search = ''): Promise<void> {
      patchState(store, { loading: true, error: null });

      try {
        const response = await firstValueFrom(
          http.get<Pagination & { data: Client[] }>(`${environment.apiUrl}/clients`, {
            params: { page, ...(search ? { search } : {}) },
          }),
        );

        patchState(
          store,
          setAllEntities(response.data ?? []),
          {
            loading: false,
            search,
            page: response.meta?.current_page ?? 1,
            lastPage: response.meta?.last_page ?? 1,
            total: response.meta?.total ?? 0,
          },
        );
      } catch {
        patchState(store, { loading: false, error: 'Não foi possível carregar os clientes.' });
      }
    },

    async create(input: ClientInput): Promise<Client> {
      const response = await firstValueFrom(
        http.post<{ data: Client }>(`${environment.apiUrl}/clients`, input),
      );

      patchState(store, addEntity(response.data));

      return response.data;
    },

    async update(id: string, input: ClientInput): Promise<Client> {
      const response = await firstValueFrom(
        http.put<{ data: Client }>(`${environment.apiUrl}/clients/${id}`, input),
      );

      patchState(store, updateEntity({ id, changes: response.data }));

      return response.data;
    },

    async remove(id: string): Promise<void> {
      await firstValueFrom(http.delete<void>(`${environment.apiUrl}/clients/${id}`));

      patchState(store, removeEntity(id));
    },

    async findOne(id: string): Promise<Client> {
      const response = await firstValueFrom(
        http.get<{ data: Client }>(`${environment.apiUrl}/clients/${id}`),
      );

      // upsertEntity (não addEntity): addEntity não faz nada se o id já estiver no store, o que
      // deixaria um dado desatualizado quando o cliente já apareceu antes numa listagem. Mesmo
      // padrão em EquipmentsStore.findOne/OrdersStore.findOne.
      patchState(store, upsertEntity(response.data));

      return response.data;
    },

    /** Ver EquipmentsStore.reset() — chamado do logout. */
    reset(): void {
      patchState(store, removeAllEntities(), {
        loading: false,
        error: null,
        search: '',
        page: 1,
        lastPage: 1,
        total: 0,
      });
    },
  })),
  // `core/` não conhece nenhuma feature (ver README) — a dependência tem que ir nesta direção
  // (a feature injeta o AuthSessionStore de core/, nunca o contrário). reset() dispara sempre
  // que a sessão deixa de estar autenticada, incluindo o próprio carregamento inicial do app
  // (sem sessão ainda) — inofensivo, já que resetar uma lista vazia não faz nada.
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
