import { Component } from '@angular/core';
import { CardComponent } from '../../../shared/ui/card.component';

/**
 * Placeholder — telas de Ordem de Serviço entram nas próximas issues da F4 (web #37-#42, #57-#58).
 */
@Component({
  selector: 'app-orders-page',
  imports: [CardComponent],
  template: `
    <div class="flex flex-col gap-4">
      <div>
        <h1 class="text-xl font-semibold">Ordens de Serviço</h1>
        <p class="text-sm text-muted-foreground">Criação, listagem e visualização de OS.</p>
      </div>
      <ui-card class="p-4 md:p-6">
        <p class="text-sm">Em construção — criação, listagem e visualização de OS chegam na próxima etapa da F4.</p>
      </ui-card>
    </div>
  `,
})
export class OrdersPage {}
