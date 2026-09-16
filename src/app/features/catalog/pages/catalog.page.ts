import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LucidePencil, LucidePlus, LucideTrash } from '@lucide/angular';
import { toast } from '@spartan-ng/brain/sonner';
import { CardComponent } from '../../../shared/ui/card.component';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog.component';
import { SpinnerComponent } from '../../../shared/ui/spinner.component';
import { Accessory } from '../data-access/accessories';
import { AccessoriesStore } from '../data-access/accessories.store';
import { EquipmentModel, equipmentModelLabel } from '../data-access/equipment-models';
import { EquipmentModelsStore } from '../data-access/equipment-models.store';

type Tab = 'modelos' | 'acessorios';

interface PendingRemoval {
  kind: Tab;
  id: string;
  label: string;
}

/**
 * Manutenção dos dois catálogos globais (api#109/#111/#112) — nasceu do pedido do usuário depois
 * de remover um equipamento e ver o modelo dele continuar no seletor: "se eu tenho um catálogo
 * global, precisamos pensar em como o usuário dará manutenção nisso".
 *
 * As entidades são pequenas (3 campos ou 1), então edição é inline por linha, não formulário/rota
 * separado — mesmo raciocínio já aplicado à quantidade de acessório no formulário de equipamento.
 * Remoção reaproveita o `ConfirmDialogComponent` e o fluxo já usado em
 * `features/clients/pages/equipments.page.ts` (`viewChild.required` → `open()` → `confirmRemove()`
 * com toast), com um cuidado a mais: um 409 (entrada em uso) mostra a mensagem da própria API, não
 * um texto genérico — é a informação que explica por que a remoção foi recusada.
 */
