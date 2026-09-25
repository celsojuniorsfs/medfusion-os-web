import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toast } from '@spartan-ng/brain/sonner';
import { CardComponent } from '../../../shared/ui/card.component';
import { SpinnerComponent } from '../../../shared/ui/spinner.component';
import { formatDateBr } from '../data-access/local-date';
import { orderStatusBadgeClass, orderStatusLabel } from '../data-access/order-status';
import { OrdersStore } from '../data-access/orders.store';

/**
 * Visualização de uma OS (web#41), somente leitura — conteúdo/copy seguem o mockup de referência
 * (`Telas da Ordem de Serviço.pdf`). Sem o texto de "reaberta em..." do mockup (descreve um
 * histórico que não existe no modelo de dados hoje), sem link "Ver histórico do equipamento"
 * (aponta pra tela do web#58, fora de escopo) e sem botão "Editar" (não é nenhuma das issues
 * escolhidas).
 */
@Component({
  selector: 'app-order-detail-page',
  imports: [RouterLink, CardComponent, SpinnerComponent, DecimalPipe],
  templateUrl: './order-detail.page.html',
})
export class OrderDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  protected readonly store = inject(OrdersStore);

  protected readonly orderId = this.route.snapshot.paramMap.get('id')!;
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly pdfBusy = signal(false);

  protected readonly orderStatusLabel = orderStatusLabel;
  protected readonly orderStatusBadgeClass = orderStatusBadgeClass;
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
