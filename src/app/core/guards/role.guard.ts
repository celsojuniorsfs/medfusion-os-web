import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthSessionStore } from '../auth/auth-session.store';
import { UserRole } from '../auth/user-role';

/** Só deixa passar quem tem um dos papéis; os demais voltam pra tela inicial. */
export const roleGuard =
  (...roles: UserRole[]): CanActivateFn =>
  () => {
    const role = inject(AuthSessionStore).user()?.role;

    return role !== undefined && roles.includes(role)
      ? true
      : inject(Router).createUrlTree(['/clients']);
  };
