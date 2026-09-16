import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { AuthSessionStore } from '../../../core/auth/auth-session.store';
import { EquipmentModelsStore } from './equipment-models.store';

const TOKEN_KEY = 'medfusion.auth.token';
const BASE_URL = `${environment.apiUrl}/equipment-models`;

const anEquipmentModel = (overrides: Partial<{ id: string; name: string }> = {}) => ({
  id: overrides.id ?? 'em1',
  name: overrides.name ?? 'Ultrassom',
  brand: 'Sonopus',
  model: 'XYZ-100',
});

describe('EquipmentModelsStore', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('load() populates entities on success', async () => {
    const store = TestBed.inject(EquipmentModelsStore);

    const promise = store.load();
    httpMock.expectOne(BASE_URL).flush({ data: [anEquipmentModel()] });
    await promise;

    expect(store.entities()).toHaveLength(1);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('load() sets an error message and clears loading on failure', async () => {
    const store = TestBed.inject(EquipmentModelsStore);

    const promise = store.load();
    httpMock.expectOne(BASE_URL).flush({ message: 'Erro' }, { status: 500, statusText: 'Server Error' });
    await promise;

    expect(store.loading()).toBe(false);
    expect(store.error()).toBe('Não foi possível carregar o catálogo de modelos.');
  });

  it('create() posts the model and adds it to the entities', async () => {
    const store = TestBed.inject(EquipmentModelsStore);

    const promise = store.create({ name: 'Monitor', brand: 'Marca X', model: 'M-1' });
    httpMock
      .expectOne((request) => request.url === BASE_URL && request.method === 'POST')
      .flush({ data: anEquipmentModel({ id: 'em2', name: 'Monitor' }) });

    await expect(promise).resolves.toEqual(expect.objectContaining({ id: 'em2', name: 'Monitor' }));
    expect(store.entities()).toHaveLength(1);
  });

  it('update() puts the model and refreshes the entity', async () => {
    const store = TestBed.inject(EquipmentModelsStore);

    const load = store.load();
    httpMock.expectOne(BASE_URL).flush({ data: [anEquipmentModel()] });
    await load;

    const promise = store.update('em1', { name: 'Ultrassom', brand: 'Sonopus', model: 'XYZ-100 corrigido' });
    httpMock
      .expectOne((request) => request.url === `${BASE_URL}/em1` && request.method === 'PUT')
      .flush({ data: anEquipmentModel({ id: 'em1' }) });
    await promise;

    expect(store.entities()).toHaveLength(1);
  });

  it('remove() takes the model out of the catalog', async () => {
    const store = TestBed.inject(EquipmentModelsStore);

    const load = store.load();
    httpMock.expectOne(BASE_URL).flush({ data: [anEquipmentModel()] });
    await load;

    const promise = store.remove('em1');
    httpMock.expectOne(`${BASE_URL}/em1`).flush(null);
    await promise;

    expect(store.entities()).toHaveLength(0);
  });

  /**
   * remove() não pode engolir o erro — a tela de catálogo depende de ler o status 409 e a
   * mensagem da API pra explicar por que a remoção foi recusada (ver EquipmentsStore.remove()
   * pro mesmo padrão já usado no repo).
   */
  it('remove() propagates the error instead of swallowing it', async () => {
    const store = TestBed.inject(EquipmentModelsStore);

    const load = store.load();
    httpMock.expectOne(BASE_URL).flush({ data: [anEquipmentModel()] });
    await load;

    const promise = store.remove('em1');
    httpMock
      .expectOne(`${BASE_URL}/em1`)
      .flush({ message: 'Este modelo está em uso por equipamentos cadastrados e não pode ser removido.' }, { status: 409, statusText: 'Conflict' });

    await expect(promise).rejects.toBeTruthy();
    expect(store.entities()).toHaveLength(1);
  });

  /** Ver o mesmo teste em accessories/clients/equipments store — achado do code review de 13/09/2026. */
  it('resets itself automatically when the session becomes unauthenticated (logout)', async () => {
    localStorage.setItem(TOKEN_KEY, 'token-valido');
    const auth = TestBed.inject(AuthSessionStore);
    const store = TestBed.inject(EquipmentModelsStore);

    const promise = store.load();
    httpMock.expectOne(BASE_URL).flush({ data: [anEquipmentModel()] });
    await promise;
    expect(store.entities()).toHaveLength(1);

    auth.clearSession();
    TestBed.flushEffects();

    expect(store.entities()).toHaveLength(0);
  });
});
