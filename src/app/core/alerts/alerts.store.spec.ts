import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthSessionStore } from '../auth/auth-session.store';
import { UserRole } from '../auth/user-role';
import { Alert } from './alerts';
import { AlertsStore } from './alerts.store';

const URL = `${environment.apiUrl}/alerts`;

const anAlert = (id: string, overrides: Partial<Alert> = {}): Alert => ({
  id,
  type: 'equipment_revision',
  title: `Alerta ${id}`,
  notified_at: '2026-09-29T12:00:00Z',
  order: { id: 'o1', number: 1, client_name: 'Hospital São Lucas' },
  equipment: { id: 'e1', name: 'Monitor' },
  ...overrides,
});

describe('AlertsStore', () => {
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

  async function signIn(role: UserRole): Promise<void> {
    const promise = TestBed.inject(AuthSessionStore).login('ana@medfusion.example', 'segredo');
    httpMock
      .expectOne(`${environment.apiUrl}/auth/login`)
      .flush({
        token: 'token',
        user: { id: 'u1', name: 'Ana', email: 'ana@medfusion.example', role },
      });
    await promise;
  }

  it('load() populates the entities and the count for an administrative user', async () => {
    await signIn('administrative');
    const store = TestBed.inject(AlertsStore);

    const promise = store.load();
    httpMock.expectOne(URL).flush({ data: [anAlert('a1'), anAlert('a2')] });
    await promise;

    expect(store.count()).toBe(2);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('load() sets an error message on failure', async () => {
    await signIn('general_admin');
    const store = TestBed.inject(AlertsStore);

    const promise = store.load();
    httpMock.expectOne(URL).flush({ message: 'Erro' }, { status: 500, statusText: 'Server Error' });
    await promise;

    expect(store.loading()).toBe(false);
    expect(store.error()).toBe('Não foi possível carregar os alertas.');
  });

  it('load() ignores a stale response that arrives after a newer one', async () => {
    await signIn('administrative');
    const store = TestBed.inject(AlertsStore);

    const first = store.load();
    const second = store.load();
    const [firstRequest, secondRequest] = httpMock.match(URL);

    secondRequest.flush({ data: [anAlert('novo')] });
    await second;
    firstRequest.flush({ data: [anAlert('velho')] });
    await first;

    expect(store.entities().map((alert) => alert.id)).toEqual(['novo']);
  });

  it('load() does not call the API for a technician', async () => {
    await signIn('technician');
    const store = TestBed.inject(AlertsStore);

    await store.load();

    httpMock.expectNone(URL);
    expect(store.count()).toBe(0);
  });

  it('markContacted() patches the alert and drops it from the list', async () => {
    await signIn('administrative');
    const store = TestBed.inject(AlertsStore);
    const loading = store.load();
    httpMock.expectOne(URL).flush({ data: [anAlert('a1'), anAlert('a2')] });
    await loading;

    const promise = store.markContacted('a1');
    const request = httpMock.expectOne(`${URL}/revisions/a1/contacted`);
    expect(request.request.method).toBe('PATCH');
    request.flush({ data: {} });
    await promise;

    expect(store.entities().map((alert) => alert.id)).toEqual(['a2']);
    expect(store.count()).toBe(1);
  });

  it('markContacted() is not undone by a load() that was already in flight', async () => {
    await signIn('administrative');
    const store = TestBed.inject(AlertsStore);
    const firstLoad = store.load();
    httpMock.expectOne(URL).flush({ data: [anAlert('a1'), anAlert('a2')] });
    await firstLoad;

    const staleLoad = store.load();
    const staleRequest = httpMock.expectOne(URL);
    const contacted = store.markContacted('a1');
    httpMock.expectOne(`${URL}/revisions/a1/contacted`).flush({ data: {} });
    await contacted;
    staleRequest.flush({ data: [anAlert('a1'), anAlert('a2')] });
    await staleLoad;

    expect(store.entities().map((alert) => alert.id)).toEqual(['a2']);
    expect(store.loading()).toBe(false);
  });

  it('is emptied when the session ends', async () => {
    await signIn('administrative');
    const store = TestBed.inject(AlertsStore);
    const loading = store.load();
    httpMock.expectOne(URL).flush({ data: [anAlert('a1')] });
    await loading;

    TestBed.inject(AuthSessionStore).clearSession();
    TestBed.flushEffects();

    expect(store.count()).toBe(0);
  });
});
