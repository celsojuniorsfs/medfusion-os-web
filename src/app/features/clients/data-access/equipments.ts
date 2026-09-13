import { components } from '../../../core/api-types';

type Equipment = components['schemas']['Equipment'];

/**
 * Filtro client-side do catálogo — a API não busca no servidor pra equipamentos (GET devolve a
 * lista inteira, ver openapi.yaml). Compara nome/marca/modelo/N-S, os campos que aparecem na
 * listagem; PAT e acessórios ficam de fora de propósito (atrás do "ver mais", pouco usados como
 * critério de busca).
 */
export function equipmentMatchesSearch(equipment: Equipment, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;

  return [equipment.name, equipment.brand, equipment.model, equipment.serial_number].some((field) =>
    field?.toLowerCase().includes(needle),
  );
}
