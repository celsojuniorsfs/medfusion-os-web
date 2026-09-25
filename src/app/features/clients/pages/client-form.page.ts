import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideStethoscope } from '@lucide/angular';
import { toast } from '@spartan-ng/brain/sonner';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { components } from '../../../core/api-types';
import { CardComponent } from '../../../shared/ui/card.component';
import { SpinnerComponent } from '../../../shared/ui/spinner.component';
import { BRAZILIAN_STATES } from '../data-access/brazilian-states';
import { ClientsStore } from '../data-access/clients.store';
import { formatCep, formatPhone, formatTaxId, toTitleCase } from '../data-access/masks';

type PersonType = 'individual' | 'company';
type ClientInput = components['schemas']['ClientInput'];
type TitleCaseField = 'name' | 'trade_name' | 'requester' | 'department' | 'address' | 'city';

// A API não tem lang/pt_BR publicado (só APP_LOCALE=pt_BR no .env, sem arquivo de tradução) — as
// mensagens de validação sem `messages()` customizado na FormRequest voltam em inglês. Por isso
// nunca mostramos o texto que a API manda: usamos só as CHAVES do JSON de erro (nomes de campo,
// não traduzidos) pra saber o que destacar, com mensagens em português escritas por nós.
const SERVER_FIELD_MESSAGES: Record<string, string> = {
  person_type: 'Selecione o tipo de pessoa.',
  tax_id: 'CPF/CNPJ inválido ou já cadastrado.',
  email: 'E-mail inválido.',
  phone: 'Informe o telefone.',
  state: 'Estado inválido.',
  postal_code: 'CEP inválido — use 8 dígitos.',
};

/** Campos que a gente usa da resposta do ViaCEP — só o que interessa pro autopreenchimento. */
interface ViaCepAddress {
  logradouro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
}

/**
 * Uma tela só pra criar e editar — os dois formulários são idênticos, só muda se existe um id
 * na rota. Fecha as telas "novo" e "editar" das issues #34/#35.
 */
@Component({
  selector: 'app-client-form-page',
  imports: [ReactiveFormsModule, RouterLink, CardComponent, SpinnerComponent, LucideStethoscope],
  templateUrl: './client-form.page.html',
})
export class ClientFormPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly store = inject(ClientsStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  protected readonly clientId = signal<string | null>(null);
  protected readonly isEditing = computed(() => this.clientId() !== null);
  // `initialLoading` (busca do cliente pra edição) é separado de `loading` (submit) de propósito:
  // se fossem o mesmo sinal, o formulário inteiro sumiria atrás de um spinner no meio de um clique
  // em Salvar — aqui só a busca inicial esconde o form; o submit só desabilita o botão.
  protected readonly initialLoading = signal(false);
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
    phone: ['', Validators.required],
    email: ['', Validators.required],
    address: [''],
    city: [''],
    state: [''],
    postal_code: [''],
  });

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.clientId.set(id);
    this.initialLoading.set(true);

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
      this.initialLoading.set(false);
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
    const formatted = formatCep(value);
    this.form.controls.postal_code.setValue(formatted);

    // Dispara a busca só quando os 8 dígitos ficam completos — não em cada tecla antes disso,
    // nem de novo a cada tecla depois (o CEP já tem tamanho fixo, não faz sentido debounce aqui).
    const digits = formatted.replace(/\D/g, '');
    if (digits.length === 8) {
      void this.fillAddressFromCep(digits);
    }
  }

  // web#86: preenche endereço/cidade/UF a partir do CEP, via GET /cep/{cep} — proxy cacheado da
  // API pro ViaCEP (não chamamos viacep.com.br direto do navegador: o authInterceptor anexaria o
  // Bearer token do técnico numa requisição a um terceiro, achado numa revisão desta sessão).
  // CEP inválido ou não encontrado (`{ erro: true }`) ou falha de rede não trava o formulário —
  // só não preenche nada, o técnico continua podendo digitar o endereço à mão normalmente.
  private async fillAddressFromCep(cep: string): Promise<void> {
    try {
      const result = await firstValueFrom(this.http.get<ViaCepAddress>(`${environment.apiUrl}/cep/${cep}`));

      if (result.erro) return;

      this.form.patchValue({
        address: toTitleCase(result.logradouro ?? ''),
        city: toTitleCase(result.localidade ?? ''),
        state: result.uf ?? '',
      });
    } catch {
      // Sem tratamento de propósito — ver comentário do método acima.
    }
  }

  // Uma conta de e-mail é sempre minúscula (RFC 5321 trata só a parte antes do @ como
  // case-sensitive na teoria, mas nenhum provedor de e-mail de verdade diferencia) — evita
  // cadastros duplicados de fato ("Nome@x.com" vs "nome@x.com") por causa de digitação.
  onEmailInput(value: string): void {
    this.form.controls.email.setValue(value.toLowerCase());
  }

  // Mensagem em português pro campo que a API rejeitou no último submit — some sozinha assim que
  // o usuário mexe de novo no campo (Angular recalcula a validade a partir dos validators reais
  // do controle, nenhum pra a maioria destes, então o erro manual 'server' é descartado).
  serverErrorMessage(field: string): string | null {
    return this.form.get(field)?.hasError('server') ? (SERVER_FIELD_MESSAGES[field] ?? 'Verifique este campo.') : null;
  }

  async submit(): Promise<void> {
    if (this.loading()) return;

    // Achado ao testar web#86: sem isso, clicar em Salvar com um campo obrigatório nunca tocado
    // (ex.: alguém que não passa por telefone/e-mail antes de tentar salvar) não mostra nenhuma
    // mensagem de erro em lugar nenhum — os spans de erro só aparecem com `.touched`, e o clique
    // no botão em si não marca nada como touched. markAllAsTouched() resolve pra todos os campos
    // obrigatórios de uma vez, não só os dois novos.
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

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

      toast.success(id ? 'Cliente atualizado.' : 'Cliente cadastrado.');
      await this.router.navigateByUrl('/clients');
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 422) {
        for (const field of Object.keys(error.error?.errors ?? {})) {
          this.form.get(field)?.setErrors({ server: true });
          this.form.get(field)?.markAsTouched();
        }
        this.errorMessage.set('Confira os campos destacados.');
      } else {
        this.errorMessage.set('Não foi possível salvar o cliente. Tente novamente.');
      }
    } finally {
      this.loading.set(false);
    }
  }
}
