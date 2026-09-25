import { components } from '../../../core/api-types';

type Equipment = components['schemas']['Equipment'];

/**
 * `equipment.accessories` é uma lista de objetos ({ accessory_id, name, quantity }), não uma
 * string — interpolar direto no template produz "[object Object]" (achado em produção). Formata
 * pra "Nome (xQtd)" quando a quantidade é maior que 1, só "Nome" quando é 1.
 *
 * `name` é opcional no schema (EquipmentAccessory) — sem o fallback, um acessório sem nome viraria
 * o texto "undefined" na tela. Separador `; `, não `, `: nome de acessório é texto livre (o
 * técnico pode cadastrar um novo com vírgula no meio), e uma vírgula ali seria indistinguível do
 * separador entre acessórios diferentes.
 */
export function formatAccessories(equipment: Equipment): string {
  const accessories = equipment.accessories ?? [];
  if (accessories.length === 0) return '—';

  return accessories
    .map((accessory) => {
      const name = accessory.name || 'Acessório sem nome';
      return accessory.quantity && accessory.quantity > 1 ? `${name} (x${accessory.quantity})` : name;
    })
    .join('; ');
}

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
