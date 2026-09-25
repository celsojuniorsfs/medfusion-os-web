import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { AuthSessionStore } from '../../../core/auth/auth-session.store';
import { EquipmentPhotosStore } from './equipment-photos.store';

const TOKEN_KEY = 'medfusion.auth.token';
const CLIENT_ID = 'client-1';
const EQUIPMENT_ID = 'equipment-1';
const PHOTOS_URL = `${environment.apiUrl}/clients/${CLIENT_ID}/equipments/${EQUIPMENT_ID}/photos`;

const aPhoto = (overrides: Partial<{ id: string; original_name: string }> = {}) => ({
  id: overrides.id ?? 'p1',
  equipment_id: EQUIPMENT_ID,
  original_name: overrides.original_name ?? 'entrada.jpg',
  mime_type: 'image/jpeg',
  size: 1024,
  url: `${environment.apiUrl}/equipment-photos/${overrides.id ?? 'p1'}?signature=abc`,
});

describe('EquipmentPhotosStore', () => {
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
    const store = TestBed.inject(EquipmentPhotosStore);

    const promise = store.load(CLIENT_ID, EQUIPMENT_ID);
    httpMock.expectOne(PHOTOS_URL).flush({ data: [aPhoto()] });
    await promise;

    expect(store.entities()).toHaveLength(1);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  /** Fotos são de UM equipamento — abrir outro tem que trocar a lista, não somar. */
  it('load() replaces the previous equipment photos instead of accumulating', async () => {
    const store = TestBed.inject(EquipmentPhotosStore);

    const first = store.load(CLIENT_ID, EQUIPMENT_ID);
    httpMock.expectOne(PHOTOS_URL).flush({ data: [aPhoto(), aPhoto({ id: 'p2' })] });
    await first;
    expect(store.entities()).toHaveLength(2);

    const second = store.load(CLIENT_ID, EQUIPMENT_ID);
    httpMock.expectOne(PHOTOS_URL).flush({ data: [aPhoto({ id: 'p3' })] });
    await second;

    expect(store.entities().map((photo) => photo.id)).toEqual(['p3']);
  });

  it('upload() posts the file and reloads the list', async () => {
    const store = TestBed.inject(EquipmentPhotosStore);

    const file = new File(['conteudo'], 'entrada.jpg', { type: 'image/jpeg' });
    const promise = store.upload(CLIENT_ID, EQUIPMENT_ID, file);

    const post = httpMock.expectOne((request) => request.url === PHOTOS_URL && request.method === 'POST');
    expect(post.request.body instanceof FormData).toBe(true);
    post.flush({ data: aPhoto() });

    // `flush` resolve o observable, mas a continuação do `await` dentro do upload só roda no
    // próximo microtask — sem esperar aqui, o GET do reload ainda não foi disparado e o
    // expectOne abaixo não acha nada.
    await Promise.resolve();

    // O upload recarrega a lista pra garantir URL assinada fresca em todas.
    httpMock.expectOne(PHOTOS_URL).flush({ data: [aPhoto()] });

    await expect(promise).resolves.toBe(true);
    expect(store.entities()).toHaveLength(1);
  });

  /** Devolve false em vez de lançar: a tela sobe vários arquivos de uma vez, e um recusado (8 MB,
   * formato errado) não pode derrubar os outros. */
  it('upload() returns false and sets an error message on failure', async () => {
    const store = TestBed.inject(EquipmentPhotosStore);

    const file = new File(['conteudo'], 'gigante.jpg', { type: 'image/jpeg' });
    const promise = store.upload(CLIENT_ID, EQUIPMENT_ID, file);

    httpMock
      .expectOne((request) => request.url === PHOTOS_URL && request.method === 'POST')
      .flush({ message: 'erro' }, { status: 422, statusText: 'Unprocessable Content' });

    await expect(promise).resolves.toBe(false);
    expect(store.uploading()).toBe(false);
    expect(store.error()).toContain('gigante.jpg');
  });

  it('remove() takes the photo out of the list', async () => {
    const store = TestBed.inject(EquipmentPhotosStore);

    const load = store.load(CLIENT_ID, EQUIPMENT_ID);
    httpMock.expectOne(PHOTOS_URL).flush({ data: [aPhoto()] });
    await load;

    const promise = store.remove(CLIENT_ID, EQUIPMENT_ID, 'p1');
    httpMock.expectOne(`${PHOTOS_URL}/p1`).flush(null);
    await promise;

    expect(store.entities()).toHaveLength(0);
  });

  /** Ver o mesmo teste nos outros stores. */
  it('resets itself automatically when the session becomes unauthenticated (logout)', async () => {
    localStorage.setItem(TOKEN_KEY, 'token-valido');
    const auth = TestBed.inject(AuthSessionStore);
    const store = TestBed.inject(EquipmentPhotosStore);

    const promise = store.load(CLIENT_ID, EQUIPMENT_ID);
    httpMock.expectOne(PHOTOS_URL).flush({ data: [aPhoto()] });
    await promise;
    expect(store.entities()).toHaveLength(1);

    auth.clearSession();
    TestBed.flushEffects();

    expect(store.entities()).toHaveLength(0);
  });
});
