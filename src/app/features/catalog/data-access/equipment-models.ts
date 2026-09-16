import { components } from '../../../core/api-types';

// `& { id: string; name: string }` — mesmo padrão já usado em accessories.ts e equipments.store.ts:
// o schema gerado marca tudo como opcional (nenhum `required` declarado no openapi.yaml pro schema
// de resposta), mas a API sempre devolve id e nome preenchidos de verdade.
export type EquipmentModel = components['schemas']['EquipmentModel'] & { id: string; name: string };

/**
 * Filtro client-side do catálogo global de modelos — a API devolve a lista inteira, sem busca no
 * servidor (mesma decisão do catálogo de acessórios, ver openapi.yaml).
 *
 * Casa contra nome, marca e modelo juntos: o técnico procura tanto por "ultrassom" quanto por
 * "sonopus" ou pelo código do modelo, e nenhum dos três sozinho cobre os três jeitos.
 */
export function equipmentModelMatchesSearch(equipmentModel: EquipmentModel, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;

  return [equipmentModel.name, equipmentModel.brand, equipmentModel.model].some((field) =>
    field?.toLowerCase().includes(needle),
  );
}

/** Rótulo de uma linha do catálogo, do jeito que aparece no seletor. */
export function equipmentModelLabel(equipmentModel: EquipmentModel): string {
  return [equipmentModel.name, equipmentModel.brand, equipmentModel.model].filter(Boolean).join(' · ');
}
