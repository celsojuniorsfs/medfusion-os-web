import { BreakpointObserver } from '@angular/cdk/layout';
import { CdkMenuModule } from '@angular/cdk/menu';
import { Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { LucideChevronDown, LucideDynamicIcon, LucideLogOut, LucideMenu, LucideX } from '@lucide/angular';
import { map } from 'rxjs';
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
    LucideMenu,
    LucideX,
    LucideChevronDown,
    LucideLogOut,
    LucideDynamicIcon,
  ],
  templateUrl: './shell.component.html',
})
export class ShellComponent {
  protected readonly auth = inject(AuthSessionStore);
  private readonly breakpointObserver = inject(BreakpointObserver);

  private readonly menuButton = viewChild.required<ElementRef<HTMLButtonElement>>('menuButton');
  private readonly nav = viewChild<ElementRef<HTMLElement>>('nav');

  protected readonly navItems: NavItem[] = [
    { path: '/clients', label: 'Clientes', icon: 'users' },
    { path: '/orders', label: 'Ordens de Serviço', icon: 'clipboard-list' },
  ];

  protected readonly userInitial = computed(() => this.auth.user()?.name?.charAt(0).toUpperCase() ?? '?');

  // Sidebar vira um drawer abaixo de md (768px) — escondido por padrão, aberto pelo hambúrguer do
  // header. Acima de md continua sempre visível (ver shell.component.html).
  protected readonly sidebarOpen = signal(false);

  // Achado do code review de 13/09/2026: o drawer não tinha Esc pra fechar nem trap de foco —
  // um usuário de teclado conseguia dar Tab pra fora do drawer aberto e cair no conteúdo atrás
  // do backdrop. `inert` no <aside> quando fechado no mobile tira os links do drawer da ordem de
  // tabulação (sem afetar o desktop, onde o drawer não existe como conceito — sempre visível).
  // BreakpointObserver (não CSS puro) porque `inert` é uma propriedade do DOM, não algo que uma
  // media query CSS consiga alternar.
  private readonly isMobile = toSignal(
    this.breakpointObserver.observe('(max-width: 767.98px)').pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  protected readonly sidebarInert = computed(() => this.isMobile() && !this.sidebarOpen());

  protected toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);

    if (this.sidebarOpen()) {
      // Foco vai pro primeiro link assim que o drawer abre — sem isso, o foco fica "perdido" no
      // botão que acabou de sumir atrás do próprio drawer.
      setTimeout(() => this.nav()?.nativeElement.querySelector('a')?.focus());
    }
  }

  protected closeSidebar(): void {
    const wasOpen = this.sidebarOpen();
    this.sidebarOpen.set(false);

    // Devolve o foco pro hambúrguer que abriu o drawer — padrão de diálogo/drawer acessível,
    // não importa se o fechamento veio do Esc, de clicar num link ou do backdrop.
    if (wasOpen) {
      this.menuButton().nativeElement.focus();
    }
  }
}
