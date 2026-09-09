/**
 * Máscaras leves (sem biblioteca) — recebem o valor atual do campo (já com ou sem pontuação) e
 * devolvem formatado, aplicadas no (input) do respectivo campo. A API valida o formato de
 * verdade (CNPJ com dígito verificador) — isto aqui é só UX.
 */

export function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);

  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
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
