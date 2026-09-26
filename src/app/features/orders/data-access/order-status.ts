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

// Uma cor por status, nenhuma repetida — achado em produção: `open`/`canceled` (as duas mais
// comuns na listagem) compartilhavam a mesma classe (`bg-muted`), impossível distinguir de
// relance. `approved`/`not_approved` reaproveitam os tokens de marca já usados no resto do app
// (`primary`/`destructive`, mesmo padrão do avatar em shell.component.html) — o resto usa
// famílias do Tailwind padrão que o app já tem disponível.
const BADGE_CLASSES: Record<OrderStatus, string> = {
  open: 'bg-slate-100 text-slate-700',
  in_analysis: 'bg-blue-100 text-blue-700',
  external_quote: 'bg-indigo-100 text-indigo-700',
  awaiting_approval: 'bg-amber-100 text-amber-700',
  approved: 'bg-primary/15 text-primary',
  not_approved: 'bg-destructive/15 text-destructive',
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

// Espelha OrderStatus::allowedNextStatuses() (api) — só os status de onde "cancelar" é uma
// transição válida. Se a API mudar essas regras, este é o único lugar a atualizar no web.
const CANCELABLE_STATUSES: OrderStatus[] = ['open', 'in_analysis', 'external_quote', 'awaiting_approval'];

// Espelha OrderService::assertIsEditable() (api) — `completed` entra aqui mesmo não sendo
// tecnicamente terminal no grafo de transições (pode ir pra `warranty_repair`): editar
// equipamentos/peças de uma OS já concluída não faz sentido operacional.
const UNEDITABLE_STATUSES: OrderStatus[] = ['canceled', 'completed', 'not_approved'];

export function isOrderCancelable(status: OrderStatus): boolean {
  return CANCELABLE_STATUSES.includes(status);
}

export function isOrderEditable(status: OrderStatus): boolean {
  return !UNEDITABLE_STATUSES.includes(status);
}
