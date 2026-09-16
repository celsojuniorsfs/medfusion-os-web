import { Component, OnDestroy, OnInit, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideChevronDown,
  LucideChevronLeft,
  LucideChevronRight,
  LucidePencil,
  LucidePlus,
  LucideSearch,
  LucideStethoscope,
  LucideTrash,
} from '@lucide/angular';
import { toast } from '@spartan-ng/brain/sonner';
import { CardComponent } from '../../../shared/ui/card.component';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog.component';
import { SpinnerComponent } from '../../../shared/ui/spinner.component';
import { ClientsStore } from '../data-access/clients.store';
import { formatTaxId, toTitleCase } from '../data-access/masks';

/**
 * Listagem de clientes: busca (com debounce), paginação, ações de editar/remover. Abaixo de
 * 768px vira um card por cliente (ver clients.page.html) em vez da tabela — cada card controla
 * seu próprio "ver mais" via `expandedIds`, não um toggle global.
 */
@Component({
  selector: 'app-clients-page',
  imports: [
    RouterLink,
    CardComponent,
    ConfirmDialogComponent,
    SpinnerComponent,
    LucidePlus,
    LucideSearch,
    LucidePencil,
    LucideTrash,
    LucideStethoscope,
    LucideChevronLeft,
    LucideChevronRight,
    LucideChevronDown,
  ],
  templateUrl: './clients.page.html',
})
export class ClientsPage implements OnInit, OnDestroy {
  protected readonly store = inject(ClientsStore);
  protected readonly searchInput = signal('');
  protected readonly formatTaxId = formatTaxId;
  protected readonly toTitleCase = toTitleCase;
  protected readonly expandedIds = signal<ReadonlySet<string>>(new Set());
  protected readonly pendingRemoval = signal<{ id: string; name: string } | null>(null);
  protected readonly removing = signal(false);

  private readonly removeDialog = viewChild.required(ConfirmDialogComponent);
  private searchTimeout?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.store.load();
  }

  ngOnDestroy(): void {
    clearTimeout(this.searchTimeout);
  }

  onSearchInput(value: string): void {
    this.searchInput.set(value);
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => this.store.load(1, value), 300);
  }

  goToPage(page: number): void {
    this.store.load(page, this.store.search());
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
      await this.store.remove(pending.id);
      this.removeDialog().close();
      toast.success('Cliente removido.');
    } catch {
      toast.error('Não foi possível remover o cliente — verifique se não há Ordens de Serviço vinculadas a ele.');
    } finally {
      this.removing.set(false);
    }
  }
}
