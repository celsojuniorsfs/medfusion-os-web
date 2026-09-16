import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { AuthSessionStore } from '../../../core/auth/auth-session.store';
import { EquipmentModelsStore } from './equipment-models.store';

const TOKEN_KEY = 'medfusion.auth.token';

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
    httpMock.expectOne(`${environment.apiUrl}/equipment-models`).flush({ data: [anEquipmentModel()] });
    await promise;

    expect(store.entities()).toHaveLength(1);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('load() sets an error message and clears loading on failure', async () => {
    const store = TestBed.inject(EquipmentModelsStore);

    const promise = store.load();
    httpMock
      .expectOne(`${environment.apiUrl}/equipment-models`)
      .flush({ message: 'Erro' }, { status: 500, statusText: 'Server Error' });
    await promise;

    expect(store.loading()).toBe(false);
    expect(store.error()).toBe('Não foi possível carregar o catálogo de modelos.');
  });

  /** O caso que motivou upsert em vez de add: a API reaproveita a entrada quando o trio bate, então
   * o modelo que volta de um equipamento salvo pode já estar no catálogo local. */
  it('upsertFromEquipment() does not duplicate a model already in the catalog', async () => {
    const store = TestBed.inject(EquipmentModelsStore);

    const promise = store.load();
    httpMock.expectOne(`${environment.apiUrl}/equipment-models`).flush({ data: [anEquipmentModel()] });
    await promise;

    store.upsertFromEquipment([{ id: 'em1', name: 'Ultrassom', brand: 'Sonopus', model: 'XYZ-100' }]);

    expect(store.entities()).toHaveLength(1);
  });

  /** Ver o mesmo teste em accessories/clients/equipments store — achado do code review de 13/09/2026. */
  it('resets itself automatically when the session becomes unauthenticated (logout)', async () => {
    localStorage.setItem(TOKEN_KEY, 'token-valido');
    const auth = TestBed.inject(AuthSessionStore);
    const store = TestBed.inject(EquipmentModelsStore);

    const promise = store.load();
    httpMock.expectOne(`${environment.apiUrl}/equipment-models`).flush({ data: [anEquipmentModel()] });
    await promise;
    expect(store.entities()).toHaveLength(1);

    auth.clearSession();
    TestBed.flushEffects();

    expect(store.entities()).toHaveLength(0);
  });
});
