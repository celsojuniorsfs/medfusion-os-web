import { Component } from '@angular/core';
import { CardComponent } from '../../../shared/ui/card.component';

/**
 * Placeholder — CRUD de clientes entra nas próximas issues da F4 (web #33-#36).
 */
@Component({
  selector: 'app-clients-page',
  imports: [CardComponent],
  template: `
    <div class="flex flex-col gap-4">
      <div>
        <h1 class="text-xl font-semibold">Clientes</h1>
        <p class="text-sm text-muted-foreground">Cadastro, busca e histórico de clientes.</p>
      </div>
      <ui-card class="p-6">
        <p class="text-sm">Em construção — listagem e cadastro de clientes chegam na próxima etapa da F4.</p>
      </ui-card>
    </div>
  `,
})
export class ClientsPage {}
