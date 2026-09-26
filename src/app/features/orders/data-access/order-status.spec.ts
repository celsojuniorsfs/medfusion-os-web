import { ORDER_STATUSES, orderStatusBadgeClass, orderStatusLabel } from './order-status';

describe('order-status', () => {
  it('has a label and a badge class for every status', () => {
    for (const status of ORDER_STATUSES) {
      expect(orderStatusLabel(status)).toBeTruthy();
      expect(orderStatusBadgeClass(status)).toBeTruthy();
    }
  });

  it('labels a few statuses in Portuguese, matching the reference mockup', () => {
    expect(orderStatusLabel('open')).toBe('Aberta');
    expect(orderStatusLabel('awaiting_approval')).toBe('Aguardando aprovação');
    expect(orderStatusLabel('completed')).toBe('Concluída');
  });

  // Achado em produção: `open`/`canceled` compartilhavam a mesma classe (bg-muted) — badges
  // visualmente idênticos na listagem, impossível distinguir status de relance.
  it('gives every status a distinct badge class', () => {
    const classes = ORDER_STATUSES.map((status) => orderStatusBadgeClass(status));
    expect(new Set(classes).size).toBe(ORDER_STATUSES.length);
  });
});
