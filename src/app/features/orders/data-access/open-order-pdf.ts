import { OrdersStore } from './orders.store';

type PdfStore = Pick<InstanceType<typeof OrdersStore>, 'generatePdf' | 'markPdfGenerated'>;

/**
 * Sempre gera um PDF novo (a API apaga o anterior) e o abre numa aba nova.
 *
 * `window.open('', '_blank')` roda ANTES de qualquer `await` — ainda dentro do gesto síncrono do
 * clique, então nunca cai no bloqueador de pop-up (que só bloqueia `window.open()` chamado depois de
 * atravessar uma fronteira assíncrona). Por isso quem chama NÃO pode fazer `await` nenhum antes de
 * chamar esta função. Navegar a aba já aberta pra URL assinada funciona igual em desktop e celular,
 * sem blob nem atributo `download` (que o Safari mobile mais antigo ignora).
 *
 * Em erro, fecha a aba e relança — o toast fica com a tela.
 */
export async function openOrderPdf(store: PdfStore, orderId: string): Promise<void> {
  const tab = window.open('', '_blank');

  try {
    const pdf = await store.generatePdf(orderId);
    if (pdf.generated_at) store.markPdfGenerated(orderId, pdf.generated_at);
    if (!pdf.url) throw new Error('Resposta do PDF sem URL.');

    if (tab) {
      tab.location.href = pdf.url;
    } else {
      window.location.href = pdf.url;
    }
  } catch (error) {
    tab?.close();
    throw error;
  }
}
