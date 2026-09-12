import { Component, input } from '@angular/core';
import { LucideLoaderCircle } from '@lucide/angular';

/**
 * Spinner "burro" (sem regra de negócio) — mesmo ícone/animação já usados no botão de login,
 * extraídos aqui pra reaproveitar em qualquer lugar que precise indicar carregamento.
 */
@Component({
  selector: 'ui-spinner',
  imports: [LucideLoaderCircle],
  template: `<svg lucideLoaderCircle [size]="size()" class="animate-spin"></svg>`,
})
export class SpinnerComponent {
  size = input(16);
}
