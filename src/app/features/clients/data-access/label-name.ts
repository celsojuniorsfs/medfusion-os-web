import { components } from '../../../core/api-types';

type PersonType = components['schemas']['Client']['person_type'];

interface LabelNameSource {
  name?: string;
  trade_name?: string | null;
  person_type?: PersonType;
}

/**
 * Etiqueta de equipamento (40x30mm, ver equipment-qr-code.page.ts) só tem ~20mm de largura pro
 * nome ao lado do QR Code — pouco espaço pra confiar em truncamento por reticências, que corta em
 * qualquer ponto (ex.: "Marcos Augusto" virando "Marco...", sem nem sobrar o sobrenome). Abrevia
 * por iniciais em vez disso: primeiro nome + inicial do sobrenome. Nome de uma palavra só (sem
 * sobrenome pra abreviar) mostra a palavra inteira. Empresa usa o nome fantasia quando existir —
 * já costuma ser curto por natureza — e só cai pra essa mesma regra de iniciais na razão social
 * quando não tem nome fantasia cadastrado. O CSS de reticências no template continua como rede de
 * segurança pro caso raro de mesmo "Primeiro Nome I." ainda não caber.
 */
export function abbreviateClientLabelName(client: LabelNameSource): string {
  const personType = client.person_type ?? 'company'; // mesmo default de client-form.page.ts: cadastros de antes de 10/09/2026 eram só pessoa jurídica
  if (personType === 'company') {
    return client.trade_name?.trim() || abbreviateByInitial(client.name);
  }
  return abbreviateByInitial(client.name);
}

function abbreviateByInitial(fullName: string | undefined): string {
  const words = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return words[0] ?? '';
  return `${words[0]} ${words[1][0]}.`;
}
