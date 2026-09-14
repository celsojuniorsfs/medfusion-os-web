import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toast } from '@spartan-ng/brain/sonner';
import { components } from '../../../core/api-types';
import { CardComponent } from '../../../shared/ui/card.component';
import { SpinnerComponent } from '../../../shared/ui/spinner.component';
import { EquipmentsStore } from '../data-access/equipments.store';

type EquipmentInput = components['schemas']['EquipmentInput'];

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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly clientId = this.route.snapshot.paramMap.get('id')!;
  protected readonly equipmentId = signal<string | null>(this.route.snapshot.paramMap.get('equipmentId'));
  protected readonly isEditing = computed(() => this.equipmentId() !== null);
  protected readonly initialLoading = signal(false);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly duplicateSerialWarning = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    // Obrigatórios desde api#92/web#87 — antes eram livres. Achado da issue: o técnico às vezes
    // coloca uma marca (ex.: "Sonopus") no campo de equipamento por falta de organização; marca
    // e modelo obrigatórios ajudam a manter o cadastro consistente.
    brand: ['', Validators.required],
    model: ['', Validators.required],
    serial_number: [''],
    asset_tag: [''],
    accessories: [''],
  });

  async ngOnInit(): Promise<void> {
    this.initialLoading.set(true);

    try {
      await this.store.load(this.clientId);

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
        accessories: equipment.accessories ?? '',
      });
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
    // e o clique no botão em si não marca nada como touched.
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const input: EquipmentInput = this.form.getRawValue();
    const id = this.equipmentId();

    try {
      if (id) {
        await this.store.update(this.clientId, id, input);
      } else {
        await this.store.create(this.clientId, input);
      }

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
