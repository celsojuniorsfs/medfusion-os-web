import { DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucidePlus, LucideScanQrCode } from '@lucide/angular';
import { components } from '../../../core/api-types';
import { CardComponent } from '../../../shared/ui/card.component';
import { PaginationComponent } from '../../../shared/ui/pagination.component';
import { SpinnerComponent } from '../../../shared/ui/spinner.component';
import { ClientsStore } from '../../clients/data-access/clients.store';
import { formatDateBr } from '../data-access/local-date';
import { ORDER_STATUSES, orderStatusBadgeClass, orderStatusLabel } from '../data-access/order-status';
import { OrdersStore } from '../data-access/orders.store';

type Client = components['schemas']['Client'] & { id: string };
type OrderStatus = components['schemas']['OrderStatus'];

/**
 * Listagem de OS (web#42): filtros por cliente/status/data, tabela ordenada por data desc (regra
 * do próprio backend, sem parâmetro de ordenação), paginação — mesmo molde de
 * `features/clients/pages/clients.page.ts`. O filtro de cliente é busca-e-seleciona (produz um
 * `client_id`), não texto livre: `GET /orders` filtra por id, não por nome.
 */
@Component({
  selector: 'app-orders-page',
  imports: [RouterLink, CardComponent, SpinnerComponent, PaginationComponent, DecimalPipe, LucidePlus, LucideScanQrCode],
  templateUrl: './orders.page.html',
})
export class OrdersPage implements OnInit, OnDestroy {
  protected readonly store = inject(OrdersStore);
  protected readonly clientsStore = inject(ClientsStore);
  protected readonly orderStatusLabel = orderStatusLabel;
  protected readonly orderStatusBadgeClass = orderStatusBadgeClass;
  protected readonly formatDateBr = formatDateBr;
  protected readonly statuses = ORDER_STATUSES;

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
}
