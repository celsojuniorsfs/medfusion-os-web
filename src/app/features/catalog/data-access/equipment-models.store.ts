import { HttpClient } from '@angular/common/http';
import { effect, inject } from '@angular/core';
import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import { removeAllEntities, removeEntity, setAllEntities, upsertEntities, withEntities } from '@ngrx/signals/entities';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthSessionStore } from '../../../core/auth/auth-session.store';
import { EquipmentModel } from './equipment-models';

interface EquipmentModelsState {
  loading: boolean;
  error: string | null;
}

/**
 * Catálogo GLOBAL de modelos de equipamento (api#101/#109/#112) — mesmo molde de
 * AccessoriesStore: sem clientId (GET /equipment-models devolve o catálogo inteiro,
 * compartilhado entre todos os clientes).
 *
 * `create()`/`update()`/`remove()` são a única forma de o catálogo mudar desde o api#112 — o
 * cadastro de equipamento do cliente deixou de aceitar texto livre (era o `upsertFromEquipment`
 * antigo, que reagia ao efeito colateral de salvar um equipamento; sem efeito colateral, não há
 * mais nada pra sincronizar de lá).
 *
 * `update()`/`remove()` não engolem erro — deixam propagar (mesmo padrão de
 * `EquipmentsStore.remove()`), pra quem chama poder distinguir um 409 (entrada em uso) de
 * qualquer outra falha e mostrar a mensagem certa.
 */
export const EquipmentModelsStore = signalStore(
  { providedIn: 'root' },
  withEntities<EquipmentModel>(),
  withState<EquipmentModelsState>({
    loading: false,
    error: null,
  }),
  withMethods((store, http = inject(HttpClient)) => ({
    async load(): Promise<void> {
      patchState(store, { loading: true, error: null });

      try {
        const response = await firstValueFrom(
          http.get<{ data: EquipmentModel[] }>(`${environment.apiUrl}/equipment-models`),
        );

        patchState(store, setAllEntities(response.data ?? []), { loading: false });
      } catch {
        patchState(store, { loading: false, error: 'Não foi possível carregar o catálogo de modelos.' });
      }
    },

    async create(input: { name: string; brand: string; model: string }): Promise<EquipmentModel> {
      const response = await firstValueFrom(
        http.post<{ data: EquipmentModel }>(`${environment.apiUrl}/equipment-models`, input),
      );

      patchState(store, upsertEntities([response.data]));

      return response.data;
    },

    async update(id: string, input: { name: string; brand: string; model: string }): Promise<EquipmentModel> {
      const response = await firstValueFrom(
        http.put<{ data: EquipmentModel }>(`${environment.apiUrl}/equipment-models/${id}`, input),
      );

      patchState(store, upsertEntities([response.data]));

      return response.data;
    },

    async remove(id: string): Promise<void> {
      await firstValueFrom(http.delete<void>(`${environment.apiUrl}/equipment-models/${id}`));

      patchState(store, removeEntity(id));
    },

    reset(): void {
      patchState(store, removeAllEntities(), { loading: false, error: null });
    },
  })),
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
