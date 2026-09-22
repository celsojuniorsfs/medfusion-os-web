import { AfterViewInit, Component, ElementRef, OnDestroy, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import QrScanner from 'qr-scanner';
import { CardComponent } from '../../../shared/ui/card.component';
import { SpinnerComponent } from '../../../shared/ui/spinner.component';
import { extractEquipmentId } from '../data-access/qr-scan';

type CameraErrorKind = 'insecure-context' | 'not-allowed' | 'not-found' | 'not-readable' | 'unknown';

/**
 * Tela "Escanear equipamento" (web#103, última etapa do recurso de reconhecimento por QR Code):
 * câmera ao vivo via qr-scanner — aponta e reconhece sozinho, sem precisar tirar foto. Biblioteca
 * escolhida na sessão de design apesar de não receber atualização desde 2022 (risco registrado no
 * PR): fica isolada só neste componente, então trocar por @zxing/browser (mantido, mas roda na UI
 * thread) no futuro é uma troca localizada.
 *
 * Sempre mostra o atalho manual — a câmera vai falhar em campo às vezes (permissão negada, sem
 * câmera, câmera ocupada por outro programa, ou fora de um contexto seguro), e o técnico não pode
 * ficar travado.
 *
 * Achado testando manualmente: `QrScanner.start()` NUNCA propaga o `DOMException` de verdade do
 * `getUserMedia` — a própria lib tenta várias combinações de constraints internamente, engole o
 * erro de cada tentativa (`catch(f) {}`) e só relança a string genérica "Camera not found." no
 * final, não importa a causa real (permissão negada, câmera ocupada, etc. viram a mesma
 * mensagem). Por isso o acesso à câmera é sondado aqui ANTES de instanciar o `QrScanner`: só essa
 * chamada própria a `getUserMedia` preserva o `DOMException.name` original pra classificar o erro
 * certo pro técnico.
 */
@Component({
  selector: 'app-scan-equipment-page',
  imports: [RouterLink, CardComponent, SpinnerComponent],
  templateUrl: './scan-equipment.page.html',
})
export class ScanEquipmentPage implements AfterViewInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly videoRef = viewChild.required<ElementRef<HTMLVideoElement>>('video');

  protected readonly starting = signal(true);
  protected readonly cameraError = signal<CameraErrorKind | null>(null);

  private scanner?: QrScanner;
  private navigated = false;

  async ngAfterViewInit(): Promise<void> {
    if (!(await this.canAccessCamera())) {
      this.starting.set(false);
      return;
    }

    this.scanner = new QrScanner(this.videoRef().nativeElement, (result) => this.handleDecode(result.data), {
      highlightScanRegion: true,
      highlightCodeOutline: true,
    });

    try {
      await this.scanner.start();
    } catch {
      // A causa específica já foi classificada (ou descartada) pela sondagem em canAccessCamera().
      this.cameraError.set('unknown');
    } finally {
      this.starting.set(false);
    }
  }

  /** Sonda o acesso à câmera e libera a stream de teste em seguida — ver comentário da classe. */
  private async canAccessCamera(): Promise<boolean> {
    if (!window.isSecureContext) {
      this.cameraError.set('insecure-context');
      return false;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      this.cameraError.set('unknown');
      return false;
    }

    try {
      const probeStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      probeStream.getTracks().forEach((track) => track.stop());
      return true;
    } catch (error) {
      this.cameraError.set(this.classifyCameraError(error));
      return false;
    }
  }

  ngOnDestroy(): void {
    this.scanner?.destroy();
  }

  protected cameraErrorMessage(): string {
    switch (this.cameraError()) {
      case 'insecure-context':
        return 'A câmera só funciona em conexões seguras (HTTPS) — abra o link publicado do sistema.';
      case 'not-allowed':
        return 'Permissão de câmera negada. Habilite o acesso à câmera nas configurações do navegador e tente novamente.';
      case 'not-found':
        return 'Nenhuma câmera foi encontrada neste aparelho.';
      case 'not-readable':
        return 'Não foi possível acessar a câmera — ela pode estar sendo usada por outro programa.';
      default:
        return 'Não foi possível abrir a câmera. Tente novamente.';
    }
  }

  // Múltiplos frames por segundo escaneiam o mesmo código enquanto ele fica no quadro — só a
  // primeira leitura reconhecida deve navegar.
  private handleDecode(scannedText: string): void {
    if (this.navigated) return;

    const equipmentId = extractEquipmentId(scannedText);
    if (!equipmentId) return;

    this.navigated = true;
    this.scanner?.stop();
    this.router.navigate(['/orders/novo/equipamento', equipmentId]);
  }

  private classifyCameraError(error: unknown): CameraErrorKind {
    const name = error instanceof DOMException ? error.name : undefined;
    switch (name) {
      case 'NotAllowedError':
        return 'not-allowed';
      case 'NotFoundError':
      case 'OverconstrainedError':
        return 'not-found';
      case 'NotReadableError':
        return 'not-readable';
      default:
        return 'unknown';
    }
  }
}
