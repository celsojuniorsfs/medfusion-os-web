import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideChevronLeft, LucideChevronRight, LucidePencil, LucidePlus, LucideSearch, LucideTrash } from '@lucide/angular';
import { CardComponent } from '../../../shared/ui/card.component';
import { ClientsStore } from '../data-access/clients.store';

/**
 * Listagem de clientes: busca (com debounce), paginação, ações de editar/remover.
 */
@Component({
  selector: 'app-clients-page',
  imports: [
    RouterLink,
    CardComponent,
    LucidePlus,
    LucideSearch,
    LucidePencil,
    LucideTrash,
    LucideChevronLeft,
    LucideChevronRight,
  ],
  templateUrl: './clients.page.html',
})
export class ClientsPage implements OnInit, OnDestroy {
  protected readonly store = inject(ClientsStore);
  protected readonly searchInput = signal('');

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

  async remove(id: string, name: string): Promise<void> {
    if (!confirm(`Remover o cliente "${name}"? Essa ação não pode ser desfeita.`)) {
      return;
    }

    try {
      await this.store.remove(id);
    } catch {
      alert('Não foi possível remover o cliente — verifique se não há Ordens de Serviço vinculadas a ele.');
    }
  }
}
