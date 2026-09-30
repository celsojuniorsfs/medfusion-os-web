import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { toast } from '@spartan-ng/brain/sonner';
import { Alert } from '../../../core/alerts/alerts';
import { AlertsStore } from '../../../core/alerts/alerts.store';
import { CardComponent } from '../../../shared/ui/card.component';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog.component';
import { SpinnerComponent } from '../../../shared/ui/spinner.component';
import { ALERT_TYPE_BADGE_CLASS, ALERT_TYPE_LABELS, alertLink } from '../data-access/alert-types';

@Component({
  selector: 'app-alerts-page',
  imports: [RouterLink, DatePipe, CardComponent, SpinnerComponent, ConfirmDialogComponent],
  templateUrl: './alerts.page.html',
})
export class AlertsPage implements OnInit {
  protected readonly store = inject(AlertsStore);

  private readonly contactedDialog = viewChild.required<ConfirmDialogComponent>('contactedDialog');
  private readonly target = signal<Alert | null>(null);
  protected readonly pending = signal(false);

  protected readonly typeLabels = ALERT_TYPE_LABELS;
  protected readonly typeBadgeClass = ALERT_TYPE_BADGE_CLASS;
  protected readonly alertLink = alertLink;

  ngOnInit(): void {
    void this.store.load();
  }

  protected askContacted(alert: Alert): void {
    this.target.set(alert);
    this.contactedDialog().open();
  }

  protected async confirmContacted(): Promise<void> {
    const alert = this.target();
    if (!alert) return;

    this.pending.set(true);
    try {
      await this.store.markContacted(alert.id);
      this.contactedDialog().close();
      toast.success('Cliente marcado como contatado.');
    } catch {
      this.contactedDialog().close();
      toast.error('Não foi possível marcar como contatado.');
    } finally {
      this.pending.set(false);
      this.target.set(null);
    }
  }
}
