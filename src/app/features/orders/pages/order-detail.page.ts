import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideBan, LucideDownload } from '@lucide/angular';
import { toast } from '@spartan-ng/brain/sonner';
import { CardComponent } from '../../../shared/ui/card.component';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog.component';
import { SpinnerComponent } from '../../../shared/ui/spinner.component';
import { formatDateBr } from '../data-access/local-date';
import { openOrderPdf } from '../data-access/open-order-pdf';
import { isOrderCancelable, orderStatusBadgeClass, orderStatusLabel } from '../data-access/order-status';
import { OrdersStore } from '../data-access/orders.store';

/**
 * Visualização de uma OS (web#41). Conteúdo/copy seguem o mockup de referência (`Telas da Ordem
 * de Serviço.pdf`). Sem o texto de "reaberta em..." do mockup (descreve um histórico que não
 * existe no modelo de dados hoje) e sem link "Ver histórico do equipamento" (aponta pra tela do
 * web#58, fora de escopo).
 *
 * Sem botão de Editar aqui (editar é pelo lápis da listagem). Cancelar segue o mesmo par
 * requestCancel/confirmCancel de `orders.page.ts` — ver o comentário lá pra por que "cancelar" é a
 * única forma de "desativar" uma OS.
 */
@Component({
  selector: 'app-order-detail-page',
  imports: [
    RouterLink,
    CardComponent,
    ConfirmDialogComponent,
    SpinnerComponent,
    DecimalPipe,
    LucideBan,
    LucideDownload,
  ],
  templateUrl: './order-detail.page.html',
})
export class OrderDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  protected readonly store = inject(OrdersStore);

  protected readonly orderId = this.route.snapshot.paramMap.get('id')!;
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly pdfBusy = signal(false);
  protected readonly canceling = signal(false);
  private readonly cancelDialog = viewChild.required(ConfirmDialogComponent);

  protected readonly orderStatusLabel = orderStatusLabel;
  protected readonly orderStatusBadgeClass = orderStatusBadgeClass;
  protected readonly isOrderCancelable = isOrderCancelable;
  protected readonly formatDateBr = formatDateBr;

  protected readonly order = computed(() => this.store.entities().find((order) => order.id === this.orderId));

  protected readonly attendanceTypes = computed(() => {
    const order = this.order();
    if (!order) return [];

    return [
      { label: 'Retirado', active: !!order.picked_up },
      { label: 'Garantia', active: !!order.warranty },
      { label: 'Treinamento técnico', active: !!order.technical_training },
      { label: 'Orç. local', active: !!order.on_site_quote },
      { label: 'Locação', active: !!order.rental },
    ];
  });

  async ngOnInit(): Promise<void> {
    this.loading.set(true);

    try {
      await this.store.findOne(this.orderId);
    } catch {
      this.errorMessage.set('Não foi possível carregar esta ordem de serviço.');
    } finally {
      this.loading.set(false);
    }
  }

  requestCancel(): void {
    this.cancelDialog().open();
  }

  async confirmCancel(): Promise<void> {
    const order = this.order();
    if (!order) return;

    this.canceling.set(true);
    try {
      // upsertEntity (dentro de changeStatus) já atualiza o badge/os botões desta própria tela —
      // sem precisar de um findOne() extra pra recarregar.
      await this.store.changeStatus(order.id, 'canceled');
      this.cancelDialog().close();
      toast.success('Ordem de serviço cancelada.');
    } catch {
      // Fecha o diálogo antes do toast — senão o backdrop dele fica por cima da mensagem de erro
      // (ver o mesmo comentário em clients.page.ts::confirmRemove).
      this.cancelDialog().close();
      toast.error('Não foi possível cancelar a OS. Tente novamente.');
    } finally {
      this.canceling.set(false);
    }
  }

  async downloadPdf(): Promise<void> {
    const order = this.order();
    if (!order || this.pdfBusy()) return;

    this.pdfBusy.set(true);
    try {
      await openOrderPdf(this.store, order.id);
    } catch {
      toast.error('Não foi possível gerar o PDF da OS.');
    } finally {
      this.pdfBusy.set(false);
    }
  }
}
