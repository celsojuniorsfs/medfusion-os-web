import { components } from '../../../core/api-types';

type OrderStatus = components['schemas']['OrderStatus'];

/** Ordem de exibição em filtros/relatórios — não é a ordem alfabética, segue o fluxo real da OS. */
export const ORDER_STATUSES: OrderStatus[] = [
  'open',
  'in_analysis',
  'external_quote',
  'awaiting_approval',
  'approved',
  'not_approved',
  'warranty_repair',
  'completed',
  'canceled',
];

const LABELS: Record<OrderStatus, string> = {
  open: 'Aberta',
  in_analysis: 'Em análise',
  external_quote: 'Orçamento externo',
  awaiting_approval: 'Aguardando aprovação',
  approved: 'Aprovada',
  not_approved: 'Não aprovado',
  warranty_repair: 'Garantia',
  completed: 'Concluída',
  canceled: 'Cancelada',
};

const BADGE_CLASSES: Record<OrderStatus, string> = {
  open: 'bg-muted text-muted-foreground',
  in_analysis: 'bg-blue-100 text-blue-700',
  external_quote: 'bg-blue-100 text-blue-700',
  awaiting_approval: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  not_approved: 'bg-red-100 text-red-700',
  warranty_repair: 'bg-orange-100 text-orange-700',
  completed: 'bg-emerald-100 text-emerald-700',
  canceled: 'bg-muted text-muted-foreground',
};

export function orderStatusLabel(status: OrderStatus): string {
  return LABELS[status];
}

export function orderStatusBadgeClass(status: OrderStatus): string {
  return BADGE_CLASSES[status];
}
