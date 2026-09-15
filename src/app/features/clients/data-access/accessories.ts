import { components } from '../../../core/api-types';

// `& { id: string; name: string }` — mesmo padrão já usado em equipments.store.ts (`Equipment`):
// o schema gerado marca os dois como opcionais (nenhum `required` declarado no openapi.yaml pro
// schema de resposta), mas a API sempre devolve os dois preenchidos de verdade.
export type Accessory = components['schemas']['Accessory'] & { id: string; name: string };

/**
 * Filtro client-side do catálogo — a API não busca no servidor pra acessórios (GET devolve a
 * lista inteira, mesmo padrão de equipmentMatchesSearch em equipments.ts).
 */
export function accessoryMatchesSearch(accessory: Accessory, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;

  return accessory.name.toLowerCase().includes(needle);
}
