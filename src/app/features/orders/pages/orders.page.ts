import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucidePlus, LucideScanQrCode } from '@lucide/angular';
import { CardComponent } from '../../../shared/ui/card.component';

/**
 * Listagem/acompanhamento de OS ainda é um placeholder (web#42/#58) — a web#100 tirou o botão
 * "Nova OS" do "Em construção" e a web#103 acrescentou "Escanear equipamento" ao lado, já que
 * nenhuma das duas ações depende de ter uma listagem pronta.
 */
@Component({
  selector: 'app-orders-page',
  imports: [RouterLink, LucidePlus, LucideScanQrCode, CardComponent],
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-xl font-semibold">Ordens de Serviço</h1>
          <p class="text-sm text-muted-foreground">Criação, listagem e visualização de OS.</p>
        </div>
        <div class="flex flex-col gap-2 sm:flex-row">
          <a
            routerLink="escanear"
            class="inline-flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-md border border-input px-4 text-sm font-medium hover:bg-accent sm:w-auto"
          >
            <svg lucideScanQrCode [size]="16"></svg>
            Escanear equipamento
          </a>
          <a
            routerLink="novo"
            class="inline-flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto"
          >
            <svg lucidePlus [size]="16"></svg>
            Nova OS
          </a>
        </div>
      </div>
      <ui-card class="p-4 md:p-6">
        <p class="text-sm">
          Listagem e acompanhamento de OS ainda estão em construção — por enquanto, "Nova OS" e "Escanear
          equipamento" são as únicas ações disponíveis aqui.
        </p>
      </ui-card>
    </div>
  `,
})
export class OrdersPage {}
