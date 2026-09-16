import { HttpClient } from '@angular/common/http';
import { effect, inject } from '@angular/core';
import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import { removeAllEntities, removeEntity, setAllEntities, withEntities } from '@ngrx/signals/entities';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { components } from '../../../core/api-types';
import { AuthSessionStore } from '../../../core/auth/auth-session.store';

export type EquipmentPhoto = components['schemas']['EquipmentPhoto'] & { id: string; url: string };

interface EquipmentPhotosState {
  loading: boolean;
  uploading: boolean;
  error: string | null;
}

/**
 * Fotos de UM equipamento (api#102). Diferente de AccessoriesStore/EquipmentModelsStore, que são
 * catálogos globais: aqui o conteúdo é sempre do equipamento aberto no momento, então `load()`
 * troca a lista inteira (`setAllEntities`) em vez de acumular.
 *
 * Não há store por equipamento nem cache local entre telas de propósito: a `url` de cada foto é
 * assinada e vale 30 minutos, então guardar lista velha só serviria pra mostrar imagem quebrada.
 * Recarregar é barato e sempre traz URL nova.
 */
export const EquipmentPhotosStore = signalStore(
  { providedIn: 'root' },
  withEntities<EquipmentPhoto>(),
  withState<EquipmentPhotosState>({
    loading: false,
    uploading: false,
    error: null,
  }),
  withMethods((store, http = inject(HttpClient)) => {
    const baseUrl = (clientId: string, equipmentId: string) =>
      `${environment.apiUrl}/clients/${clientId}/equipments/${equipmentId}/photos`;

    // `load` é função do closure, e não só um método do objeto devolvido, porque `upload` precisa
    // chamá-la. `this.load(...)` também funciona (conferido) — mas depender do `this` dentro de um
    // método de signalStore é depender de detalhe de implementação do pacote, e o `catch` do upload
    // engoliria o TypeError em silêncio se um dia isso mudasse: a foto subiria e simplesmente não
    // apareceria na lista.
    const load = async (clientId: string, equipmentId: string): Promise<void> => {
      patchState(store, { loading: true, error: null });

      try {
        const response = await firstValueFrom(http.get<{ data: EquipmentPhoto[] }>(baseUrl(clientId, equipmentId)));

        patchState(store, setAllEntities(response.data ?? []), { loading: false });
      } catch {
        patchState(store, { loading: false, error: 'Não foi possível carregar as fotos.' });
      }
    };

    return {
      load,

      /**
       * Sobe um arquivo. Devolve `false` em vez de lançar porque a tela sobe vários de uma vez (o
       * input é `multiple`) e uma foto recusada — 8 MB, formato não aceito — não pode derrubar as
       * outras.
       */
      async upload(clientId: string, equipmentId: string, file: File): Promise<boolean> {
        patchState(store, { uploading: true, error: null });

        const body = new FormData();
        body.append('photo', file);

        try {
          await firstValueFrom(http.post<{ data: EquipmentPhoto }>(baseUrl(clientId, equipmentId), body));

          // Recarrega em vez de inserir o retorno na lista: mantém a ordem que a API define e
          // garante URL fresca em todas.
          await load(clientId, equipmentId);
          patchState(store, { uploading: false });

          return true;
        } catch {
          patchState(store, {
            uploading: false,
            error: `Não foi possível enviar "${file.name}". Aceitamos JPG, PNG e WEBP de até 8 MB.`,
          });

          return false;
        }
      },

      async remove(clientId: string, equipmentId: string, photoId: string): Promise<void> {
        try {
          await firstValueFrom(http.delete(`${baseUrl(clientId, equipmentId)}/${photoId}`));

          patchState(store, removeEntity(photoId));
        } catch {
          patchState(store, { error: 'Não foi possível remover a foto.' });
        }
      },

      reset(): void {
        patchState(store, removeAllEntities(), { loading: false, uploading: false, error: null });
      },
    };
  }),
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
