import { Alert, AlertType } from '../../../core/alerts/alerts';

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  order_stalled: 'OS parada',
  equipment_situation: 'Equipamento parado',
  equipment_revision: 'Revisão anual',
};

// Uma cor por tipo, sem tons de cinza (indistinguíveis de `bg-muted`, ver order-status.ts).
export const ALERT_TYPE_BADGE_CLASS: Record<AlertType, string> = {
  order_stalled: 'bg-amber-100 text-amber-700',
  equipment_situation: 'bg-sky-100 text-sky-700',
  equipment_revision: 'bg-violet-100 text-violet-700',
};

/** A API não manda link: revisão anual leva ao histórico do equipamento, os outros à OS. */
export function alertLink(alert: Alert): string[] {
  if (alert.type === 'equipment_revision' && alert.equipment?.id) {
    return ['/orders/historico/equipamento', alert.equipment.id];
  }

  return ['/orders', alert.order?.id ?? ''];
}
