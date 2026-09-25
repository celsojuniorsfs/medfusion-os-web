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
