import { defineConfig, devices } from '@playwright/test';

/**
 * Só o fluxo criar OS → gerar PDF (web#48) — ver e2e/order-pdf.spec.ts pro porquê da API real em
 * vez de mock. Assume web (`npm start`, porta 4200) e API (`http://localhost:8000/api/v1`, ver
 * environment.ts) já rodando — o job de CI (.github/workflows/e2e.yml) sobe as duas antes de
 * chamar `npx playwright test`; localmente, suba a API (Sail) e o web (`npm start`) você mesmo.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
