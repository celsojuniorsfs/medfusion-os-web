import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { components } from '../../../core/api-types';
import { CardComponent } from '../../../shared/ui/card.component';
import { BRAZILIAN_STATES } from '../data-access/brazilian-states';
import { ClientsStore } from '../data-access/clients.store';
import { formatCep, formatPhone, formatTaxId, toTitleCase } from '../data-access/masks';

type PersonType = 'individual' | 'company';
type ClientInput = components['schemas']['ClientInput'];
type TitleCaseField = 'name' | 'trade_name' | 'requester' | 'department' | 'address' | 'city';

/**
 * Uma tela só pra criar e editar — os dois formulários são idênticos, só muda se existe um id
 * na rota. Fecha as telas "novo" e "editar" das issues #34/#35.
 */
@Component({
  selector: 'app-client-form-page',
  imports: [ReactiveFormsModule, RouterLink, CardComponent],
  templateUrl: './client-form.page.html',
})
export class ClientFormPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(ClientsStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly clientId = signal<string | null>(null);
  protected readonly isEditing = computed(() => this.clientId() !== null);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly brazilianStates = BRAZILIAN_STATES;

  // Default "company" — a maioria dos clientes cadastra com CNPJ (Augusto, 10/09/2026). O select
  // de tipo de pessoa fica fora do form reativo de propósito (um plain signal, mesmo estilo já
  // usado no componente pra `clientId`/`loading`) pra poder controlar a máscara do CPF/CNPJ e a
  // exibição condicional dos campos de PJ sem trocar pra Angular signal forms.
  protected readonly personType = signal<PersonType>('company');
  protected readonly isCompany = computed(() => this.personType() === 'company');

  protected readonly form = this.fb.nonNullable.group({
    person_type: this.fb.nonNullable.control<PersonType>('company', Validators.required),
    name: ['', Validators.required],
    trade_name: [''],
    tax_id: ['', Validators.required],
    state_registration: [''],
    requester: [''],
    department: [''],
    phone: [''],
    email: [''],
    address: [''],
    city: [''],
    state: [''],
    postal_code: [''],
  });

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.clientId.set(id);
    this.loading.set(true);

    try {
      const client = await this.store.findOne(id);
      const personType = client.person_type ?? 'company';
      this.personType.set(personType);

      this.form.patchValue({
        person_type: personType,
        name: toTitleCase(client.name ?? ''),
        trade_name: toTitleCase(client.trade_name ?? ''),
        tax_id: formatTaxId(client.tax_id ?? '', personType),
        state_registration: client.state_registration ?? '',
        requester: toTitleCase(client.requester ?? ''),
        department: toTitleCase(client.department ?? ''),
        phone: client.phone ?? '',
        email: client.email ?? '',
        address: toTitleCase(client.address ?? ''),
        city: toTitleCase(client.city ?? ''),
        state: client.state ?? '',
        postal_code: formatCep(client.postal_code ?? ''),
      });
    } catch {
      this.errorMessage.set('Não foi possível carregar este cliente.');
    } finally {
      this.loading.set(false);
    }
  }

  onPersonTypeChange(value: PersonType): void {
    this.personType.set(value);
    this.form.controls.person_type.setValue(value);
    this.form.controls.tax_id.setValue(formatTaxId(this.form.controls.tax_id.value, value));

    // Evita mandar lixo de uma seleção anterior de pessoa jurídica.
    if (value === 'individual') {
      this.form.patchValue({ trade_name: '', state_registration: '' });
    }
  }

  onTaxIdInput(value: string): void {
    this.form.controls.tax_id.setValue(formatTaxId(value, this.personType()));
  }

  onTitleCaseBlur(field: TitleCaseField, value: string): void {
    this.form.controls[field].setValue(toTitleCase(value));
  }

  onPhoneInput(value: string): void {
    this.form.controls.phone.setValue(formatPhone(value));
  }

  onPostalCodeInput(value: string): void {
    this.form.controls.postal_code.setValue(formatCep(value));
  }

  // Uma conta de e-mail é sempre minúscula (RFC 5321 trata só a parte antes do @ como
  // case-sensitive na teoria, mas nenhum provedor de e-mail de verdade diferencia) — evita
  // cadastros duplicados de fato ("Nome@x.com" vs "nome@x.com") por causa de digitação.
  onEmailInput(value: string): void {
    this.form.controls.email.setValue(value.toLowerCase());
  }

  async submit(): Promise<void> {
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    // `state` (UF) é uma lista fechada no contrato (schema BrazilianState) — o <select> tem uma
    // opção vazia pra "não informado", que precisa virar `null`, não a string vazia.
    const input: ClientInput = {
      ...this.form.getRawValue(),
      state: (this.form.controls.state.value || null) as ClientInput['state'],
    };
    const id = this.clientId();

    try {
      if (id) {
        await this.store.update(id, input);
      } else {
        await this.store.create(input);
      }

      await this.router.navigateByUrl('/clients');
    } catch (error) {
      this.errorMessage.set(
        error instanceof HttpErrorResponse && error.status === 422
          ? 'Confira os campos destacados.'
          : 'Não foi possível salvar o cliente. Tente novamente.',
      );
    } finally {
      this.loading.set(false);
    }
  }
}
