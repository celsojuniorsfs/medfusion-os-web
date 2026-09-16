import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toast } from '@spartan-ng/brain/sonner';
import { components } from '../../../core/api-types';
import { CardComponent } from '../../../shared/ui/card.component';
import { SpinnerComponent } from '../../../shared/ui/spinner.component';
import { Accessory, accessoryMatchesSearch } from '../../catalog/data-access/accessories';
import { AccessoriesStore } from '../../catalog/data-access/accessories.store';
import { EquipmentModel, equipmentModelLabel, equipmentModelMatchesSearch } from '../../catalog/data-access/equipment-models';
import { EquipmentModelsStore } from '../../catalog/data-access/equipment-models.store';
import { EquipmentPhotosStore } from '../data-access/equipment-photos.store';
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
 * campo — N/S de equipamento costuma ser código alfanumérico (ex.: "AB12cd") onde recapitalizar
 * destruiria o valor.
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
  protected readonly photosStore = inject(EquipmentPhotosStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly clientId = this.route.snapshot.paramMap.get('id')!;
  protected readonly equipmentId = signal<string | null>(this.route.snapshot.paramMap.get('equipmentId'));
  protected readonly isEditing = computed(() => this.equipmentId() !== null);
  protected readonly initialLoading = signal(false);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly duplicateSerialWarning = signal(false);

  // Fotos (api#102/web#93): registrar como o aparelho chegou, pra não ter divergência na
  // devolução. Num cadastro NOVO o equipamento ainda não tem id, e sem id não há onde pendurar a
  // foto — então os arquivos escolhidos ficam aqui em memória e sobem logo depois que o POST
  // devolve o id (ver submit()). Ao editar, sobem na hora.
  protected readonly pendingPhotos = signal<File[]>([]);

  // Modelo do equipamento (api#101/#109/#112): o catálogo global de modelos, reaproveitável entre
  // clientes. Desde o api#112 a seleção é a ÚNICA forma de vincular um equipamento a um modelo —
  // não existe mais campo de texto pra nome/marca/modelo aqui, nem cadastro implícito ao salvar
  // (fechava a causa-raiz da issue #110). Cadastrar um modelo novo agora só acontece na tela
  // /equipamentos; o link abaixo leva pra lá sem perder o texto já digitado na busca.
  protected readonly equipmentModelId = signal<string | null>(null);
  protected readonly equipmentModelSearch = signal('');
  // Mesmo raciocínio de accessoriesTouched: só considera inválido depois que o técnico tentou
  // salvar, senão a mensagem apareceria já na primeira renderização da tela de edição.
  protected readonly equipmentModelTouched = signal(false);

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
  protected readonly equipmentModelValid = computed(() => this.equipmentModelId() !== null);

  // Preenchido só ao editar um equipamento cadastrado antes do api#112, sem vínculo com o
  // catálogo (o backfill do api#101 não achou correspondência pra ele) — mostra o que já estava
  // salvo enquanto o técnico escolhe um modelo pra migrar o cadastro, exigido pela API no PUT.
  protected readonly legacyEquipmentSnapshot = signal<{ name: string; brand: string | null; model: string | null } | null>(
    null,
  );

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
      if (!id) {
        // Cadastro novo: o store é `providedIn: 'root'`, então sem isso a lista sobrevive da
        // última edição aberta e as fotos de outro equipamento apareceriam aqui.
        this.photosStore.reset();
        return;
      }

      await this.photosStore.load(this.clientId, id);

      const equipment = this.store.entities().find((e) => e.id === id);
      if (!equipment) {
        this.errorMessage.set('Não foi possível carregar este equipamento.');
        return;
      }

      this.form.patchValue({
        serial_number: equipment.serial_number ?? '',
        asset_tag: equipment.asset_tag ?? '',
      });

      this.equipmentModelId.set(equipment.equipment_model_id ?? null);
      if (!equipment.equipment_model_id) {
        this.legacyEquipmentSnapshot.set({
          name: equipment.name ?? '',
          brand: equipment.brand ?? null,
          model: equipment.model ?? null,
        });
      }

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

  /**
   * Editando, sobe na hora. Cadastrando, guarda pra subir depois do POST — sem id do equipamento
   * não existe endpoint pra onde mandar.
   */
  async onPhotosSelected(input: HTMLInputElement): Promise<void> {
    const files = Array.from(input.files ?? []);
    // Limpa o input pra escolher o mesmo arquivo de novo funcionar (o browser não dispara `change`
    // pro mesmo valor duas vezes seguidas).
    input.value = '';
    if (files.length === 0) return;

    const id = this.equipmentId();
    if (!id) {
      this.pendingPhotos.update((current) => [...current, ...files]);
      return;
    }

    for (const file of files) {
      await this.photosStore.upload(this.clientId, id, file);
    }
  }

  removePendingPhoto(index: number): void {
    this.pendingPhotos.update((current) => current.filter((_, i) => i !== index));
  }

  async removePhoto(photoId: string): Promise<void> {
    const id = this.equipmentId();
    if (!id) return;

    await this.photosStore.remove(this.clientId, id, photoId);
  }

  onEquipmentModelSearchInput(value: string): void {
    this.equipmentModelSearch.set(value);
  }

  selectEquipmentModel(equipmentModel: EquipmentModel): void {
    this.equipmentModelTouched.set(true);
    this.equipmentModelId.set(equipmentModel.id);
    this.equipmentModelSearch.set('');
    // A partir daqui o cadastro deixou de ser "legado" — some o aviso de migração, se houver.
    this.legacyEquipmentSnapshot.set(null);
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

    // Mesmo achado do web#86 em client-form.page: sem isso, clicar em Salvar sem o form ter sido
    // tocado não mostra nenhuma mensagem de erro — os spans só aparecem com `.touched`, e o
    // clique no botão em si não marca nada como touched. equipmentModelTouched/accessoriesTouched
    // acompanham o mesmo raciocínio pros dois seletores, que ficam fora do form reativo.
    this.equipmentModelTouched.set(true);
    this.accessoriesTouched.set(true);
    if (this.form.invalid || !this.equipmentModelValid() || !this.accessoriesValid()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const input: EquipmentInput = {
      ...this.form.getRawValue(),
      // equipmentModelValid() já garantiu que não é null.
      equipment_model_id: this.equipmentModelId()!,
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
      const savedAccessories = (saved.accessories ?? []) as SelectedAccessory[];
      this.accessoriesStore.upsertFromEquipment(
        savedAccessories
          .filter((item): item is SelectedAccessory & { accessory_id: string } => !!item.accessory_id)
          .map((item) => ({ id: item.accessory_id, name: item.name })),
      );

      // Fotos escolhidas antes de salvar um equipamento novo: só agora existe id pra pendurá-las.
      // Uma foto recusada aqui não desfaz o cadastro (que já deu certo) — avisa e segue.
      const pending = this.pendingPhotos();
      if (pending.length > 0 && saved.id) {
        const results = await Promise.all(
          pending.map((file) => this.photosStore.upload(this.clientId, saved.id, file)),
        );
        this.pendingPhotos.set([]);

        const failed = results.filter((ok) => !ok).length;
        if (failed > 0) {
          toast.error(`Equipamento salvo, mas ${failed} foto(s) não subiram. Edite o equipamento para tentar de novo.`);
        }
      }

      toast.success(id ? 'Equipamento atualizado.' : 'Equipamento cadastrado.');
      await this.router.navigate(['/clients', this.clientId, 'equipamentos']);
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 422) {
        const errors = error.error?.errors ?? {};
        for (const field of Object.keys(errors)) {
          this.form.get(field)?.setErrors({ server: true });
          this.form.get(field)?.markAsTouched();
        }
        // equipment_model_id não é um FormControl (o seletor fica fora do form reativo) — o caso
        // realista é o modelo escolhido ter sido removido do catálogo entre o carregamento da
        // tela e o envio; solta a seleção pra forçar escolher de novo.
        if (errors['equipment_model_id']) {
          this.equipmentModelId.set(null);
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
