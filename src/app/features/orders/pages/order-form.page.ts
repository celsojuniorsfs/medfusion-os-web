import { DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, OnDestroy, OnInit, computed, effect, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toast } from '@spartan-ng/brain/sonner';
import { components } from '../../../core/api-types';
import { CardComponent } from '../../../shared/ui/card.component';
import { SpinnerComponent } from '../../../shared/ui/spinner.component';
import { ClientsStore } from '../../clients/data-access/clients.store';
import { EquipmentsStore } from '../../clients/data-access/equipments.store';
import { todayLocalDate } from '../data-access/local-date';
import { OrdersStore } from '../data-access/orders.store';

type OrderInput = components['schemas']['OrderInput'];
type Client = components['schemas']['Client'] & { id: string };
type Equipment = components['schemas']['Equipment'] & { id: string; client_id: string };
type OrderEquipmentAccessory = components['schemas']['OrderEquipmentAccessory'];

/** Campos comuns a qualquer rascunho de equipamento: os acessórios já adicionados e a linha de
 * entrada ainda não confirmada (nome/quantidade digitados, esperando o "+ Adicionar"). Ficam no
 * PRÓPRIO draft, não num array paralelo indexado por posição — `removeEquipmentDraft(i)` desloca
 * índices, e um estado paralelo separado ficaria associado ao equipamento errado depois disso. */
interface AccessoryEditorState {
  accessories: OrderEquipmentAccessory[];
  newAccessoryName: string;
  newAccessoryQuantity: number;
}

const EMPTY_ACCESSORY_EDITOR: AccessoryEditorState = { accessories: [], newAccessoryName: '', newAccessoryQuantity: 1 };

/** Uma linha "do catálogo do cliente" na lista de equipamentos da OS — vira `{ equipment_id, accessories }`. */
interface ExistingEquipmentDraft extends AccessoryEditorState {
  kind: 'existing';
  equipment_id: string;
  name: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
}

/** Uma linha "novo equipamento" — a API cadastra no catálogo do cliente na mesma chamada. */
interface NewEquipmentDraft extends AccessoryEditorState {
  kind: 'new';
  name: string;
  brand: string;
  model: string;
  serial_number: string;
  asset_tag: string;
}

type EquipmentDraft = ExistingEquipmentDraft | NewEquipmentDraft;

interface ItemDraft {
  quantity: number;
  description: string;
  unit_price: number | null;
}

/**
 * Usado tanto pra travar o equipamento vindo do QR Code quanto pra escolher um da busca. A lista
 * de acessórios começa PRÉ-PREENCHIDA com os acessórios estruturados do catálogo do equipamento
 * (nome + quantidade, sem accessory_id — a OS não referencia o catálogo, é só ponto de partida) —
 * o técnico ajusta/remove livremente a partir daí.
 */
function toExistingDraft(equipment: Equipment): ExistingEquipmentDraft {
  return {
    kind: 'existing',
    equipment_id: equipment.id,
    name: equipment.name ?? '',
    brand: equipment.brand ?? null,
    model: equipment.model ?? null,
    serial_number: equipment.serial_number ?? null,
    ...EMPTY_ACCESSORY_EDITOR,
    accessories: (equipment.accessories ?? []).map((accessory) => ({
      name: accessory.name ?? '',
      quantity: accessory.quantity ?? 1,
    })),
  };
}

/**
 * Nova Ordem de Serviço (web#37/#38/#39 — completa a versão mínima do web#100 com múltiplos
 * equipamentos, peças de reposição/mão de obra e os campos restantes: tipo de atendimento,
 * diagnóstico completo, pagamento e garantia). Conteúdo/copy seguem o mockup de referência em
 * `Telas da Ordem de Serviço.pdf`.
 *
 * Cliente e listas de equipamento/peças/acessórios ficam FORA do form reativo de propósito: são
 * listas dinâmicas com adicionar/remover, não um valor único que `Validators.required` resolveria
 * sozinho — e não existe `FormArray` em nenhum outro lugar deste repositório, então segue-se o
 * precedente de signal-array já estabelecido (`itemDrafts`) em vez de introduzir um padrão novo.
 * Os acessórios de cada equipamento (nome + quantidade, `AccessoryEditorState`) vivem DENTRO do
 * próprio draft daquele equipamento, não no editor de busca-no-catálogo de
 * `equipment-form.page.ts`: ali o acessório referencia o catálogo global (`accessory_id`); aqui é
 * texto livre digitado pra esta OS, sem vínculo nenhum com o catálogo (mesma decisão de sempre ter
 * sido um snapshot, só que agora uma lista em vez de uma string).
 */
