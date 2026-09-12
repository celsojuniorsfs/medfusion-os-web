import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideEye, LucideEyeOff } from '@lucide/angular';
import { AuthSessionStore } from '../../../core/auth/auth-session.store';
import { SpinnerComponent } from '../../../shared/ui/spinner.component';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, LucideEye, LucideEyeOff, SpinnerComponent],
  templateUrl: './login.page.html',
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthSessionStore);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly hidePassword = signal(true);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  async submit(): Promise<void> {
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    const { email, password } = this.form.getRawValue();

    try {
      await this.auth.login(email, password);
      await this.router.navigateByUrl('/');
    } catch (error) {
      this.errorMessage.set(
        error instanceof HttpErrorResponse && error.status === 401
          ? 'Credenciais inválidas.'
          : 'Não foi possível entrar. Tente novamente.',
      );
    } finally {
      this.loading.set(false);
    }
  }
}
