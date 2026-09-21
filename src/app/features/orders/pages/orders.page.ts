import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucidePlus } from '@lucide/angular';
import { CardComponent } from '../../../shared/ui/card.component';

/**
 * Listagem/acompanhamento de OS ainda é um placeholder (web#42/#58) — esta issue (web#100) só
 * tira o botão "Nova OS" do "Em construção", já que abrir uma OS não depende de ter uma listagem
 * pronta.
 */
@Component({
  selector: 'app-orders-page',
  imports: [RouterLink, LucidePlus, CardComponent],
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-xl font-semibold">Ordens de Serviço</h1>
          <p class="text-sm text-muted-foreground">Criação, listagem e visualização de OS.</p>
        </div>
        <a
          routerLink="novo"
          class="inline-flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto"
        >
          <svg lucidePlus [size]="16"></svg>
          Nova OS
        </a>
      </div>
      <ui-card class="p-4 md:p-6">
        <p class="text-sm">
          Listagem e acompanhamento de OS ainda estão em construção — por enquanto, "Nova OS" é a única ação disponível
          aqui.
        </p>
      </ui-card>
    </div>
  `,
})
export class OrdersPage {}
