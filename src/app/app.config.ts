import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, importProvidersFrom, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ChevronDown, ClipboardList, Eye, EyeOff, LoaderCircle, LogOut, LucideAngularModule, Users } from 'lucide-angular';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';

// Ícones registrados uma vez para o app inteiro (lucide-angular) — cada componente só importa
// `LucideAngularModule` (sem `.pick()`, que é só para o registro raiz) e usa `<i-lucide name="...">`.
const icons = { Eye, EyeOff, LoaderCircle, Users, ClipboardList, ChevronDown, LogOut };

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    importProvidersFrom(LucideAngularModule.pick(icons)),
  ],
};
