import { todayLocalDate } from './local-date';

describe('todayLocalDate', () => {
  beforeEach(() => {
    vi.stubEnv('TZ', 'America/Sao_Paulo');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('returns the LOCAL calendar date, not the UTC one', () => {
    // 23:30 em São Paulo (UTC-3) em 24/09 já é 25/09 em UTC — a versão com toISOString() erraria.
    vi.setSystemTime(new Date('2026-09-24T23:30:00-03:00'));

    expect(todayLocalDate()).toBe('2026-09-24');
  });

  it('pads month and day to two digits', () => {
    vi.setSystemTime(new Date('2026-01-05T10:00:00-03:00'));

    expect(todayLocalDate()).toBe('2026-01-05');
  });
});
