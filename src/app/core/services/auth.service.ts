import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { components } from '../api-types';

type User = components['schemas']['User'];

interface LoginResponse {
  token: string;
  user: User;
}

const TOKEN_KEY = 'medfusion.auth.token';

/**
 * Login/logout/me contra POST/GET /auth/* (ver openapi.yaml, tag auth).
 * Token Bearer persistido em localStorage; anexado pelo authInterceptor (core/interceptors).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly currentUserSignal = signal<User | null>(null);
  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  async login(email: string, password: string): Promise<void> {
    const response = await firstValueFrom(
      this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, { email, password }),
    );

    localStorage.setItem(TOKEN_KEY, response.token);
    this.currentUserSignal.set(response.user);
  }

  /**
   * Carrega o usuário autenticado a partir do token já salvo (ex.: ao recarregar a página).
   * Retorna false silenciosamente se não houver token ou se ele não for mais válido.
   */
  async restoreSession(): Promise<boolean> {
    if (!this.token) return false;

    try {
      const response = await firstValueFrom(
        this.http.get<{ data: User }>(`${environment.apiUrl}/auth/me`),
      );
      this.currentUserSignal.set(response.data);
      return true;
    } catch {
      this.clearSession();
      return false;
    }
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${environment.apiUrl}/auth/logout`, {}));
    } finally {
      this.clearSession();
      this.router.navigateByUrl('/login');
    }
  }

  /** Chamado pelo authInterceptor quando uma resposta 401 chega — sessão já não é mais válida. */
  clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.currentUserSignal.set(null);
  }
}
