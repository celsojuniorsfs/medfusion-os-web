import { HttpClient } from '@angular/common/http';
import { computed, effect, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import {
  removeAllEntities,
  removeEntity,
  setAllEntities,
  withEntities,
} from '@ngrx/signals/entities';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthSessionStore } from '../auth/auth-session.store';
import { Alert, canSeeAlerts } from './alerts';

interface AlertsState {
  loading: boolean;
  error: string | null;
}

/**
 * Alertas pendentes (api#160). Mora em `core/` porque o sino fica no header do shell, e `core/`
 * não pode importar `features/` — a página /alertas (features/alerts) é quem importa este store.
 */
export const AlertsStore = signalStore(
  { providedIn: 'root' },
  withEntities<Alert>(),
  withState<AlertsState>({ loading: false, error: null }),
  withComputed(({ entities }) => ({
    count: computed(() => entities().length),
  })),
  withMethods((store, http = inject(HttpClient), auth = inject(AuthSessionStore)) => {
    let loadRequestId = 0;

    return {
      async load(): Promise<void> {
        if (!canSeeAlerts(auth.user()?.role)) return;

        const requestId = ++loadRequestId;
        patchState(store, { loading: true, error: null });

        try {
          const response = await firstValueFrom(
            http.get<{ data: Alert[] }>(`${environment.apiUrl}/alerts`),
          );

          if (requestId !== loadRequestId) return;
          patchState(store, setAllEntities(response.data ?? []), { loading: false });
        } catch {
          if (requestId !== loadRequestId) return;
          patchState(store, { loading: false, error: 'Não foi possível carregar os alertas.' });
        }
      },

      async markContacted(id: string): Promise<void> {
        await firstValueFrom(
          http.patch(`${environment.apiUrl}/alerts/revisions/${id}/contacted`, {}),
        );

        // Invalida um load() em voo: a resposta dele ainda traz o alerta que acabou de sair.
        loadRequestId++;
        patchState(store, removeEntity(id), { loading: false });
      },

      reset(): void {
        loadRequestId++;
        patchState(store, removeAllEntities(), { loading: false, error: null });
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
