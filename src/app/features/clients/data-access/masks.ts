/**
 * Máscaras leves (sem biblioteca) — recebem o valor atual do campo (já com ou sem pontuação) e
 * devolvem formatado, aplicadas no (input) do respectivo campo. A API valida o formato de
 * verdade (CPF/CNPJ com dígito verificador) — isto aqui é só UX.
 */

export function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);

  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

export function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);

  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

/**
 * Cliente pode cadastrar com CPF (pessoa física) ou CNPJ (pessoa jurídica) — a maioria usa CNPJ,
 * mas uma parte não (feedback do Augusto em 10/09/2026). Desde que o cadastro ganhou um campo
 * explícito de tipo de pessoa (10/09/2026), passar `personType` decide a máscara certa direto;
 * sem ele, adivinha pelo tamanho (compatibilidade com quem ainda não sabe o tipo, ex.: máscara
 * rodando antes do campo de tipo ser preenchido).
 */
export function formatTaxId(value: string, personType?: 'individual' | 'company'): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);

  if (personType === 'individual') {
    return formatCpf(digits);
  }

  if (personType === 'company') {
    return formatCnpj(digits);
  }

  return digits.length <= 11 ? formatCpf(digits) : formatCnpj(digits);
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);

  if (digits.length <= 10) {
    return digits.replace(/^(\d{2})(\d{4})(\d{0,4})/, (_match, ddd, first, rest) =>
      rest ? `(${ddd}) ${first}-${rest}` : ddd ? `(${ddd}) ${first}` : ddd,
    );
  }

  return digits.replace(/^(\d{2})(\d{5})(\d{0,4})/, (_match, ddd, first, rest) =>
    rest ? `(${ddd}) ${first}-${rest}` : `(${ddd}) ${first}`,
  );
}

export function formatCep(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);

  return digits.replace(/^(\d{5})(\d)/, '$1-$2');
}

// Partículas que ficam minúsculas no meio do nome, mas maiúsculas se forem a primeira palavra do
// nome inteiro (ex.: "Ana Costa de Souza" vs. "Da Silva" como sobrenome isolado no início).
const LOWERCASE_PARTICLES = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

/**
 * Nome/razão social digitado direto do cartão CNPJ costuma vir todo em caixa alta — normaliza pra
 * regras de nome próprio em português, não importa como o usuário digitou: primeira letra de cada
 * palavra maiúscula, partículas ("de", "da", "do"...) minúsculas exceto na primeira palavra, e
 * maiúscula depois de hífen/apóstrofo ("Ana-Clara", "O'Connor").
 */
export function toTitleCase(value: string): string {
  const words = value.trim().toLowerCase().split(/\s+/).filter(Boolean);

  return words
    .map((word, index) => {
      const isFirstWord = index === 0;

      if (!isFirstWord && LOWERCASE_PARTICLES.has(word)) {
        return word;
      }

      const capitalized = word.replace(
        /(^|[-'])(\p{L})/gu,
        (_match, boundary: string, letter: string) => boundary + letter.toUpperCase(),
      );

      // "d'Ávila" — o "d'" inicial é uma partícula (equivalente a "de"), então fica minúsculo a
      // menos que seja a primeira palavra do nome inteiro (mesma regra acima, só que o "de" vem
      // grudado sem espaço).
      if (!isFirstWord && word.startsWith("d'")) {
        return 'd' + capitalized.slice(1);
      }

      return capitalized;
    })
    .join(' ');
}
