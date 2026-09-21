import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucidePrinter } from '@lucide/angular';
import qrcode from 'qrcode-generator';
import { CardComponent } from '../../../shared/ui/card.component';
import { SpinnerComponent } from '../../../shared/ui/spinner.component';
import { ClientsStore } from '../data-access/clients.store';
import { EquipmentsStore } from '../data-access/equipments.store';

/**
 * Etiqueta pra colar no equipamento (web#102): QR Code + nome do cliente, pensada pra impressora
 * térmica de 40x30mm. O QR aponta pro alias curto /os/:equipmentId (web#101) — reduz a densidade
 * do módulo, já que o payload carrega um uuid inteiro e a etiqueta é pequena. Nível de correção de
 * erro M: o cliente já tem o hábito de aplicar uma película autoadesiva transparente por cima
 * quando a impressão térmica não aguenta a limpeza com álcool (ver decisões validadas na issue),
 * então a densidade extra de Q/H não compensa.
 *
 * Nome do cliente "abreviado" (pedido do cliente) é tratado aqui como "cabe no espaço da
 * etiqueta": trunca com reticências via CSS em vez de tentar adivinhar algoritmicamente qual parte
 * de um nome de pessoa ou razão social cortar — não tem regra que funcione igual pros dois casos.
 */
@Component({
  selector: 'app-equipment-qr-code-page',
  imports: [RouterLink, CardComponent, SpinnerComponent, LucidePrinter],
  templateUrl: './equipment-qr-code.page.html',
})
export class EquipmentQrCodePage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly clientsStore = inject(ClientsStore);
  protected readonly equipmentsStore = inject(EquipmentsStore);

  protected readonly clientId = this.route.snapshot.paramMap.get('id')!;
  protected readonly equipmentId = this.route.snapshot.paramMap.get('equipmentId')!;

  protected readonly loading = signal(true);
  protected readonly pageError = signal<string | null>(null);

  protected readonly client = computed(() =>
    this.clientsStore.entities().find((client) => client.id === this.clientId),
  );

  protected readonly qrCodeUrl = computed(() => `${location.origin}/os/${this.equipmentId}`);

  protected readonly qrCodeSvg = computed(() => {
    const qr = qrcode(0, 'M');
    qr.addData(this.qrCodeUrl());
    qr.make();
    return this.sanitizer.bypassSecurityTrustHtml(qr.createSvgTag({ scalable: true }));
  });

  // @page (tamanho físico do papel) não pode ser escopado pelo Angular — a diretiva de
  // encapsulamento de estilos não alcança at-rules de nível de página. Injeta e remove uma <style>
  // própria só enquanto este componente está montado, em vez de colocar a regra no stylesheet
  // global (que forçaria 40x30mm em qualquer impressão futura de qualquer outra tela do app).
  private printPageStyle?: HTMLStyleElement;

  async ngOnInit(): Promise<void> {
    this.printPageStyle = document.createElement('style');
    this.printPageStyle.textContent = '@media print { @page { size: 40mm 30mm; margin: 0; } }';
    document.head.appendChild(this.printPageStyle);

    try {
      await Promise.all([
        this.clientsStore.findOne(this.clientId),
        this.equipmentsStore.findOne(this.equipmentId),
      ]);
    } catch {
      this.pageError.set('Não foi possível carregar os dados da etiqueta.');
    } finally {
      this.loading.set(false);
    }
  }

  ngOnDestroy(): void {
    this.printPageStyle?.remove();
  }

  print(): void {
    window.print();
  }
}
