/**
 * Catálogo global de acessórios (api#92) — schema ainda não existe em api-types.ts (a PR da API
 * que cria o módulo Accessories não está mergeada em main ainda, e o script de geração de tipos
 * sempre puxa de lá, ver package.json). Interface escrita à mão de propósito, mesmo padrão já
 * usado em client-form.page.ts pro ViaCEP (`ViaCepAddress`) — troca pelo tipo gerado
 * (`components['schemas']['Accessory']`) quando a API mergear.
 */
export interface Accessory {
  id: string;
  name: string;
}

/**
 * Filtro client-side do catálogo — a API não busca no servidor pra acessórios (GET devolve a
 * lista inteira, mesmo padrão de equipmentMatchesSearch em equipments.ts).
 */
export function accessoryMatchesSearch(accessory: Accessory, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;

  return accessory.name.toLowerCase().includes(needle);
}
