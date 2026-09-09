import { Component } from '@angular/core';

/**
 * Card "burro" (sem regra de negócio) — visual padronizado do design system: fundo branco,
 * borda sutil, cantos arredondados, sombra leve. Equivalente ao Card do shadcn/ui usado no
 * design de referência.
 */
@Component({
  selector: 'ui-card',
  template: `<ng-content />`,
  host: {
    class: 'block rounded-lg border border-border bg-card text-card-foreground shadow-sm',
  },
})
export class CardComponent {}
