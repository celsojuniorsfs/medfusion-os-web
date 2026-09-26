import { DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideBan, LucideDownload, LucidePencil, LucidePlus, LucideScanQrCode } from '@lucide/angular';
import { toast } from '@spartan-ng/brain/sonner';
import { components } from '../../../core/api-types';
import { CardComponent } from '../../../shared/ui/card.component';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog.component';
import { PaginationComponent } from '../../../shared/ui/pagination.component';
import { SpinnerComponent } from '../../../shared/ui/spinner.component';
import { ClientsStore } from '../../clients/data-access/clients.store';
import { formatDateBr } from '../data-access/local-date';
import { openOrderPdf } from '../data-access/open-order-pdf';
import {
  ORDER_STATUSES,
  isOrderCancelable,
  isOrderEditable,
  orderStatusBadgeClass,
  orderStatusLabel,
} from '../data-access/order-status';
import { OrdersStore } from '../data-access/orders.store';

type Client = components['schemas']['Client'] & { id: string };
type OrderStatus = components['schemas']['OrderStatus'];

/**
 * Listagem de OS (web#42): filtros por cliente/status/data, tabela ordenada por data desc (regra
 * do próprio backend, sem parâmetro de ordenação), paginação — mesmo molde de
 * `features/clients/pages/clients.page.ts`. O filtro de cliente é busca-e-seleciona (produz um
 * `client_id`), não texto livre: `GET /orders` filtra por id, não por nome.
 *
 * Ações de editar/cancelar por linha seguem o mesmo par requestRemove/confirmRemove de
 * `clients.page.ts`, só que "cancelar" muda o status em vez de remover (não existe DELETE de OS —
 * é um agregado de event sourcing, cancelar é a única forma de "desativar").
 */
@Component({
  selector: 'app-orders-page',
  imports: [
    RouterLink,
    CardComponent,
    ConfirmDialogComponent,
    SpinnerComponent,
    PaginationComponent,
    DecimalPipe,
    LucidePlus,
    LucideScanQrCode,
    LucideDownload,
    LucidePencil,
    LucideBan,
  ],
  templateUrl: './orders.page.html',
})
export class OrdersPage implements OnInit, OnDestroy {
  protected readonly store = inject(OrdersStore);
  protected readonly clientsStore = inject(ClientsStore);
  protected readonly orderStatusLabel = orderStatusLabel;
  protected readonly orderStatusBadgeClass = orderStatusBadgeClass;
  protected readonly isOrderEditable = isOrderEditable;
  protected readonly isOrderCancelable = isOrderCancelable;
  protected readonly formatDateBr = formatDateBr;
  protected readonly statuses = ORDER_STATUSES;

  protected readonly pendingCancel = signal<{ id: string; number: number } | null>(null);
  protected readonly canceling = signal(false);
  protected readonly pdfBusyId = signal<string | null>(null);
  private readonly cancelDialog = viewChild.required(ConfirmDialogComponent);

  protected readonly clientFilterSearch = signal('');
  protected readonly clientFilterId = signal<string | null>(null);
  protected readonly statusFilter = signal<OrderStatus | ''>('');
  protected readonly dateFromFilter = signal('');
  protected readonly dateToFilter = signal('');

  protected readonly selectedClientFilter = computed<Client | undefined>(() => {
    const id = this.clientFilterId();
    return id ? this.clientsStore.entities().find((client) => client.id === id) : undefined;
  });

  private clientSearchTimeout?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.store.load();
  }

  ngOnDestroy(): void {
    clearTimeout(this.clientSearchTimeout);
  }

  private applyFilters(): void {
    this.store.load(1, {
      client_id: this.clientFilterId() ?? undefined,
      status: this.statusFilter() || undefined,
      date_from: this.dateFromFilter() || undefined,
      date_to: this.dateToFilter() || undefined,
    });
  }

  onClientFilterSearchInput(value: string): void {
    this.clientFilterSearch.set(value);
    clearTimeout(this.clientSearchTimeout);
    this.clientSearchTimeout = setTimeout(() => this.clientsStore.load(1, value), 300);
  }

  selectClientFilter(client: Client): void {
    // Ver o mesmo comentário em order-form.page.ts::selectClient — sem isso, uma busca ainda em
    // voo pode substituir a lista de clientes depois da seleção.
    clearTimeout(this.clientSearchTimeout);
    this.clientFilterId.set(client.id);
    this.clientFilterSearch.set('');
    this.applyFilters();
  }

  clearClientFilter(): void {
    this.clientFilterId.set(null);
    this.applyFilters();
  }

  onStatusFilterChange(value: string): void {
    this.statusFilter.set(value as OrderStatus | '');
    this.applyFilters();
  }

  onDateFromChange(value: string): void {
    this.dateFromFilter.set(value);
    this.applyFilters();
  }

  onDateToChange(value: string): void {
    this.dateToFilter.set(value);
    this.applyFilters();
  }

  goToPage(page: number): void {
    this.store.load(page, this.store.filters());
  }

  requestCancel(id: string, number: number | undefined): void {
    this.pendingCancel.set({ id, number: number ?? 0 });
    this.cancelDialog().open();
  }

  async confirmCancel(): Promise<void> {
    const pending = this.pendingCancel();
    if (!pending) return;

    this.canceling.set(true);
    try {
      await this.store.changeStatus(pending.id, 'canceled');
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

  // Um de cada vez: um segundo clique enquanto o primeiro gera abriria outra aba em branco.
  async downloadPdf(id: string): Promise<void> {
    if (this.pdfBusyId()) return;

    this.pdfBusyId.set(id);
    try {
      await openOrderPdf(this.store, id);
    } catch {
      toast.error('Não foi possível gerar o PDF da OS.');
    } finally {
      this.pdfBusyId.set(null);
    }
  }
}