@Component({
  selector: 'app-catalog-page',
  imports: [CardComponent, ConfirmDialogComponent, SpinnerComponent, LucidePlus, LucidePencil, LucideTrash],
  templateUrl: './catalog.page.html',
})
export class CatalogPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  protected readonly equipmentModelsStore = inject(EquipmentModelsStore);
  protected readonly accessoriesStore = inject(AccessoriesStore);

  protected readonly equipmentModelLabel = equipmentModelLabel;
  protected readonly activeTab = signal<Tab>('modelos');
  protected readonly pageError = signal<string | null>(null);

  // Criação de modelo — os mesmos três campos que o formulário de equipamento tinha antes do
  // api#112, só que agora moram só aqui.
  protected readonly newModelName = signal('');
  protected readonly newModelBrand = signal('');
  protected readonly newModelModel = signal('');
  protected readonly creatingModel = signal(false);
  protected readonly createModelError = signal<string | null>(null);

  // Edição inline de modelo — null quando nenhuma linha está em edição.
  protected readonly editingModelId = signal<string | null>(null);
  protected readonly editModelName = signal('');
  protected readonly editModelBrand = signal('');
  protected readonly editModelModel = signal('');
  protected readonly savingModelId = signal<string | null>(null);

  // Criação/edição de acessório — um campo só.
  protected readonly newAccessoryName = signal('');
  protected readonly creatingAccessory = signal(false);
  protected readonly createAccessoryError = signal<string | null>(null);
  protected readonly editingAccessoryId = signal<string | null>(null);
  protected readonly editAccessoryName = signal('');
  protected readonly savingAccessoryId = signal<string | null>(null);

  protected readonly pendingRemoval = signal<PendingRemoval | null>(null);
  protected readonly removing = signal(false);
  private readonly removeDialog = viewChild.required(ConfirmDialogComponent);

  async ngOnInit(): Promise<void> {
    // Vindo do link "Cadastre um modelo novo" no formulário de equipamento (equipment-form.page):
    // pré-preenche o nome com o que o técnico já tinha digitado na busca, pra não perder o
    // contexto ao trocar de tela.
    const prefillName = this.route.snapshot.queryParamMap.get('name');
    if (prefillName) {
      this.newModelName.set(prefillName);
    }

    try {
      await Promise.all([this.equipmentModelsStore.load(), this.accessoriesStore.load()]);
    } catch {
      this.pageError.set('Não foi possível carregar o catálogo.');
    }
  }

  async createModel(): Promise<void> {
    const name = this.newModelName().trim();
    const brand = this.newModelBrand().trim();
    const model = this.newModelModel().trim();
    if (!name || !brand || !model) {
      this.createModelError.set('Informe equipamento, marca e modelo.');
      return;
    }

    this.creatingModel.set(true);
    this.createModelError.set(null);
    try {
      await this.equipmentModelsStore.create({ name, brand, model });
      this.newModelName.set('');
      this.newModelBrand.set('');
      this.newModelModel.set('');
      toast.success('Modelo cadastrado.');
    } catch {
      this.createModelError.set('Não foi possível cadastrar o modelo.');
    } finally {
      this.creatingModel.set(false);
    }
  }

  startEditingModel(model: EquipmentModel): void {
    this.editingModelId.set(model.id);
    this.editModelName.set(model.name);
    this.editModelBrand.set(model.brand ?? '');
    this.editModelModel.set(model.model ?? '');
  }

  cancelEditingModel(): void {
    this.editingModelId.set(null);
  }

  async saveModel(id: string): Promise<void> {
    const name = this.editModelName().trim();
    const brand = this.editModelBrand().trim();
    const model = this.editModelModel().trim();
    if (!name || !brand || !model) return;

    this.savingModelId.set(id);
    try {
      await this.equipmentModelsStore.update(id, { name, brand, model });
      this.editingModelId.set(null);
      toast.success('Modelo atualizado — os equipamentos que usam ele já refletem a correção.');
    } catch {
      toast.error('Não foi possível atualizar o modelo.');
    } finally {
      this.savingModelId.set(null);
    }
  }

  requestRemoveModel(model: EquipmentModel): void {
    this.pendingRemoval.set({ kind: 'modelos', id: model.id, label: equipmentModelLabel(model) });
    this.removeDialog().open();
  }

  async createAccessory(): Promise<void> {
    const name = this.newAccessoryName().trim();
    if (!name) {
      this.createAccessoryError.set('Informe o nome do acessório.');
      return;
    }

    this.creatingAccessory.set(true);
    this.createAccessoryError.set(null);
    try {
      await this.accessoriesStore.create(name);
      this.newAccessoryName.set('');
      toast.success('Acessório cadastrado.');
    } catch {
      this.createAccessoryError.set('Não foi possível cadastrar o acessório.');
    } finally {
      this.creatingAccessory.set(false);
    }
  }

  startEditingAccessory(accessory: Accessory): void {
    this.editingAccessoryId.set(accessory.id);
    this.editAccessoryName.set(accessory.name);
  }

  cancelEditingAccessory(): void {
    this.editingAccessoryId.set(null);
  }

  async saveAccessory(id: string): Promise<void> {
    const name = this.editAccessoryName().trim();
    if (!name) return;

    this.savingAccessoryId.set(id);
    try {
      await this.accessoriesStore.update(id, name);
      this.editingAccessoryId.set(null);
      toast.success('Acessório atualizado.');
    } catch {
      toast.error('Não foi possível atualizar o acessório.');
    } finally {
      this.savingAccessoryId.set(null);
    }
  }

  requestRemoveAccessory(accessory: Accessory): void {
    this.pendingRemoval.set({ kind: 'acessorios', id: accessory.id, label: accessory.name });
    this.removeDialog().open();
  }

  async confirmRemove(): Promise<void> {
    const pending = this.pendingRemoval();
    if (!pending) return;

    this.removing.set(true);
    try {
      if (pending.kind === 'modelos') {
        await this.equipmentModelsStore.remove(pending.id);
        toast.success('Modelo removido.');
      } else {
        await this.accessoriesStore.remove(pending.id);
        toast.success('Acessório removido.');
      }
      this.removeDialog().close();
    } catch (error) {
      // 409 = entrada em uso por algum equipamento — a mensagem da própria API já explica isso
      // (ver EquipmentModelController::destroy/AccessoryController::destroy), bem mais útil que
      // um texto genérico.
      if (error instanceof HttpErrorResponse && error.status === 409) {
        toast.error(error.error?.message ?? 'Não foi possível remover: item em uso.');
      } else {
        toast.error('Não foi possível remover.');
      }
    } finally {
      this.removing.set(false);
    }
  }
}
