import { signalStore, withState } from '@ngrx/signals';
import { withEntities } from '@ngrx/signals/entities';
import { components } from '../../../core/api-types';

type Order = components['schemas']['Order'];

/**
 * Read model + comandos da feature de Ordens de Serviço — equivalente do front ao par
 * Projector/Application do módulo Orders no backend (ver docs/architecture.md da API).
 *
 * Ainda sem métodos: CRUD de OS é fora desta sessão — ver comentário equivalente em
 * features/clients/data-access/clients.store.ts.
 */
export const OrdersStore = signalStore(
  { providedIn: 'root' },
  withEntities<Order>(),
  withState({ loading: false, error: null as string | null }),
);
