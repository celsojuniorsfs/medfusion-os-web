import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toast } from '@spartan-ng/brain/sonner';
import { components } from '../../../core/api-types';
import { CardComponent } from '../../../shared/ui/card.component';
import { SpinnerComponent } from '../../../shared/ui/spinner.component';
import { Accessory, accessoryMatchesSearch } from '../data-access/accessories';
import { AccessoriesStore } from '../data-access/accessories.store';
import { EquipmentModel, equipmentModelLabel, equipmentModelMatchesSearch } from '../data-access/equipment-models';
import { EquipmentModelsStore } from '../data-access/equipment-models.store';
import { EquipmentsStore } from '../data-access/equipments.store';

type EquipmentInput = components['schemas']['EquipmentInput'];

/**
 * Uma linha da lista de acessórios selecionados neste equipamento, antes de salvar — mesmo
 * formato de `components['schemas']['EquipmentAccessory']`, só que `name`/`quantity` sempre
 * preenchidos aqui (o schema gerado marca os dois como opcionais só porque descreve o formato
 * de entrada E saída ao mesmo tempo).
 */
interface SelectedAccessory {
  accessory_id?: string;
  name: string;
  quantity: number;
}

/**
 * Uma tela só pra criar e editar, mesmo padrão de client-form.page. Sem toTitleCase em nenhum
 * campo — nome/marca/modelo/N-S de equipamento costumam ser códigos alfanuméricos (ex.: um N/S
 * "AB12cd") onde recapitalizar destruiria o valor.
 *
 * Não há GET de um equipamento isolado na API (só index/store/update/destroy, ver openapi.yaml) —
 * carrega a lista inteira do cliente e procura o equipamento nela, o que também é exatamente o que
 * o aviso de N/S duplicado precisa de qualquer forma.
 */
