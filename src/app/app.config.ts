import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { LucideClipboardList, LucideStethoscope, LucideUsers, provideLucideIcons } from '@lucide/angular';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    // @lucide/angular não tem mais um módulo único "pick" — cada ícone é seu próprio componente
    // standalone, importado direto no `imports:` de quem usa (ver shell/clients/login). Só os
    // ícones usados *dinamicamente* (nome vindo de uma variável, não fixo no template) precisam
    // estar registrados aqui, pro `LucideDynamicIcon` conseguir resolver pelo nome — hoje só o
    // menu lateral do shell faz isso (`item.icon` vindo do array `navItems`).
    provideLucideIcons(LucideUsers, LucideClipboardList, LucideStethoscope),
  ],
};
