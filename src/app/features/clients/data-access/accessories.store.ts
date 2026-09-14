import { HttpClient } from '@angular/common/http';
import { effect, inject } from '@angular/core';
import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import { removeAllEntities, setAllEntities, upsertEntities, withEntities } from '@ngrx/signals/entities';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthSessionStore } from '../../../core/auth/auth-session.store';
import { Accessory } from './accessories';

interface AccessoriesState {
  loading: boolean;
  error: string | null;
}

/**
 * Catálogo GLOBAL de acessórios (api#92) — ao contrário de EquipmentsStore (por cliente), aqui
 * não tem clientId: GET /accessories devolve o catálogo inteiro, compartilhado entre todos os
 * clientes (mesmo raciocínio "peça de carro que se repete entre equipamentos" da issue). Sem
 * create(): um acessório novo digitado no seletor do formulário de equipamento não passa por
 * aqui — vai junto no payload do equipamento (POST/PUT /clients/{id}/equipments) como
 * `{ name, quantity }`, e a API resolve/cadastra no catálogo. `upsertFromEquipment()` injeta o
 * resultado aqui depois (accessory_id definitivo, inclusive dos que já existiam), reaproveitável
 * na mesma sessão sem precisar recarregar o catálogo inteiro.
 */
export const AccessoriesStore = signalStore(
  { providedIn: 'root' },
  withEntities<Accessory>(),
  withState<AccessoriesState>({
    loading: false,
    error: null,
  }),
  withMethods((store, http = inject(HttpClient)) => ({
    async load(): Promise<void> {
      patchState(store, { loading: true, error: null });

      try {
        const response = await firstValueFrom(http.get<{ data: Accessory[] }>(`${environment.apiUrl}/accessories`));

        patchState(store, setAllEntities(response.data ?? []), { loading: false });
      } catch {
        patchState(store, { loading: false, error: 'Não foi possível carregar o catálogo de acessórios.' });
      }
    },

    /**
     * `upsertEntities` (não `addEntity`) de propósito: os acessórios que voltam junto da
     * resposta de um equipamento salvo podem já existir no catálogo local (reaproveitados por
     * accessory_id) — `addEntity` reclamaria de id duplicado.
     */
    upsertFromEquipment(accessories: Accessory[]): void {
      patchState(store, upsertEntities(accessories));
    },

    // Mesmo achado do code review de 13/09/2026 em EquipmentsStore/ClientsStore — este store
    // também é `providedIn: 'root'`, então o catálogo carregado sobreviveria a um logout sem
    // isso.
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