@Component({
  selector: 'app-equipment-form-page',
  imports: [ReactiveFormsModule, RouterLink, CardComponent, SpinnerComponent],
  templateUrl: './equipment-form.page.html',
})
export class EquipmentFormPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(EquipmentsStore);
  protected readonly accessoriesStore = inject(AccessoriesStore);
  protected readonly equipmentModelsStore = inject(EquipmentModelsStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly clientId = this.route.snapshot.paramMap.get('id')!;
  protected readonly equipmentId = signal<string | null>(this.route.snapshot.paramMap.get('equipmentId'));
  protected readonly isEditing = computed(() => this.equipmentId() !== null);
  protected readonly initialLoading = signal(false);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly duplicateSerialWarning = signal(false);

  // Modelo do equipamento (api#101/web#92): o catálogo global de modelos, reaproveitável entre
  // clientes. Escolher um modelo preenche nome/marca/modelo de uma vez — o pedido do cliente era
  // parar de redigitar isso a cada aparelho. Fora do form reativo, mesmo raciocínio dos acessórios.
  //
  // `null` aqui não quer dizer "sem modelo": quer dizer que o técnico está digitando à mão em vez
  // de escolher do catálogo. A API resolve pelo trio nome/marca/modelo e cadastra a entrada nova se
  // precisar (ver EquipmentController::resolveEquipmentModel) — ou seja, todo equipamento acaba
  // ligado ao catálogo de um jeito ou de outro.
  protected readonly equipmentModelId = signal<string | null>(null);
  protected readonly equipmentModelSearch = signal('');

  protected readonly filteredEquipmentModels = computed(() =>
    this.equipmentModelsStore
      .entities()
      .filter((equipmentModel) => equipmentModelMatchesSearch(equipmentModel, this.equipmentModelSearch())),
  );

  protected readonly selectedEquipmentModel = computed(() => {
    const id = this.equipmentModelId();
    return id ? (this.equipmentModelsStore.entities().find((model) => model.id === id) ?? null) : null;
  });

  protected readonly equipmentModelLabel = equipmentModelLabel;

  // Acessórios (api#92/web#87): campo de texto único vira uma lista, ligada ao catálogo global
  // reaproveitável entre equipamentos — ver accessories.store.ts. Fora do form reativo de
  // propósito (mesmo estilo já usado pra `personType` em client-form.page): é uma lista dinâmica
  // com busca/adicionar/remover, não um valor único que Validators.required resolveria sozinho.
  protected readonly noAccessories = signal(false);
  protected readonly selectedAccessories = signal<SelectedAccessory[]>([]);
  protected readonly accessorySearch = signal('');
  // Só considera inválido depois que o técnico mexeu em algo — mesmo raciocínio do `.touched`
  // dos outros campos, senão a mensagem apareceria já na primeira renderização da tela de novo.
  protected readonly accessoriesTouched = signal(false);

  protected readonly filteredAccessories = computed(() =>
    this.accessoriesStore.entities().filter((accessory) => accessoryMatchesSearch(accessory, this.accessorySearch())),
  );
  // "Cadastrar novo" só aparece quando o texto digitado não bate com nenhum item do catálogo —
  // senão o técnico digitaria de novo algo que já existe e criaria um duplicado sem querer.
  protected readonly canRegisterNewAccessory = computed(() => {
    const term = this.accessorySearch().trim();
    return term.length > 0 && this.filteredAccessories().length === 0;
  });
  protected readonly accessoriesValid = computed(() => this.noAccessories() || this.selectedAccessories().length > 0);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    // Obrigatórios desde api#92/web#87 — antes eram livres. Achado da issue: o técnico às vezes
    // coloca uma marca (ex.: "Sonopus") no campo de equipamento por falta de organização; marca
    // e modelo obrigatórios ajudam a manter o cadastro consistente.
    brand: ['', Validators.required],
    model: ['', Validators.required],
    serial_number: [''],
    asset_tag: [''],
  });

  async ngOnInit(): Promise<void> {
    this.initialLoading.set(true);

    try {
      await Promise.all([
        this.store.load(this.clientId),
        this.accessoriesStore.load(),
        this.equipmentModelsStore.load(),
      ]);

      const id = this.equipmentId();
      if (!id) return;

      const equipment = this.store.entities().find((e) => e.id === id);
      if (!equipment) {
        this.errorMessage.set('Não foi possível carregar este equipamento.');
        return;
      }

      this.form.patchValue({
        name: equipment.name ?? '',
        brand: equipment.brand ?? '',
        model: equipment.model ?? '',
        serial_number: equipment.serial_number ?? '',
        asset_tag: equipment.asset_tag ?? '',
      });

      this.equipmentModelId.set(equipment.equipment_model_id ?? null);

      const existing = (equipment.accessories ?? []) as SelectedAccessory[];
      this.selectedAccessories.set(existing.map((item) => ({ ...item })));
      this.noAccessories.set(existing.length === 0);
    } catch {
      this.errorMessage.set('Não foi possível carregar os equipamentos deste cliente.');
    } finally {
      this.initialLoading.set(false);
    }
  }

  // Mesma convenção de client-form.page: nunca mostra o texto que a API manda (sem lang/pt_BR
  // publicado, vem em inglês) — só usa as chaves do erro 422 pra saber qual campo destacar.
  serverErrorMessage(field: string): string | null {
    return this.form.get(field)?.hasError('server') ? 'Verifique este campo.' : null;
  }

  onEquipmentModelSearchInput(value: string): void {
    this.equipmentModelSearch.set(value);
  }

  /** Escolher um modelo do catálogo preenche os três campos de uma vez — o ganho que o cliente pediu. */
  selectEquipmentModel(equipmentModel: EquipmentModel): void {
    this.equipmentModelId.set(equipmentModel.id);
    this.form.patchValue({
      name: equipmentModel.name,
      brand: equipmentModel.brand ?? '',
      model: equipmentModel.model ?? '',
    });
    this.equipmentModelSearch.set('');
  }

  /**
   * Chamado quando o técnico digita à mão em nome/marca/modelo: solta o vínculo com a entrada do
   * catálogo, senão o equipment_model_id enviado contradiria o texto que está na tela. A API
   * reresolve pelo trio e cadastra a entrada nova se precisar.
   *
   * Só dispara em digitação de verdade — `patchValue` (que é como selectEquipmentModel preenche os
   * campos) não emite evento de `input` no DOM, então não há risco de ele se desfazer sozinho.
   */
  onModelFieldTyped(): void {
    this.equipmentModelId.set(null);
  }

  onNoAccessoriesChange(checked: boolean): void {
    this.noAccessories.set(checked);
    this.accessoriesTouched.set(true);

    // Marcar "sem acessórios" com itens já escolhidos limparia silenciosamente uma escolha que o
    // técnico fez — mais seguro deixar a lista como está e só escondê-la (ver template); ela some
    // de vez só quando o formulário é enviado com no_accessories marcado.
  }

  onAccessorySearchInput(value: string): void {
    this.accessorySearch.set(value);
  }

  // Escolher uma sugestão do catálogo — se o mesmo acessório já estiver na lista deste
  // equipamento, soma 1 na quantidade em vez de duplicar a linha (confirmado com você).
  selectAccessory(accessory: Accessory): void {
    this.accessoriesTouched.set(true);

    this.selectedAccessories.update((current) => {
      const index = current.findIndex((item) => item.accessory_id === accessory.id);
      if (index === -1) {
        return [...current, { accessory_id: accessory.id, name: accessory.name, quantity: 1 }];
      }

      const updated = [...current];
      updated[index] = { ...updated[index], quantity: updated[index].quantity + 1 };
      return updated;
    });

    this.accessorySearch.set('');
  }

  // "Cadastrar novo" — ainda sem accessory_id (a API resolve/cadastra no catálogo global ao
  // salvar o equipamento, ver EquipmentController::resolveAccessories na API). Compara por nome
  // (sem diferenciar maiúsculas) pra também somar quantidade em vez de duplicar, caso o técnico
  // digite o mesmo nome novo duas vezes antes de salvar.
  registerNewAccessory(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;

    this.accessoriesTouched.set(true);

    this.selectedAccessories.update((current) => {
      const index = current.findIndex((item) => !item.accessory_id && item.name.toLowerCase() === trimmed.toLowerCase());
      if (index === -1) {
        return [...current, { name: trimmed, quantity: 1 }];
      }

      const updated = [...current];
      updated[index] = { ...updated[index], quantity: updated[index].quantity + 1 };
      return updated;
    });

    this.accessorySearch.set('');
  }

  updateAccessoryQuantity(index: number, quantity: number): void {
    if (quantity < 1) return;

    this.selectedAccessories.update((current) => current.map((item, i) => (i === index ? { ...item, quantity } : item)));
  }

  removeAccessory(index: number): void {
    this.accessoriesTouched.set(true);
    this.selectedAccessories.update((current) => current.filter((_, i) => i !== index));
  }

  // Não bloqueia o cadastro — a API aceita N/S duplicado de propósito (ver equipments.store.ts).
  // É só um aviso: número de série às vezes é digitado errado ou fica em branco.
  onSerialNumberBlur(value: string): void {
    const trimmed = value.trim().toLowerCase();

    this.duplicateSerialWarning.set(
      trimmed.length > 0 &&
        this.store
          .entities()
          .some((equipment) => equipment.id !== this.equipmentId() && equipment.serial_number?.trim().toLowerCase() === trimmed),
    );
  }

  async submit(): Promise<void> {
    if (this.loading()) return;

    // Mesmo achado do web#86 em client-form.page: sem isso, clicar em Salvar com marca/modelo
    // nunca tocados não mostra nenhuma mensagem de erro — os spans só aparecem com `.touched`,
    // e o clique no botão em si não marca nada como touched. accessoriesTouched acompanha o
    // mesmo raciocínio pro seletor, que fica fora do form reativo.
    this.accessoriesTouched.set(true);
    if (this.form.invalid || !this.accessoriesValid()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const input: EquipmentInput = {
      ...this.form.getRawValue(),
      equipment_model_id: this.equipmentModelId(),
      no_accessories: this.noAccessories(),
      accessories: this.noAccessories() ? [] : this.selectedAccessories(),
    };
    const id = this.equipmentId();

    try {
      const saved = id
        ? await this.store.update(this.clientId, id, input)
        : await this.store.create(this.clientId, input);

      // Acessórios novos (sem accessory_id antes de salvar) voltam com o id definitivo na
      // resposta — entram no catálogo local pra reaproveitar na mesma sessão sem recarregar.
      // O modelo resolvido pela API (existente ou cadastrado na hora) entra no catálogo local, pra
      // reaproveitar no próximo cadastro da mesma sessão sem recarregar tudo.
      if (saved.equipment_model_id) {
        this.equipmentModelsStore.upsertFromEquipment([
          {
            id: saved.equipment_model_id,
            name: saved.name ?? '',
            brand: saved.brand ?? null,
            model: saved.model ?? null,
          },
        ]);
      }

      const savedAccessories = (saved.accessories ?? []) as SelectedAccessory[];
      this.accessoriesStore.upsertFromEquipment(
        savedAccessories
          .filter((item): item is SelectedAccessory & { accessory_id: string } => !!item.accessory_id)
          .map((item) => ({ id: item.accessory_id, name: item.name })),
      );

      toast.success(id ? 'Equipamento atualizado.' : 'Equipamento cadastrado.');
      await this.router.navigate(['/clients', this.clientId, 'equipamentos']);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 422) {
        for (const field of Object.keys(error.error?.errors ?? {})) {
          this.form.get(field)?.setErrors({ server: true });
          this.form.get(field)?.markAsTouched();
        }
        this.errorMessage.set('Confira os campos destacados.');
      } else {
        this.errorMessage.set('Não foi possível salvar o equipamento. Tente novamente.');
      }
    } finally {
      this.loading.set(false);
    }
  }
}
