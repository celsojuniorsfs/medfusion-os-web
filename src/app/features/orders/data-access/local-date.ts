/**
 * `new Date().toISOString().slice(0, 10)` pega a data em UTC, não a local — um técnico no Brasil
 * (UTC-3) abrindo uma OS depois de ~21h já cairia no dia seguinte. `getFullYear()`/`getMonth()`/
 * `getDate()` são os getters de fuso LOCAL do próprio `Date`, o contrário de `toISOString()`.
 */
export function todayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Rearranja a string "AAAA-MM-DD" pra "DD/MM/AAAA" sem passar por `Date` — evitar o mesmo
 * problema de fuso de `todayLocalDate()` acima (um `new Date('AAAA-MM-DD')` é interpretado como
 * UTC, e formatar de volta no fuso local pode exibir o dia anterior).
 */
export function formatDateBr(isoDate: string | null | undefined): string {
  if (!isoDate) return '';

  const [year, month, day] = isoDate.split('-');

  return `${day}/${month}/${year}`;
}
