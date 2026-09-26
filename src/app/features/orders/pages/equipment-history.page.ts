import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideChevronLeft, LucideChevronRight } from '@lucide/angular';
import { components } from '../../../core/api-types';
import { CardComponent } from '../../../shared/ui/card.component';
import { SpinnerComponent } from '../../../shared/ui/spinner.component';
import { EquipmentsStore } from '../../clients/data-access/equipments.store';
import { formatDateBr } from '../data-access/local-date';
import { orderStatusBadgeClass, orderStatusLabel } from '../data-access/order-status';
import { OrdersStore } from '../data-access/orders.store';

type Order = components['schemas']['Order'] & { id: string };
type Equipment = components['schemas']['Equipment'] & { id: string; client_id: string };

/**
 * Histórico de OS de um equipamento (web#58) — critério de aceite em docs/escopo-v1.md § Histórico
 * do equipamento: data, situação e valores (peça e mão de obra) de cada OS anterior deste
 * equipamento específico. Vive em `features/orders/` (não em `features/clients/`) pra poder
 * importar `formatDateBr`/`orderStatusLabel` livremente — só o *store* de outra feature é
 * importável de fora, ver README; dentro da própria feature isso não se aplica.
 *
 * `OrdersStore.loadEquipmentHistory()` não mexe em `entities()`/`page()` do estado principal —
 * por isso a paginação mora só nesta página (signals locais), não no store.
 */
@Component({
  selector: 'app-equipment-history-page',
  imports: [RouterLink, CardComponent, SpinnerComponent, DecimalPipe, LucideChevronLeft, LucideChevronRight],
  templateUrl: './equipment-history.page.html',
})
export class EquipmentHistoryPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly ordersStore = inject(OrdersStore);
  protected readonly equipmentsStore = inject(EquipmentsStore);

  protected readonly equipmentId = this.route.snapshot.paramMap.get('equipmentId')!;
  protected readonly equipment = signal<Equipment | null>(null);
  protected readonly orders = signal<Order[]>([]);
  protected readonly page = signal(1);
  protected readonly lastPage = signal(1);
  protected readonly total = signal(0);

  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly orderStatusLabel = orderStatusLabel;
  protected readonly orderStatusBadgeClass = orderStatusBadgeClass;
  protected readonly formatDateBr = formatDateBr;

  async ngOnInit(): Promise<void> {
    this.loading.set(true);

    try {
      const [equipment] = await Promise.all([
        this.equipmentsStore.findOne(this.equipmentId),
        this.loadPage(1),
      ]);
      this.equipment.set(equipment);
    } catch {
      this.errorMessage.set('Não foi possível carregar o histórico deste equipamento.');
    } finally {
      this.loading.set(false);
    }
  }

  async goToPage(page: number): Promise<void> {
    this.loading.set(true);
    try {
      await this.loadPage(page);
    } catch {
      this.errorMessage.set('Não foi possível carregar o histórico deste equipamento.');
    } finally {
      this.loading.set(false);
    }
  }

  /** Peças = total - mão de obra — o backend já garante esse invariante (OrderProjector). */
  protected partsValue(order: Order): number {
    return (order.total ?? 0) - (order.labor_cost ?? 0);
  }

  private async loadPage(page: number): Promise<void> {
    const response = await this.ordersStore.loadEquipmentHistory(this.equipmentId, page);

    this.orders.set(response.data ?? []);
    this.page.set(response.meta?.current_page ?? 1);
    this.lastPage.set(response.meta?.last_page ?? 1);
    this.total.set(response.meta?.total ?? 0);
  }
}
