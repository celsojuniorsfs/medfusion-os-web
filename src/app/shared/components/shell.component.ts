import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

/**
 * Layout das rotas autenticadas — barra superior com navegação e sessão do usuário.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatToolbarModule, MatButtonModule, MatIconModule],
  template: `
    <mat-toolbar color="primary">
      <span class="shell-brand">Med Fusion OS</span>
      <nav class="shell-nav">
        <a mat-button routerLink="/clients" routerLinkActive="shell-nav-active">Clientes</a>
        <a mat-button routerLink="/orders" routerLinkActive="shell-nav-active">Ordens de Serviço</a>
      </nav>
      <span class="shell-spacer"></span>
      @if (auth.currentUser(); as user) {
        <span class="shell-user">{{ user.name }}</span>
      }
      <button mat-icon-button (click)="auth.logout()" aria-label="Sair" title="Sair">
        <mat-icon>logout</mat-icon>
      </button>
    </mat-toolbar>
    <router-outlet />
  `,
  styles: `
    .shell-brand {
      font-weight: 600;
      margin-right: 24px;
    }
    .shell-nav {
      display: flex;
      gap: 4px;
    }
    .shell-nav-active {
      font-weight: 600;
    }
    .shell-spacer {
      flex: 1 1 auto;
    }
    .shell-user {
      margin-right: 8px;
      font-size: 13px;
    }
  `,
})
export class ShellComponent {
  protected readonly auth = inject(AuthService);
}
