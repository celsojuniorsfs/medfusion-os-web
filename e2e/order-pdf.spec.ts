import { APIRequestContext, expect, test } from '@playwright/test';

/**
 * web#48 — único e2e do repo de propósito (ver o /grill-me que decidiu isso): cruza web, API,
 * dompdf e o storage de verdade, o que um teste de componente com mock não cobre. Contra a API
 * REAL (não interceptada) — precisa dela rodando em E2E_API_URL (default: mesma porta que
 * environment.ts usa em dev, http://localhost:8000/api/v1).
 *
 * Cliente e equipamento são pré-requisito pra criar uma OS pela UI (o formulário só permite
 * escolher equipamento já cadastrado, não digitar um novo) — cadastrados direto pela API no
 * beforeAll, não pela UI: o CRUD deles já tem teste próprio, e isso mantém este e2e focado no
 * fluxo que a issue pede.
 */

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:8000/api/v1';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'e2e@medfusion.local';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'e2e-senha-de-teste';

async function apiPost<T>(request: APIRequestContext, token: string | null, path: string, data: unknown): Promise<T> {
  const response = await request.post(`${API_URL}${path}`, {
    data,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok()) {
    throw new Error(`POST ${path} -> ${response.status()}: ${await response.text()}`);
  }
  return response.json();
}

let clientName: string;
let equipmentLabel: string;

/** Réplica de ValidTaxId::checkDigit() (api) — a API valida CNPJ de verdade, não só o formato. */
function cnpjCheckDigit(base: string, weights: number[]): number {
  const sum = base
    .split('')
    .reduce((total, digit, i) => total + Number(digit) * weights[i], 0);
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

function randomCnpj(): string {
  const base = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
  const d1 = cnpjCheckDigit(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = cnpjCheckDigit(base + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${base}${d1}${d2}`;
}

test.beforeAll(async ({ request }) => {
  const suffix = Date.now();

  const login = await apiPost<{ token: string }>(request, null, '/auth/login', {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });

  clientName = `Cliente E2E ${suffix}`;
  const client = await apiPost<{ data: { id: string } }>(request, login.token, '/clients', {
    person_type: 'company',
    name: clientName,
    tax_id: randomCnpj(),
    email: `e2e+${suffix}@medfusion.local`,
    phone: '11999999999',
  });

  equipmentLabel = `UltrassomE2E${suffix}`;
  const model = await apiPost<{ data: { id: string } }>(request, login.token, '/equipment-models', {
    name: equipmentLabel,
    brand: 'MarcaE2E',
    model: 'XYZ-E2E',
  });

  await apiPost(request, login.token, `/clients/${client.data.id}/equipments`, {
    equipment_model_id: model.data.id,
    no_accessories: true,
  });
});

test('cria uma OS e baixa o PDF gerado', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(ADMIN_EMAIL);
  // exact: true — sem isso, bate também no botão "Mostrar senha" (substring "senha" no aria-label).
  await page.getByLabel('Senha', { exact: true }).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('**/orders');

  await page.getByRole('link', { name: 'Nova OS' }).click();
  await page.waitForURL('**/orders/novo');

  await page.getByPlaceholder('Buscar cliente por nome ou CPF/CNPJ...').fill(clientName);
  await page.getByRole('button', { name: clientName }).click();

  await page.getByPlaceholder('Buscar equipamento cadastrado deste cliente...').fill(equipmentLabel);
  await page.getByRole('button', { name: new RegExp(equipmentLabel) }).click();

  await page.locator('#labor_cost').fill('50');

  await page.getByRole('button', { name: 'Salvar OS' }).click();
  await page.waitForURL('**/orders');

  // Coluna "Nº" é o único link da linha com texto puramente numérico — a coluna de cliente na
  // tabela desktop não é um link, e a linha também tem o link "Editar", então não dá pra pegar só
  // o primeiro link da linha.
  await page.locator('tr', { hasText: clientName }).getByRole('link', { name: /^\d+$/ }).click();
  await page.waitForURL(/\/orders\/[^/]+$/);

  // openOrderPdf() abre a aba em branco ANTES do POST /pdf (bloqueador de pop-up — ver o
  // comentário em open-order-pdf.ts) e só navega ela pra URL assinada quando a resposta chega —
  // por isso esperar a aba abrir não basta, é preciso esperar ela navegar pra a URL de download.
  const [pdfPage] = await Promise.all([
    page.context().waitForEvent('page'),
    page.getByRole('button', { name: 'Baixar PDF' }).click(),
  ]);
  const pdfResponse = await pdfPage.waitForResponse((response) => response.url().includes('/pdf/download'));

  expect(pdfResponse.status()).toBe(200);
  expect(pdfResponse.headers()['content-type']).toContain('application/pdf');
});
