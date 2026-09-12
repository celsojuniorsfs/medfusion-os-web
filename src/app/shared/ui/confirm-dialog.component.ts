import { Component, computed, input, output, viewChild } from '@angular/core';
import { BrnAlertDialog, BrnAlertDialogImports } from '@spartan-ng/brain/alert-dialog';
import { SpinnerComponent } from './spinner.component';

/**
 * Confirmação destrutiva estilizada — substitui o confirm() nativo do navegador. Genérico (não é
 * específico de nenhuma feature): quem usa controla o conteúdo via inputs e chama open()/close()
 * via referência do componente.
 */
@Component({
  selector: 'ui-confirm-dialog',
  imports: [...BrnAlertDialogImports, SpinnerComponent],
  template: `
    <brn-alert-dialog #dialog="brnAlertDialog">
      <ng-template brnAlertDialogContent>
        <brn-alert-dialog-overlay
          [attr.data-state]="state()"
          class="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
        />
        <div
          [attr.data-state]="state()"
          class="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-popover p-6 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        >
          <h2 brnAlertDialogTitle class="text-lg font-semibold">{{ title() }}</h2>
          @if (description()) {
            <p brnAlertDialogDescription class="mt-2 text-sm text-muted-foreground">{{ description() }}</p>
          }
          <div class="mt-4 flex justify-end gap-2">
            <button
              type="button"
              (click)="close()"
              class="inline-flex h-10 items-center rounded-md border border-input px-4 text-sm font-medium hover:bg-accent"
            >
              {{ cancelLabel() }}
            </button>
            <button
              type="button"
              [disabled]="pending()"
              (click)="confirmed.emit()"
              class="inline-flex h-10 items-center gap-2 rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:pointer-events-none disabled:opacity-50"
            >
              @if (pending()) {
                <ui-spinner />
              }
              {{ confirmLabel() }}
            </button>
          </div>
        </div>
      </ng-template>
    </brn-alert-dialog>
  `,
})
export class ConfirmDialogComponent {
  title = input.required<string>();
  description = input<string>();
  confirmLabel = input('Confirmar');
  cancelLabel = input('Cancelar');
  pending = input(false);
  confirmed = output<void>();

  private readonly dialog = viewChild.required<BrnAlertDialog>('dialog');
  protected readonly state = computed(() => this.dialog().stateComputed());

  open(): void {
    this.dialog().open();
  }

  close(): void {
    this.dialog().close();
  }
}
