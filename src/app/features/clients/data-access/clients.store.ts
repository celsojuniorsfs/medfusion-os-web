import { signalStore, withState } from '@ngrx/signals';
import { withEntities } from '@ngrx/signals/entities';
import { components } from '../../../core/api-types';

type Client = components['schemas']['Client'];

/**
 * Read model + comandos da feature de clientes — equivalente do front ao par
 * Projector/Application do módulo Clients no backend (ver docs/architecture.md da API).
 *
 * Ainda sem métodos: o CRUD de clientes (GET/POST/PUT/DELETE /clients) é fora desta sessão —
 * a ClientsPage (placeholder) só precisa que a store já exista na estrutura certa. Os métodos
 * (list/create/update/remove) chegam junto com a tela real, chamando HttpClient direto aqui
 * dentro (data-access = http + store no mesmo lugar — sem uma camada de serviço à parte).
 */
export const ClientsStore = signalStore(
  { providedIn: 'root' },
  withEntities<Client>(),
  withState({ loading: false, error: null as string | null }),
);
