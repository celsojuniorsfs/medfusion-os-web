import { components } from '../../../core/api-types';

export type EquipmentSituation = components['schemas']['OrderEquipmentSituation'];

/** Ordem do fluxo real de um equipamento, não a alfabética. */
export const EQUIPMENT_SITUATIONS: EquipmentSituation[] = [
  'in_analysis',
  'awaiting_part',
  'external_repair',
  'completed',
  'returned_unrepaired',
];

const LABELS: Record<EquipmentSituation, string> = {
  in_analysis: 'Em análise',
  awaiting_part: 'Aguardando peça',
  external_repair: 'Manutenção externa',
  completed: 'Concluído',
  returned_unrepaired: 'Devolvido sem reparo',
};

// Uma cor por situação, sem tons de cinza (indistinguíveis de `bg-muted`, ver order-status.ts).
const BADGE_CLASSES: Record<EquipmentSituation, string> = {
  in_analysis: 'bg-blue-100 text-blue-700',
  awaiting_part: 'bg-amber-100 text-amber-700',
  external_repair: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-emerald-100 text-emerald-700',
  returned_unrepaired: 'bg-orange-100 text-orange-700',
};

export function equipmentSituationLabel(situation: EquipmentSituation): string {
  return LABELS[situation];
}

export function equipmentSituationBadgeClass(situation: EquipmentSituation): string {
  return BADGE_CLASSES[situation];
}

/** Espelha OrderEquipmentSituation::isResolved() (api): só estas duas deixam de bloquear a OS. */
export function isSituationResolved(situation: EquipmentSituation): boolean {
  return situation === 'completed' || situation === 'returned_unrepaired';
}

/**
 * "N de M concluídos". Conta os dois estados resolvidos porque é quando todos estão resolvidos que
 * a API conclui a OS sozinha — assim "M de M" coincide com a OS concluída. `null` com 0 ou 1
 * equipamento: o contador não diz nada que o status já não diga.
 */
export function resolvedProgress(order: {
  equipments?: { situation?: EquipmentSituation }[];
}): { resolved: number; total: number } | null {
  const equipments = order.equipments ?? [];

  if (equipments.length < 2) return null;

  return {
    resolved: equipments.filter(
      (equipment) => equipment.situation && isSituationResolved(equipment.situation),
    ).length,
    total: equipments.length,
  };
}
