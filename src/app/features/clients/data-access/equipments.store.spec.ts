import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { AuthSessionStore } from '../../../core/auth/auth-session.store';
import { EquipmentsStore } from './equipments.store';

const TOKEN_KEY = 'medfusion.auth.token';
const CLIENT_ID = 'client-1';

const anEquipment = (overrides: Partial<{ id: string; name: string }> = {}) => ({
  id: overrides.id ?? 'e1',
  name: overrides.name ?? 'Bisturi',
});

describe('EquipmentsStore', () => {
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
    const store = TestBed.inject(EquipmentsStore);

    const promise = store.load(CLIENT_ID);
    httpMock
      .expectOne(`${environment.apiUrl}/clients/${CLIENT_ID}/equipments`)
      .flush({ data: [anEquipment()] });
    await promise;

    expect(store.entities()).toHaveLength(1);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('load() sets an error message and clears loading on failure', async () => {
    const store = TestBed.inject(EquipmentsStore);

    const promise = store.load(CLIENT_ID);
    httpMock
      .expectOne(`${environment.apiUrl}/clients/${CLIENT_ID}/equipments`)
      .flush({ message: 'Erro' }, { status: 500, statusText: 'Server Error' });
    await promise;

    expect(store.loading()).toBe(false);
    expect(store.error()).toBe('Não foi possível carregar os equipamentos.');
  });

  it('create() adds the returned equipment to the entity collection', async () => {
    const store = TestBed.inject(EquipmentsStore);

    const promise = store.create(CLIENT_ID, { name: 'Monitor' });
    httpMock
      .expectOne(`${environment.apiUrl}/clients/${CLIENT_ID}/equipments`)
      .flush({ data: anEquipment({ id: 'e2', name: 'Monitor' }) });
    await promise;

    expect(store.entities().map((e) => e.id)).toContain('e2');
  });

  it('remove() takes the equipment out of the entity collection', async () => {
    const store = TestBed.inject(EquipmentsStore);

    const loadPromise = store.load(CLIENT_ID);
    httpMock
      .expectOne(`${environment.apiUrl}/clients/${CLIENT_ID}/equipments`)
      .flush({ data: [anEquipment()] });
    await loadPromise;

    const removePromise = store.remove(CLIENT_ID, 'e1');
    httpMock.expectOne(`${environment.apiUrl}/clients/${CLIENT_ID}/equipments/e1`).flush(null);
    await removePromise;

    expect(store.entities()).toHaveLength(0);
  });

  it('reset() clears entities and error/loading state', async () => {
    const store = TestBed.inject(EquipmentsStore);

    const promise = store.load(CLIENT_ID);
    httpMock
      .expectOne(`${environment.apiUrl}/clients/${CLIENT_ID}/equipments`)
      .flush({ data: [anEquipment()] });
    await promise;

    store.reset();

    expect(store.entities()).toHaveLength(0);
    expect(store.error()).toBeNull();
    expect(store.loading()).toBe(false);
  });

  /** Ver o mesmo teste em clients.store.spec.ts — achado do code review de 13/09/2026. */
  it('resets itself automatically when the session becomes unauthenticated (logout)', async () => {
    localStorage.setItem(TOKEN_KEY, 'token-valido');
    const auth = TestBed.inject(AuthSessionStore);
    const store = TestBed.inject(EquipmentsStore);

    const loadPromise = store.load(CLIENT_ID);
    httpMock
      .expectOne(`${environment.apiUrl}/clients/${CLIENT_ID}/equipments`)
      .flush({ data: [anEquipment()] });
    await loadPromise;
    expect(store.entities()).toHaveLength(1);

    auth.clearSession();
    TestBed.flushEffects();

    expect(store.entities()).toHaveLength(0);
  });
});
