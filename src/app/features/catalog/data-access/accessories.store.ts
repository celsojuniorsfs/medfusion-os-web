import { HttpClient } from '@angular/common/http';
import { effect, inject } from '@angular/core';
import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import { removeAllEntities, removeEntity, setAllEntities, upsertEntities, withEntities } from '@ngrx/signals/entities';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthSessionStore } from '../../../core/auth/auth-session.store';
import { Accessory } from './accessories';

interface AccessoriesState {
  loading: boolean;
  error: string | null;
}

/**
 * Catálogo GLOBAL de acessórios (api#92/#111) — ao contrário de EquipmentsStore (por cliente),
 * aqui não tem clientId: GET /accessories devolve o catálogo inteiro, compartilhado entre todos
 * os clientes (mesmo raciocínio "peça de carro que se repete entre equipamentos" da issue).
 *
 * Ao contrário do catálogo de modelos (api#112), o formulário de equipamento continua podendo
 * cadastrar um acessório novo digitando o nome — `upsertFromEquipment()` injeta o resultado aqui
 * depois (accessory_id definitivo, inclusive dos que já existiam), reaproveitável na mesma sessão
 * sem precisar recarregar o catálogo inteiro.
 *
 * `update()`/`remove()` são a tela de manutenção do catálogo (a #109/#111) — não engolem erro,
 * deixam propagar (mesmo padrão de `EquipmentsStore.remove()`), pra quem chama poder distinguir um
 * 409 (acessório em uso) de qualquer outra falha e mostrar a mensagem certa.
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

    async create(name: string): Promise<Accessory> {
      const response = await firstValueFrom(
        http.post<{ data: Accessory }>(`${environment.apiUrl}/accessories`, { name }),
      );

      patchState(store, upsertEntities([response.data]));

      return response.data;
    },

    async update(id: string, name: string): Promise<Accessory> {
      const response = await firstValueFrom(
        http.put<{ data: Accessory }>(`${environment.apiUrl}/accessories/${id}`, { name }),
      );

      patchState(store, upsertEntities([response.data]));

      return response.data;
    },

    async remove(id: string): Promise<void> {
      await firstValueFrom(http.delete<void>(`${environment.apiUrl}/accessories/${id}`));

      patchState(store, removeEntity(id));
    },

    /**
     * `upsertEntities` (não `addEntity`) de propósito: os acessórios que voltam junto da
     * resposta de um equipamento salvo podem já existir no catálogo local (reaproveitados por
     * accessory_id) — `addEntity` reclamaria de id duplicado.
     */
    upsertFromEquipment(accessories: Accessory[]): void {
      patchState(store, upsertEntities(accessories));
    },

    // `providedIn: 'root'`, então o catálogo carregado sobreviveria a um logout sem isso — mesmo
    // motivo de EquipmentsStore.reset()/ClientsStore.reset().
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
