import { HttpClient } from '@angular/common/http';
import { computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { components } from '../api-types';

type User = components['schemas']['User'];

interface LoginResponse {
  token: string;
  user: User;
}

interface AuthSessionState {
  user: User | null;
  token: string | null;
}

const TOKEN_KEY = 'medfusion.auth.token';

/**
 * Sessão do usuário autenticado — usada pelo authInterceptor, authGuard e pelo shell (core/).
 * Login/logout/me contra POST/GET /auth/* (ver openapi.yaml, tag auth). `token` fica no state
 * (não só em localStorage) para que o interceptor leia um signal em vez de tocar o navegador a
 * cada requisição; localStorage é só a persistência entre reloads.
 *
 * Equivalente do lado do front ao módulo Identity do backend: aqui não há agregado nem
 * projeção — o SignalStore já É o "read model" da sessão, e os métodos abaixo são os comandos.
 */
export const AuthSessionStore = signalStore(
  { providedIn: 'root' },
  withState<AuthSessionState>(() => ({
    user: null,
    token: localStorage.getItem(TOKEN_KEY),
  })),
  withComputed(({ user }) => ({
    isAuthenticated: computed(() => user() !== null),
  })),
  withMethods((store, http = inject(HttpClient), router = inject(Router)) => ({
    async login(email: string, password: string): Promise<void> {
      const response = await firstValueFrom(
        http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, { email, password }),
      );

      localStorage.setItem(TOKEN_KEY, response.token);
      patchState(store, { user: response.user, token: response.token });
    },

    /**
     * Carrega o usuário autenticado a partir do token já salvo (ex.: ao recarregar a página).
     * Retorna false silenciosamente se não houver token ou se ele não for mais válido.
     */
    async restoreSession(): Promise<boolean> {
      if (!store.token()) return false;

      try {
        const response = await firstValueFrom(
          http.get<{ data: User }>(`${environment.apiUrl}/auth/me`),
        );
        patchState(store, { user: response.data });
        return true;
      } catch {
        this.clearSession();
        return false;
      }
    },

    async logout(): Promise<void> {
      try {
        await firstValueFrom(http.post(`${environment.apiUrl}/auth/logout`, {}));
      } finally {
        this.clearSession();
        router.navigateByUrl('/login');
      }
    },

    /** Chamado pelo authInterceptor quando uma resposta 401 chega — sessão já não é mais válida. */
    clearSession(): void {
      localStorage.removeItem(TOKEN_KEY);
      patchState(store, { user: null, token: null });
    },
  })),
);
