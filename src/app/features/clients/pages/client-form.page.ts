import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CardComponent } from '../../../shared/ui/card.component';
import { ClientsStore } from '../data-access/clients.store';
import { formatCep, formatPhone, formatTaxId } from '../data-access/masks';

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

  protected readonly form = this.fb.nonNullable.group({
    company_name: ['', Validators.required],
    tax_id: ['', Validators.required],
    requester: [''],
    department: [''],
    phone: [''],
    address: [''],
    city: [''],
    postal_code: [''],
  });

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.clientId.set(id);
    this.loading.set(true);

    try {
      const client = await this.store.findOne(id);
      this.form.patchValue({
        company_name: client.company_name,
        tax_id: client.tax_id,
        requester: client.requester ?? '',
        department: client.department ?? '',
        phone: client.phone ?? '',
        address: client.address ?? '',
        city: client.city ?? '',
        postal_code: client.postal_code ?? '',
      });
    } catch {
      this.errorMessage.set('Não foi possível carregar este cliente.');
    } finally {
      this.loading.set(false);
    }
  }

  onTaxIdInput(value: string): void {
    this.form.controls.tax_id.setValue(formatTaxId(value));
  }

  onPhoneInput(value: string): void {
    this.form.controls.phone.setValue(formatPhone(value));
  }

  onPostalCodeInput(value: string): void {
    this.form.controls.postal_code.setValue(formatCep(value));
  }

  async submit(): Promise<void> {
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    const input = this.form.getRawValue();
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
