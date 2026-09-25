import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CardComponent } from '../../../shared/ui/card.component';
import { SpinnerComponent } from '../../../shared/ui/spinner.component';
import { orderStatusBadgeClass, orderStatusLabel } from '../data-access/order-status';
import { OrdersStore } from '../data-access/orders.store';

/**
 * Visualização de uma OS (web#41), somente leitura — conteúdo/copy seguem o mockup de referência
 * (`Telas da Ordem de Serviço.pdf`). Sem o texto de "reaberta em..." do mockup (descreve um
 * histórico que não existe no modelo de dados hoje), sem link "Ver histórico do equipamento"
 * (aponta pra tela do web#58, fora de escopo) e sem botão "Editar" (não é nenhuma das issues
 * escolhidas). Botões de PDF (web#43/#44) chegam numa PR seguinte, quando a API tiver o endpoint.
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

  protected readonly orderStatusLabel = orderStatusLabel;
  protected readonly orderStatusBadgeClass = orderStatusBadgeClass;

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
}