@Component({
  selector: 'app-order-form-page',
  imports: [ReactiveFormsModule, RouterLink, CardComponent, SpinnerComponent, DecimalPipe],
  templateUrl: './order-form.page.html',
})
export class OrderFormPage implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(OrdersStore);
  protected readonly clientsStore = inject(ClientsStore);
  protected readonly equipmentsStore = inject(EquipmentsStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly initialLoading = signal(false);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  // Preenchimento via QR Code (web#101): cliente e equipamento chegam travados, sobrando só o
  // resto do formulário. `qrEquipmentNotFound` cobre a etiqueta antiga apontando pra um
  // equipamento já removido do cadastro.
  protected readonly lockedByQr = signal(false);
  protected readonly qrEquipmentNotFound = signal(false);
  private readonly reportedDefectInput = viewChild<ElementRef<HTMLTextAreaElement>>('reportedDefectInput');

  protected readonly clientSearch = signal('');
  protected readonly clientId = signal<string | null>(null);
  protected readonly clientTouched = signal(false);
  private clientSearchTimeout?: ReturnType<typeof setTimeout>;

  protected readonly equipmentSearch = signal('');
  protected readonly loadingEquipments = signal(false);
  protected readonly equipmentDrafts = signal<EquipmentDraft[]>([]);
  protected readonly equipmentsTouched = signal(false);
  protected readonly addingNewEquipment = signal(false);

  protected readonly selectedClient = computed<Client | undefined>(() => {
    const id = this.clientId();
    return id ? this.clientsStore.entities().find((client) => client.id === id) : undefined;
  });

  protected readonly clientValid = computed(() => this.clientId() !== null);
  protected readonly equipmentsValid = computed(() => this.equipmentDrafts().length > 0);

  // Filtro client-side, mesmo raciocínio de equipmentMatchesSearch (features/clients/data-access/
  // equipments.ts) — não importado de lá de propósito: entre features só o *store* é importável
  // (ver README). Exclui equipamentos já adicionados à OS, pra não deixar adicionar duplicado.
  protected readonly filteredEquipments = computed(() => {
    const term = this.equipmentSearch().trim().toLowerCase();
    const addedIds = new Set(
      this.equipmentDrafts()
        .filter((draft): draft is ExistingEquipmentDraft => draft.kind === 'existing')
        .map((draft) => draft.equipment_id),
    );
    const available = this.equipmentsStore.entities().filter((equipment) => !addedIds.has(equipment.id));
    if (!term) return available;

    return available.filter((equipment) =>
      [equipment.name, equipment.brand, equipment.model, equipment.serial_number].some((field) =>
        field?.toLowerCase().includes(term),
      ),
    );
  });

  protected readonly newEquipmentForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    brand: [''],
    model: [''],
    serial_number: [''],
    asset_tag: [''],
  });

  protected readonly itemDrafts = signal<ItemDraft[]>([]);
  protected readonly newItemQuantity = signal(1);
  protected readonly newItemDescription = signal('');
  protected readonly newItemUnitPrice = signal<number | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    number: [1, [Validators.required, Validators.min(1)]],
    date: [todayLocalDate(), Validators.required],
    picked_up: [false],
    warranty: [false],
    technical_training: [false],
    on_site_quote: [false],
    rental: [false],
    reported_defect: [''],
    maintenance_plan: [''],
    notes: [''],
    payment_method: ['', Validators.maxLength(255)],
    warranty_period: ['', Validators.maxLength(255)],
    proposal_validity: ['', Validators.maxLength(255)],
    labor_cost: [null as number | null, Validators.min(0.01)],
  });

  // Precisa de signal (não só ler form.controls.labor_cost.value) pra "Total (calculado)"
  // reagir em tempo real — um computed só re-executa quando um signal que ele lê muda.
  private readonly laborCost = toSignal(this.form.controls.labor_cost.valueChanges, {
    initialValue: this.form.controls.labor_cost.value,
  });

  protected readonly itemsTotal = computed(() =>
    this.itemDrafts().reduce((sum, item) => sum + (item.unit_price ?? 0) * item.quantity, 0),
  );
  protected readonly totalPreview = computed(() => this.itemsTotal() + (this.laborCost() ?? 0));

  // Regra da API (ver OrderRequest): precisa de mão de obra OU ao menos uma peça com preço.
  // Replicada aqui pra dar feedback antes de um 422 do servidor.
  protected readonly budgetTouched = signal(false);
  protected readonly budgetValid = computed(() => {
    if ((this.laborCost() ?? 0) > 0) return true;
    return this.itemDrafts().some((item) => (item.unit_price ?? 0) > 0);
  });

  constructor() {
    // Critério de pronto da web#101: ao entrar pelo QR Code, o cursor já cai no campo de defeito
    // (cliente/equipamento já vêm resolvidos, então é o campo que sobra preencher primeiro).
    effect(() => {
      if (!this.initialLoading() && this.lockedByQr()) {
        this.reportedDefectInput()?.nativeElement.focus();
      }
    });
  }

  async ngOnInit(): Promise<void> {
    this.initialLoading.set(true);

    const equipmentId = this.route.snapshot.paramMap.get('equipmentId');

    try {
      const [number] = await Promise.all([
        this.store.nextNumber(),
        equipmentId ? this.loadFromQrEquipment(equipmentId) : this.clientsStore.load(),
      ]);
      this.form.patchValue({ number });
    } catch {
      this.errorMessage.set('Não foi possível sugerir o número da OS — preencha manualmente.');
    } finally {
      this.initialLoading.set(false);
    }
  }

  private async loadFromQrEquipment(equipmentId: string): Promise<void> {
    try {
      const equipment = await this.equipmentsStore.findOne(equipmentId);
      const client = await this.clientsStore.findOne(equipment.client_id);

      this.lockedByQr.set(true);
      this.clientId.set(client.id);
      this.clientTouched.set(true);
      this.equipmentDrafts.set([toExistingDraft(equipment)]);
      this.equipmentsTouched.set(true);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        this.qrEquipmentNotFound.set(true);
      } else {
        this.errorMessage.set('Não foi possível carregar os dados do equipamento a partir do QR Code.');
      }
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.clientSearchTimeout);
  }

  onClientSearchInput(value: string): void {
    this.clientSearch.set(value);
    clearTimeout(this.clientSearchTimeout);
    this.clientSearchTimeout = setTimeout(() => this.clientsStore.load(1, value), 300);
  }

  async selectClient(client: Client): Promise<void> {
    // Sem isso, uma busca ainda em voo (debounce de 300ms) pode chegar DEPOIS da seleção e
    // substituir a lista de clientes — se o cliente escolhido não estiver nela, `selectedClient()`
    // deixa de achá-lo e a busca reaparece vazia, mesmo com `clientId` continuando setado.
    clearTimeout(this.clientSearchTimeout);
    this.clientTouched.set(true);
    this.clientId.set(client.id);
    this.clientSearch.set('');

    // Trocar de cliente invalida os equipamentos escolhidos antes (eram de outro catálogo).
    this.equipmentDrafts.set([]);
    this.equipmentSearch.set('');

    this.loadingEquipments.set(true);
    try {
      await this.equipmentsStore.load(client.id);
    } finally {
      this.loadingEquipments.set(false);
    }
  }

  changeClient(): void {
    this.clientId.set(null);
    this.equipmentDrafts.set([]);
  }

  onEquipmentSearchInput(value: string): void {
    this.equipmentSearch.set(value);
  }

  selectEquipment(equipment: Equipment): void {
    this.equipmentsTouched.set(true);
    this.equipmentDrafts.update((current) => [...current, toExistingDraft(equipment)]);
    this.equipmentSearch.set('');
  }

  private updateDraft(index: number, fn: (draft: EquipmentDraft) => EquipmentDraft): void {
    this.equipmentDrafts.update((current) => current.map((draft, i) => (i === index ? fn(draft) : draft)));
  }

  updateAccessoryEntry(index: number, patch: Partial<Pick<AccessoryEditorState, 'newAccessoryName' | 'newAccessoryQuantity'>>): void {
    this.updateDraft(index, (draft) => ({ ...draft, ...patch }));
  }

  // Mesmo padrão de merge-por-nome de equipment-form.page.ts (registerNewAccessory): digitar um
  // nome já existente na lista soma na quantidade em vez de criar uma segunda linha duplicada.
  addAccessory(index: number): void {
    this.updateDraft(index, (draft) => {
      const name = draft.newAccessoryName.trim();
      if (!name) return draft;

      const quantity = Math.max(1, Math.floor(draft.newAccessoryQuantity || 1));
      const existingIndex = draft.accessories.findIndex((a) => a.name.toLowerCase() === name.toLowerCase());

      const accessories =
        existingIndex === -1
          ? [...draft.accessories, { name, quantity }]
          : draft.accessories.map((a, i) => (i === existingIndex ? { ...a, quantity: a.quantity + quantity } : a));

      return { ...draft, accessories, newAccessoryName: '', newAccessoryQuantity: 1 };
    });
  }

  // Mesmo padrão de equipment-form.page.ts (updateAccessoryQuantity): ajustar a quantidade de um
  // acessório já adicionado (ex.: o pré-preenchido do catálogo) não deveria exigir remover e
  // digitar de novo.
  updateAccessoryQuantity(index: number, accessoryIndex: number, quantity: number): void {
    if (quantity < 1) return;

    this.updateDraft(index, (draft) => ({
      ...draft,
      accessories: draft.accessories.map((a, j) => (j === accessoryIndex ? { ...a, quantity } : a)),
    }));
  }

  removeAccessory(index: number, accessoryIndex: number): void {
    this.updateDraft(index, (draft) => ({
      ...draft,
      accessories: draft.accessories.filter((_, j) => j !== accessoryIndex),
    }));
  }

  removeEquipmentDraft(index: number): void {
    this.equipmentsTouched.set(true);
    this.equipmentDrafts.update((current) => current.filter((_, i) => i !== index));
  }

  toggleAddNewEquipment(): void {
    this.addingNewEquipment.update((current) => !current);
  }

  confirmNewEquipment(): void {
    if (this.newEquipmentForm.invalid) {
      this.newEquipmentForm.markAllAsTouched();
      return;
    }

    this.equipmentsTouched.set(true);
    const raw = this.newEquipmentForm.getRawValue();
    this.equipmentDrafts.update((current) => [...current, { kind: 'new', ...raw, ...EMPTY_ACCESSORY_EDITOR }]);
    this.newEquipmentForm.reset({ name: '', brand: '', model: '', serial_number: '', asset_tag: '' });
    this.addingNewEquipment.set(false);
  }

  addItem(): void {
    const description = this.newItemDescription().trim();
    if (!description) return;

    // `unit_price` negativo/zero vira `null` (mesmo tratamento de "sem preço" já usado pra peça
    // embutida) — sem isso, um valor negativo digitado aqui derrubava o "Total (calculado)".
    const quantity = Math.max(1, this.newItemQuantity());
    const unitPrice = this.newItemUnitPrice();
    const safeUnitPrice = unitPrice !== null && unitPrice > 0 ? unitPrice : null;

    this.itemDrafts.update((current) => [...current, { quantity, description, unit_price: safeUnitPrice }]);
    this.newItemQuantity.set(1);
    this.newItemDescription.set('');
    this.newItemUnitPrice.set(null);
  }

  removeItem(index: number): void {
    this.itemDrafts.update((current) => current.filter((_, i) => i !== index));
  }

  serverErrorMessage(field: string): string | null {
    return this.form.get(field)?.hasError('server') ? 'Verifique este campo.' : null;
  }

  async submit(): Promise<void> {
    if (this.loading()) return;

    this.clientTouched.set(true);
    this.equipmentsTouched.set(true);
    this.budgetTouched.set(true);
    if (this.form.invalid || !this.clientValid() || !this.equipmentsValid() || !this.budgetValid()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();
    const toAccessories = (draft: EquipmentDraft): OrderEquipmentAccessory[] =>
      draft.accessories.map(({ name, quantity }) => ({ name, quantity }));
    const equipments: OrderInput['equipments'] = this.equipmentDrafts().map((draft) =>
      draft.kind === 'existing'
        ? { equipment_id: draft.equipment_id, accessories: toAccessories(draft) }
        : {
            name: draft.name,
            brand: draft.brand.trim() || null,
            model: draft.model.trim() || null,
            serial_number: draft.serial_number.trim() || null,
            asset_tag: draft.asset_tag.trim() || null,
            accessories: toAccessories(draft),
          },
    );
    const items: OrderInput['items'] = this.itemDrafts().map((item) => ({
      quantity: item.quantity,
      description: item.description,
      unit_price: item.unit_price,
    }));

    const input: OrderInput = {
      number: raw.number,
      date: raw.date,
      client_id: this.clientId()!,
      picked_up: raw.picked_up,
      warranty: raw.warranty,
      technical_training: raw.technical_training,
      on_site_quote: raw.on_site_quote,
      rental: raw.rental,
      reported_defect: raw.reported_defect || null,
      maintenance_plan: raw.maintenance_plan || null,
      notes: raw.notes || null,
      payment_method: raw.payment_method || null,
      warranty_period: raw.warranty_period || null,
      proposal_validity: raw.proposal_validity || null,
      labor_cost: raw.labor_cost,
      equipments,
      items,
    };

    try {
      await this.store.create(input);
      toast.success('Ordem de serviço aberta.');
      await this.router.navigate(['/orders']);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 409) {
        this.form.get('number')?.setErrors({ server: true });
        this.errorMessage.set(error.error?.message ?? 'Número de OS já utilizado por outra ordem de serviço.');

        // "Apenas uma sugestão de UI" (api-conventions.md) — sugere outro número na hora, pra não
        // deixar o técnico tentando na mão até acertar um livre.
        try {
          const number = await this.store.nextNumber();
          this.form.patchValue({ number });
        } catch {
          // Sem sugestão nova, o técnico ainda pode digitar outro número manualmente.
        }
      } else if (error instanceof HttpErrorResponse && error.status === 422) {
        const errors = error.error?.errors ?? {};
        // equipments.*/items.*/client_id não são FormControls (as listas ficam fora do form
        // reativo, ver comentário da classe) — `form.get(field)` devolve null pra elas, e sem
        // isso o erro passava em silêncio com a mensagem genérica não destacando nada de verdade.
        let hasUnmatchedListError = false;
        for (const field of Object.keys(errors)) {
          const control = this.form.get(field);
          if (control) {
            control.setErrors({ server: true });
            control.markAsTouched();
          } else if (field.startsWith('equipments.') || field.startsWith('items.') || field === 'client_id') {
            hasUnmatchedListError = true;
          }
        }
        // Nunca mostra o texto que a API manda (sem lang/pt_BR publicado, vem em inglês) — mesma
        // convenção de equipment-form.page.ts: só usa as chaves do 422 pra decidir a mensagem.
        this.errorMessage.set(
          hasUnmatchedListError
            ? 'Confira os equipamentos e peças adicionados — um deles tem um dado inválido.'
            : 'Confira os campos destacados.',
        );
      } else {
        this.errorMessage.set('Não foi possível abrir a OS. Tente novamente.');
      }
    } finally {
      this.loading.set(false);
    }
  }
}
