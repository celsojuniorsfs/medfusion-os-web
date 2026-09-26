import { Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  LucideChevronDown,
  LucideHistory,
  LucidePencil,
  LucidePlus,
  LucideQrCode,
  LucideSearch,
  LucideTrash,
} from '@lucide/angular';
import { toast } from '@spartan-ng/brain/sonner';
import { CardComponent } from '../../../shared/ui/card.component';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog.component';
import { SpinnerComponent } from '../../../shared/ui/spinner.component';
import { ClientsStore } from '../data-access/clients.store';
import { equipmentMatchesSearch, formatAccessories } from '../data-access/equipments';
import { EquipmentsStore } from '../data-access/equipments.store';

/**
 * Catálogo de equipamentos de um cliente — mesmo molde visual de clients.page (cards no mobile,
 * tabela a partir de 768px), mas a busca aqui é client-side (a API não pagina nem busca no
 * servidor pra equipamentos, ver equipments.store.ts) e não há máscaras/toTitleCase: campos de
 * equipamento costumam ser códigos alfanuméricos onde recapitalizar destruiria o valor.
 */
@Component({
  selector: 'app-equipments-page',
  imports: [
    RouterLink,
    CardComponent,
    ConfirmDialogComponent,
    SpinnerComponent,
    LucidePlus,
    LucideSearch,
    LucidePencil,
    LucideTrash,
    LucideChevronDown,
    LucideQrCode,
    LucideHistory,
  ],
  templateUrl: './equipments.page.html',
})
export class EquipmentsPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  protected readonly clientsStore = inject(ClientsStore);
  protected readonly store = inject(EquipmentsStore);

  protected readonly clientId = this.route.snapshot.paramMap.get('id')!;
  protected readonly searchInput = signal('');
  protected readonly expandedIds = signal<ReadonlySet<string>>(new Set());
  protected readonly pendingRemoval = signal<{ id: string; name: string } | null>(null);
  protected readonly removing = signal(false);
  protected readonly pageError = signal<string | null>(null);
  protected readonly formatAccessories = formatAccessories;

  protected readonly filteredEquipments = computed(() =>
    this.store.entities().filter((equipment) => equipmentMatchesSearch(equipment, this.searchInput())),
  );
  protected readonly client = computed(() =>
    this.clientsStore.entities().find((client) => client.id === this.clientId),
  );

  private readonly removeDialog = viewChild.required(ConfirmDialogComponent);

  async ngOnInit(): Promise<void> {
    // findOne() do ClientsStore não tem try/catch próprio (ao contrário do load() do
    // EquipmentsStore) — sem este try/catch aqui, um cliente inexistente/erro de rede virava uma
    // promise rejeitada não tratada, deixando a página com "Catálogo de equipamentos do cliente."
    // genérico e nenhum aviso de erro (ver client() no template, que só cai no fallback quando o
    // cliente não foi carregado).
    try {
      await Promise.all([this.clientsStore.findOne(this.clientId), this.store.load(this.clientId)]);
    } catch {
      this.pageError.set('Não foi possível carregar este cliente.');
    }
  }

  isExpanded(id: string): boolean {
    return this.expandedIds().has(id);
  }

  toggleExpanded(id: string): void {
    this.expandedIds.update((ids) => {
      const next = new Set(ids);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  requestRemove(id: string, name: string): void {
    this.pendingRemoval.set({ id, name });
    this.removeDialog().open();
  }

  async confirmRemove(): Promise<void> {
    const pending = this.pendingRemoval();
    if (!pending) return;

    this.removing.set(true);
    try {
      await this.store.remove(this.clientId, pending.id);
      this.removeDialog().close();
      toast.success('Equipamento removido.');
    } catch {
      // Fecha o diálogo antes do toast — senão o backdrop dele fica por cima da mensagem de erro
      // (ver o mesmo comentário em catalog.page.ts::confirmRemove).
      this.removeDialog().close();
      toast.error('Não foi possível remover o equipamento.');
    } finally {
      this.removing.set(false);
    }
  }
}
