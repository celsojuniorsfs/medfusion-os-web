import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
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
  private readonly route = inject(ActivatedRoute);

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
      // returnUrl vem do authGuard (web#101) quando a pessoa tentou entrar direto por um link
      // (ex.: QR Code escaneado deslogada) — volta pra lá em vez de sempre cair na tela padrão.
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/';
      await this.router.navigateByUrl(returnUrl);
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
