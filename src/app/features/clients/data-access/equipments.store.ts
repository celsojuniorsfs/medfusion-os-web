import { HttpClient } from '@angular/common/http';
import { effect, inject } from '@angular/core';
import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import {
  addEntity,
  removeAllEntities,
  removeEntity,
  setAllEntities,
  updateEntity,
  withEntities,
} from '@ngrx/signals/entities';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { components } from '../../../core/api-types';
import { AuthSessionStore } from '../../../core/auth/auth-session.store';

type Equipment = components['schemas']['Equipment'] & { id: string };
type EquipmentInput = components['schemas']['EquipmentInput'];

interface EquipmentsState {
  loading: boolean;
  error: string | null;
}

/**
 * Catálogo de equipamentos de UM cliente por vez — ao contrário de ClientsStore, a API não pagina
 * nem busca no servidor (GET /clients/{id}/equipments devolve a lista inteira, ver openapi.yaml),
 * então não há search/page/lastPage/total aqui: filtro é client-side (equipments.ts) sobre
 * store.entities(). Fica em features/clients/ (não numa feature própria) porque é um sub-recurso
 * do cliente — a issue da OS vai importar este store pra montar o seletor de equipamentos, o mesmo
 * jeito sancionado de reuso entre features ("uma feature nunca importa data-access de outra, só o
 * store dela", ver README).
 */
export const EquipmentsStore = signalStore(
  { providedIn: 'root' },
  withEntities<Equipment>(),
  withState<EquipmentsState>({
    loading: false,
    error: null,
  }),
  withMethods((store, http = inject(HttpClient)) => ({
    async load(clientId: string): Promise<void> {
      patchState(store, { loading: true, error: null });

      try {
        const response = await firstValueFrom(
          http.get<{ data: Equipment[] }>(`${environment.apiUrl}/clients/${clientId}/equipments`),
        );

        patchState(store, setAllEntities(response.data ?? []), { loading: false });
      } catch {
        patchState(store, { loading: false, error: 'Não foi possível carregar os equipamentos.' });
      }
    },

    async create(clientId: string, input: EquipmentInput): Promise<Equipment> {
      const response = await firstValueFrom(
        http.post<{ data: Equipment }>(`${environment.apiUrl}/clients/${clientId}/equipments`, input),
      );

      patchState(store, addEntity(response.data));

      return response.data;
    },

    async update(clientId: string, id: string, input: EquipmentInput): Promise<Equipment> {
      const response = await firstValueFrom(
        http.put<{ data: Equipment }>(`${environment.apiUrl}/clients/${clientId}/equipments/${id}`, input),
      );

      patchState(store, updateEntity({ id, changes: response.data }));

      return response.data;
    },

    async remove(clientId: string, id: string): Promise<void> {
      await firstValueFrom(http.delete<void>(`${environment.apiUrl}/clients/${clientId}/equipments/${id}`));

      patchState(store, removeEntity(id));
    },

    /**
     * Achado do code review de 13/09/2026: AuthSessionStore.clearSession() não limpava este
     * store — como ele é `providedIn: 'root'`, o catálogo do último cliente visto continuava em
     * memória depois do logout. Sem chance real de vazamento entre usuários diferentes (todo
     * técnico autenticado já enxerga os mesmos dados, sem escopo por usuário — ver
     * api-conventions.md), mas um segundo técnico no mesmo aparelho podia ver, por um instante,
     * o catálogo do cliente que o anterior deixou carregado antes do load() novo terminar.
     */
    reset(): void {
      patchState(store, removeAllEntities(), { loading: false, error: null });
    },
  })),
  // Ver o mesmo bloco em clients.store.ts — core/ não conhece nenhuma feature (README), então a
  // dependência vai nesta direção (a feature injeta o AuthSessionStore de core/).
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
