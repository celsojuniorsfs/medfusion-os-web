import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { toast } from '@spartan-ng/brain/sonner';
import { components } from '../../../core/api-types';
import { CardComponent } from '../../../shared/ui/card.component';
import { SpinnerComponent } from '../../../shared/ui/spinner.component';
import { ClientsStore } from '../../clients/data-access/clients.store';
import { EquipmentsStore } from '../../clients/data-access/equipments.store';
import { OrdersStore } from '../data-access/orders.store';

type OrderInput = components['schemas']['OrderInput'];
type Client = components['schemas']['Client'] & { id: string };
type Equipment = components['schemas']['Equipment'] & { id: string };

/**
 * Versão mínima da Nova OS (v1 do recurso de reconhecimento de equipamento por QR Code, ver
 * web#100): número sugerido, data, cliente + equipamento, defeito relatado, acessórios (texto
 * livre — snapshot desta OS, não o catálogo estruturado) e mão de obra. Sem os 5 booleanos, sem
 * múltiplos itens, sem forma de pagamento — ficam pra uma etapa seguinte.
 *
 * Cliente e equipamento ficam FORA do form reativo de propósito, mesmo padrão de
 * equipment-form.page.ts pro seletor de modelo: são um autocomplete com busca, não um valor
 * único que Validators.required resolveria sozinho.
 */
@Component({
  selector: 'app-order-form-page',
  imports: [ReactiveFormsModule, RouterLink, CardComponent, SpinnerComponent],
  templateUrl: './order-form.page.html',
})
export class OrderFormPage implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(OrdersStore);
  protected readonly clientsStore = inject(ClientsStore);
  protected readonly equipmentsStore = inject(EquipmentsStore);
  private readonly router = inject(Router);

  protected readonly initialLoading = signal(false);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly clientSearch = signal('');
  protected readonly clientId = signal<string | null>(null);
  protected readonly clientTouched = signal(false);
  private clientSearchTimeout?: ReturnType<typeof setTimeout>;

  protected readonly equipmentSearch = signal('');
  protected readonly equipmentId = signal<string | null>(null);
  protected readonly equipmentTouched = signal(false);
  protected readonly loadingEquipments = signal(false);

  protected readonly selectedClient = computed<Client | undefined>(() => {
    const id = this.clientId();
    return id ? this.clientsStore.entities().find((client) => client.id === id) : undefined;
  });

  protected readonly selectedEquipment = computed<Equipment | undefined>(() => {
    const id = this.equipmentId();
    return id ? this.equipmentsStore.entities().find((equipment) => equipment.id === id) : undefined;
  });

  protected readonly clientValid = computed(() => this.clientId() !== null);
  protected readonly equipmentValid = computed(() => this.equipmentId() !== null);

  // Filtro client-side, mesmo raciocínio de equipmentMatchesSearch (features/clients/data-access/
  // equipments.ts) — não importado de lá de propósito: entre features só o *store* é importável
  // (ver README), o resto do data-access de outra feature não é superfície pública.
  protected readonly filteredEquipments = computed(() => {
    const term = this.equipmentSearch().trim().toLowerCase();
    const all = this.equipmentsStore.entities();
    if (!term) return all;

    return all.filter((equipment) =>
      [equipment.name, equipment.brand, equipment.model, equipment.serial_number].some((field) =>
        field?.toLowerCase().includes(term),
      ),
    );
  });

  protected readonly form = this.fb.nonNullable.group({
    number: [1, [Validators.required, Validators.min(1)]],
    date: [new Date().toISOString().slice(0, 10), Validators.required],
    reported_defect: [''],
    accessories: ['', Validators.maxLength(255)],
    labor_cost: [null as number | null, [Validators.required, Validators.min(0.01)]],
  });

  async ngOnInit(): Promise<void> {
    this.initialLoading.set(true);

    try {
      const [number] = await Promise.all([this.store.nextNumber(), this.clientsStore.load()]);
      this.form.patchValue({ number });
    } catch {
      this.errorMessage.set('Não foi possível sugerir o número da OS — preencha manualmente.');
    } finally {
      this.initialLoading.set(false);
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
    this.clientTouched.set(true);
    this.clientId.set(client.id);
    this.clientSearch.set('');

    // Trocar de cliente invalida o equipamento escolhido antes (era de outro catálogo).
    this.equipmentId.set(null);
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
    this.equipmentId.set(null);
  }

  onEquipmentSearchInput(value: string): void {
    this.equipmentSearch.set(value);
  }

  selectEquipment(equipment: Equipment): void {
    this.equipmentTouched.set(true);
    this.equipmentId.set(equipment.id);
    this.equipmentSearch.set('');
  }

  serverErrorMessage(field: string): string | null {
    return this.form.get(field)?.hasError('server') ? 'Verifique este campo.' : null;
  }

  async submit(): Promise<void> {
    if (this.loading()) return;

    this.clientTouched.set(true);
    this.equipmentTouched.set(true);
    if (this.form.invalid || !this.clientValid() || !this.equipmentValid()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();
    const input: OrderInput = {
      number: raw.number,
      date: raw.date,
      client_id: this.clientId()!,
      picked_up: false,
      warranty: false,
      technical_training: false,
      on_site_quote: false,
      rental: false,
      reported_defect: raw.reported_defect || null,
      labor_cost: raw.labor_cost,
      equipments: [{ equipment_id: this.equipmentId()!, accessories: raw.accessories || null }],
      items: [],
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
        for (const field of Object.keys(errors)) {
          this.form.get(field)?.setErrors({ server: true });
          this.form.get(field)?.markAsTouched();
        }
        this.errorMessage.set('Confira os campos destacados.');
      } else {
        this.errorMessage.set('Não foi possível abrir a OS. Tente novamente.');
      }
    } finally {
      this.loading.set(false);
    }
  }
}
