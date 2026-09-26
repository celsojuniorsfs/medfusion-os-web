import { Component, input, output } from '@angular/core';
import { LucideChevronLeft, LucideChevronRight } from '@lucide/angular';

/**
 * Extraído de orders.page.html/equipment-history.page.html (achado por code-review na PR do
 * histórico de equipamento: a cópia colada perdeu a proteção contra corrida que o original tinha
 * só porque OrdersStore.load() controla isso por conta própria — outra tela que pagina sem passar
 * por esse store ficaria vulnerável do mesmo jeito). `[busy]` desabilita os dois botões enquanto
 * uma página está carregando — sem isso, cliques em sequência rápida (ex.: Próxima, Anterior antes
 * da primeira resposta voltar) podem terminar renderizando a página errada se as respostas
 * chegarem fora de ordem.
 */
@Component({
  selector: 'ui-pagination',
  imports: [LucideChevronLeft, LucideChevronRight],
  template: `
    <div class="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>Página {{ page() }} de {{ lastPage() }} — {{ total() }} no total</span>
      <div class="flex gap-1">
        <button
          type="button"
          [disabled]="page() <= 1 || busy()"
          (click)="pageChange.emit(page() - 1)"
          class="inline-flex h-9 items-center gap-1 rounded-md border border-input px-3 disabled:pointer-events-none disabled:opacity-50"
        >
          <svg lucideChevronLeft [size]="14"></svg>
          Anterior
        </button>
        <button
          type="button"
          [disabled]="page() >= lastPage() || busy()"
          (click)="pageChange.emit(page() + 1)"
          class="inline-flex h-9 items-center gap-1 rounded-md border border-input px-3 disabled:pointer-events-none disabled:opacity-50"
        >
          Próxima
          <svg lucideChevronRight [size]="14"></svg>
        </button>
      </div>
    </div>
  `,
})
export class PaginationComponent {
  page = input.required<number>();
  lastPage = input.required<number>();
  total = input.required<number>();
  busy = input(false);
  pageChange = output<number>();
}
