import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideBell } from '@lucide/angular';
import { AlertsStore } from '../alerts/alerts.store';
import { canSeeAlerts } from '../alerts/alerts';
import { AuthSessionStore } from '../auth/auth-session.store';

@Component({
  selector: 'app-alerts-bell',
  imports: [RouterLink, LucideBell],
  template: `
    @if (visible()) {
      <a
        routerLink="/alertas"
        class="relative flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
        [attr.aria-label]="label()"
      >
        <svg lucideBell [size]="20"></svg>
        @if (alerts.count() > 0) {
          <span
            class="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground"
          >
            {{ badge() }}
          </span>
        }
      </a>
    }
  `,
})
export class AlertsBellComponent {
  protected readonly alerts = inject(AlertsStore);
  private readonly auth = inject(AuthSessionStore);

  protected readonly visible = computed(() => canSeeAlerts(this.auth.user()?.role));
  protected readonly badge = computed(() =>
    this.alerts.count() > 99 ? '99+' : String(this.alerts.count()),
  );
  protected readonly label = computed(() =>
    this.alerts.count() > 0 ? `Alertas (${this.alerts.count()} pendentes)` : 'Alertas',
  );
}
