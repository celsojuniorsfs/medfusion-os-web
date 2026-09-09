import { CdkMenuModule } from '@angular/cdk/menu';
import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthSessionStore } from '../auth/auth-session.store';

interface NavItem {
  path: string;
  label: string;
  icon: string;
}

/**
 * Layout das rotas autenticadas — header fixo + sidebar de navegação, no lugar da barra única
 * anterior. Estrutura inspirada no design system de referência do cliente (header + sidebar
 * fixa + conteúdo em cards).
 */
@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    CdkMenuModule,
    LucideAngularModule,
  ],
  templateUrl: './shell.component.html',
})
export class ShellComponent {
  protected readonly auth = inject(AuthSessionStore);

  protected readonly navItems: NavItem[] = [
    { path: '/clients', label: 'Clientes', icon: 'users' },
    { path: '/orders', label: 'Ordens de Serviço', icon: 'clipboard-list' },
  ];

  protected readonly userInitial = computed(() => this.auth.user()?.name?.charAt(0).toUpperCase() ?? '?');
}
