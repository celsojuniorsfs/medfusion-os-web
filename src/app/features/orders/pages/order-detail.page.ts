import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toast } from '@spartan-ng/brain/sonner';
import { CardComponent } from '../../../shared/ui/card.component';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog.component';
import { SpinnerComponent } from '../../../shared/ui/spinner.component';
import { formatDateBr } from '../data-access/local-date';
import { isOrderCancelable, isOrderEditable, orderStatusBadgeClass, orderStatusLabel } from '../data-access/order-status';
import { OrdersStore } from '../data-access/orders.store';

/**
 * Visualização de uma OS (web#41). Conteúdo/copy seguem o mockup de referência (`Telas da Ordem
 * de Serviço.pdf`). Sem o texto de "reaberta em..." do mockup (descreve um histórico que não
 * existe no modelo de dados hoje) e sem link "Ver histórico do equipamento" (aponta pra tela do
 * web#58, fora de escopo).
 *
 * Botões de Editar/Cancelar seguem o mesmo par requestCancel/confirmCancel de `orders.page.ts` —
 * ver o comentário lá pra por que "cancelar" é a única forma de "desativar" uma OS.
 */
@Component({
  selector: 'app-order-detail-page',
  imports: [RouterLink, CardComponent, ConfirmDialogComponent, SpinnerComponent, DecimalPipe],
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
  protected readonly isOrderEditable = isOrderEditable;
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
    await this.openPdf(false);
  }

  async regeneratePdf(): Promise<void> {
    await this.openPdf(true);
  }

  /**
   * `window.open('', '_blank')` roda ANTES de qualquer `await` — ainda dentro do gesto síncrono
   * do clique, então nunca cai no bloqueador de pop-up (que só bloqueia `window.open()` chamado
   * depois de atravessar uma fronteira assíncrona). Navegar a aba já aberta pra URL assinada, uma
   * vez que ela chega, funciona igual em desktop e celular — o navegador/SO decide a melhor forma
   * de mostrar o PDF, sem precisar de blob nem do atributo `download` (que o Safari mobile mais
   * antigo ignora).
   */
  private async openPdf(forceRegenerate: boolean): Promise<void> {
    const order = this.order();
    if (!order || this.pdfBusy()) return;

    const tab = window.open('', '_blank');
    this.pdfBusy.set(true);

    try {
      const needsGeneration =
        forceRegenerate ||
        !order.pdf_generated_at ||
        (!!order.updated_at && new Date(order.pdf_generated_at) < new Date(order.updated_at));

      let pdf = needsGeneration ? null : await this.store.getPdf(order.id);
      if (!pdf) {
        // Também cobre o caso raro de getPdf() 404ar apesar de pdf_generated_at estar
        // preenchido (registro sumiu no servidor) — sempre que ESTA chamada gera de verdade,
        // markPdfGenerated roda, não importa qual ramo decidiu gerar.
        pdf = await this.store.generatePdf(order.id);
        if (pdf.generated_at) this.store.markPdfGenerated(order.id, pdf.generated_at);
      }

      if (!pdf.url) throw new Error('Resposta do PDF sem URL.');

      if (tab) {
        tab.location.href = pdf.url;
      } else {
        window.location.href = pdf.url;
      }
    } catch {
      tab?.close();
      toast.error('Não foi possível gerar o PDF da OS.');
    } finally {
      this.pdfBusy.set(false);
    }
  }
}
