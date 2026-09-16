import { HttpClient } from '@angular/common/http';
import { effect, inject } from '@angular/core';
import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import { removeAllEntities, setAllEntities, upsertEntities, withEntities } from '@ngrx/signals/entities';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthSessionStore } from '../../../core/auth/auth-session.store';
import { EquipmentModel } from './equipment-models';

interface EquipmentModelsState {
  loading: boolean;
  error: string | null;
}

/**
 * Catálogo GLOBAL de modelos de equipamento (api#101) — mesmo molde de AccessoriesStore: sem
 * clientId (GET /equipment-models devolve o catálogo inteiro, compartilhado entre todos os
 * clientes) e sem `create()`. Um modelo novo digitado no formulário não passa por aqui: vai junto
 * no payload do equipamento e a API resolve/cadastra (ver EquipmentController::resolveEquipmentModel).
 * `upsertFromEquipment()` injeta o resultado aqui depois, reaproveitável na mesma sessão sem
 * recarregar o catálogo inteiro.
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

    /** `upsertEntities` e não `addEntity` pelo mesmo motivo de AccessoriesStore: o modelo que volta
     * de um equipamento salvo pode já existir no catálogo local (a API reaproveita a entrada quando
     * o trio bate), e `addEntity` reclamaria de id duplicado. */
    upsertFromEquipment(equipmentModels: EquipmentModel[]): void {
      patchState(store, upsertEntities(equipmentModels));
    },

    // Mesmo achado do code review de 13/09/2026: store `providedIn: 'root'` sobreviveria ao logout
    // sem isso.
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
