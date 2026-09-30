import { DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideBan, LucideDownload, LucideRotateCcw } from '@lucide/angular';
import { toast } from '@spartan-ng/brain/sonner';
import { CardComponent } from '../../../shared/ui/card.component';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog.component';
import { SpinnerComponent } from '../../../shared/ui/spinner.component';
import { formatDateBr } from '../data-access/local-date';
import {
  EQUIPMENT_SITUATIONS,
  EquipmentSituation,
  equipmentSituationBadgeClass,
  equipmentSituationLabel,
  resolvedProgress,
} from '../data-access/equipment-situation';
import { openOrderPdf } from '../data-access/open-order-pdf';
import { isOrderCancelable, isOrderEditable, orderStatusBadgeClass, orderStatusLabel } from '../data-access/order-status';
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
    LucideRotateCcw,
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
  protected readonly reopening = signal(false);
  protected readonly reopenChecked = signal<ReadonlySet<string>>(new Set());
  private readonly cancelDialog = viewChild.required<ConfirmDialogComponent>('cancelDialog');
  private readonly warrantyDialog = viewChild.required<ConfirmDialogComponent>('warrantyDialog');

  protected readonly orderStatusLabel = orderStatusLabel;
  protected readonly orderStatusBadgeClass = orderStatusBadgeClass;
  protected readonly isOrderCancelable = isOrderCancelable;
  protected readonly formatDateBr = formatDateBr;
  protected readonly situations = EQUIPMENT_SITUATIONS;
  protected readonly situationLabel = equipmentSituationLabel;
  protected readonly situationBadgeClass = equipmentSituationBadgeClass;

  protected readonly order = computed(() => this.store.entities().find((order) => order.id === this.orderId));

  // A API recusa (409) mudar situação de OS cancelada/concluída/não aprovada.
  protected readonly editable = computed(() => {
    const order = this.order();

    return !!order?.status && isOrderEditable(order.status);
  });

  protected readonly progress = computed(() => {
    const order = this.order();

    return order ? resolvedProgress(order) : null;
  });

  protected readonly applying = signal(false);
  protected readonly bulkSituation = signal<EquipmentSituation>('in_analysis');
  private readonly checked = signal<ReadonlySet<string>>(new Set());

  // Cruzado com os ids atuais: um PUT recria `order_equipments` com ids novos, e um id que sumiu
  // não pode ficar contando como selecionado. Vazio quando a OS deixa de ser editável (o último
  // equipamento concluiu e a API concluiu a OS): os checkboxes somem e a barra ficaria sem saída.
  protected readonly selected = computed(() => {
    if (!this.editable()) return new Set<string>();

    const ids = new Set((this.order()?.equipments ?? []).map((equipment) => equipment.id));

    return new Set([...this.checked()].filter((id) => ids.has(id)));
  });

  protected readonly allSelected = computed(() => {
    const total = this.order()?.equipments?.length ?? 0;

    return total > 0 && this.selected().size === total;
  });

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

  requestReopen(): void {
    this.reopenChecked.set(new Set());
    this.warrantyDialog().open();
  }

  toggleReopen(id: string, checked: boolean): void {
    this.reopenChecked.update((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);

      return next;
    });
  }

  async confirmReopen(): Promise<void> {
    const order = this.order();
    const ids = [...this.reopenChecked()];
    if (!order || ids.length === 0) return;

    this.reopening.set(true);
    try {
      await this.store.reopenInWarranty(order.id, ids);
      this.warrantyDialog().close();
      this.reopenChecked.set(new Set());
      toast.success('OS reaberta em garantia.');
    } catch {
      this.warrantyDialog().close();
      // Se o primeiro passo passou e o segundo não, a OS já está em garantia (e editável): o
      // usuário termina pelo select de situação do equipamento.
      toast.error('Não foi possível reabrir a OS em garantia. Confira o status da OS e tente novamente.');
    } finally {
      this.reopening.set(false);
    }
  }

  toggleSelected(id: string, checked: boolean): void {
    this.checked.update((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);

      return next;
    });
  }

  toggleAll(checked: boolean): void {
    const ids = (this.order()?.equipments ?? []).map((equipment) => equipment.id!);

    this.checked.set(checked ? new Set(ids) : new Set());
  }

  clearSelection(): void {
    this.checked.set(new Set());
  }

  async changeOne(equipment: { id?: string; situation?: EquipmentSituation }, select: HTMLSelectElement): Promise<void> {
    const situation = select.value as EquipmentSituation;
    if (!equipment.id || situation === equipment.situation) return;

    // O select já mostra o valor escolhido; se a API recusar, o estado do store não muda e o
    // Angular não redesenha, então o valor antigo precisa ser devolvido à mão.
    if (!(await this.apply([equipment.id], situation))) {
      select.value = equipment.situation ?? 'in_analysis';
    }
  }

  async applyToSelected(): Promise<void> {
    const ids = [...this.selected()];
    if (ids.length === 0) return;

    if (await this.apply(ids, this.bulkSituation())) {
      this.clearSelection();
    }
  }

  private async apply(ids: string[], situation: EquipmentSituation): Promise<boolean> {
    this.applying.set(true);
    try {
      await this.store.changeEquipmentsSituation(this.orderId, ids, situation);
      toast.success(ids.length === 1 ? 'Situação atualizada.' : `Situação atualizada em ${ids.length} equipamentos.`);

      return true;
    } catch (error) {
      toast.error(
        (error as { status?: number }).status === 409
          ? 'Esta OS não aceita mais alterações.'
          : 'Não foi possível atualizar a situação. Tente novamente.',
      );

      return false;
    } finally {
      this.applying.set(false);
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
