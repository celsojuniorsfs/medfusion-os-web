# Med Fusion — Ordem de Serviço (Web)

Frontend Angular do sistema de Ordem de Serviço da
**Med Fusion Manutenção e Venda Clínica Hospitalar Ltda.**

Substitui o controle atual, feito manualmente em planilhas Excel (uma por OS, nomeadas
`número - cliente - equipamento - nº de série`), por uma aplicação web com numeração
automática, listagem pesquisável e geração de PDF.

Veja o glossário do domínio e as decisões de escopo em [`CONTEXT.md`](./CONTEXT.md), o escopo
completo da v1 e critérios de aceite em [`docs/escopo-v1.md`](./docs/escopo-v1.md), e o contrato
da API em [`openapi.yaml`](https://github.com/celsojuniorsfs/medfusion-os-api/blob/main/docs/openapi.yaml).

## Stack

- **Frontend**: Angular 22 (standalone components) + Tailwind CSS v4 +
  [Spartan UI](https://spartan.ng/) (`@spartan-ng/brain`, headless — equivalente Angular do
  shadcn/ui) + [`lucide-angular`](https://lucide.dev/) para ícones. Design system definido a
  partir de uma referência do cliente (dashboard admin com header + sidebar fixa + cards);
  `--primary` é o teal da marca (`#37999e`, extraído do logo do cliente), o resto da paleta é
  neutra — ver `src/styles.scss`
- **Estado**: [`@ngrx/signals`](https://ngrx.io/guide/signals) (SignalStore) por feature — ver
  "Arquitetura" abaixo
- **Backend**: [medfusion-os-api](https://github.com/celsojuniorsfs/medfusion-os-api) — Laravel + Sanctum (token Bearer)
- **PDF**: gerado no backend (dompdf) e guardado no Laravel Cloud Object Storage, consumido via API
- **Deploy**: frontend na Vercel, backend + banco (Laravel MySQL) no Laravel Cloud

## Arquitetura

Standalone (padrão do Angular 22) — sem `NgModule`, sem `SharedModule`. Cada feature é uma
pasta com rotas lazy e providers próprios:

```
src/app/
  core/                      # transversal: sessão de autenticação, interceptor, guard, shell
    auth/auth-session.store.ts
    interceptors/auth.interceptor.ts
    guards/auth.guard.ts
    layout/shell.component.ts
  features/
    identity/                # login — equivalente ao módulo Identity do backend
      pages/login.page.ts
      identity.routes.ts
    clients/
      pages/                 # telas
      data-access/           # http + store da feature, no mesmo lugar (sem service à parte)
      clients.routes.ts
    orders/                  # mesma forma de clients/
  shared/ui/                 # componentes "burros" reutilizáveis (sem regra de negócio)
```

O paralelo com a arquitetura do backend (monólito modular + Event Sourcing, ver
[`docs/architecture.md`](https://github.com/celsojuniorsfs/medfusion-os-api/blob/main/docs/architecture.md)):

| Backend                                  | Front                                     |
| ---------------------------------------- | ----------------------------------------- |
| Aggregate + métodos de comando           | `withMethods` do SignalStore              |
| Projector / read model                   | `withEntities` + `withComputed`           |
| Evento como superfície pública do módulo | o store da feature é a superfície pública |

Uma feature nunca importa `data-access/` de outra — só o store dela. `core/` não conhece
nenhuma feature.

## Como rodar localmente

Pressupõe [`medfusion-os-api`](https://github.com/celsojuniorsfs/medfusion-os-api) clonado como
pasta irmã desta (`../medfusion-os-api`) e já rodando em `http://localhost:8000` — ver o
`README.md` de lá para subir a API primeiro.

```bash
npm install
npm run generate:api-types   # gera src/app/core/api-types.ts a partir do openapi.yaml da API
npm start                    # ng serve — http://localhost:4200
```

`src/app/core/api-types.ts` não é versionado — é gerado a partir do `openapi.yaml`, que é a
fonte da verdade (decisão da F1). Rode `npm run generate:api-types` de novo sempre que o
contrato da API mudar.

## Escopo da v1

- Autenticação de técnicos (login simples, sem papéis/permissões)
- Cadastro de clientes (CRUD, busca, paginação)
- Catálogo de equipamentos por cliente, reaproveitável entre OS's (sem limite de quantidade)
- Criação e listagem de Ordens de Serviço, espelhando o formulário atual em Excel (dados do
  cliente, tipo de atendimento, equipamentos, defeito apresentado, manutenção a aplicar,
  observação, peças de reposição, valor de mão de obra, pagamento/garantia)
- Numeração sequencial da OS, auto-sugerida a partir de **1336** (o número atual do
  bloco físico), editável pelo técnico
- Status da OS (9 estados, incluindo reabertura por garantia) — ver `docs/escopo-v1.md`
- Tela de histórico de OS por equipamento
- Geração e download do PDF da OS, com notificação automática por e-mail e WhatsApp

Critérios de aceite completos em [`docs/escopo-v1.md`](./docs/escopo-v1.md).

**Fora da v1** (backlog — ver milestone `Backlog – Pós-v1` nas issues): aba de custos
internos (peças/fornecedor, viagem, pagamento/laudo) e geração de certificados por tipo
de equipamento.

## Modelo de dados

Nomes de campo em inglês (padronizado em 08/09/2026); tabela de correspondência com os termos
em português usados com o cliente em
[`api-conventions.md`](https://github.com/celsojuniorsfs/medfusion-os-api/blob/main/docs/api-conventions.md).
`id` é uuid (identidade dos agregados do Event Sourcing no backend — ver `architecture.md` da
API); `number` da OS continua um inteiro sequencial (seed 1336), sem relação com identidade.

```
users             name, email, password
clients           person_type, name, trade_name, tax_id, state_registration, requester,
                  department, phone, email, address, city, state, postal_code
equipments        client_id, name, brand, model, serial_number, asset_tag, accessories
orders            number (unique, seed 1336), date, client_id, user_id,
                  picked_up, warranty, technical_training, on_site_quote, rental (bool),
                  reported_defect, maintenance_plan, notes,
                  payment_method, warranty_period, proposal_validity,
                  labor_cost (nullable), total, status, certificate_number (nullable),
                  pdf_path (nullable), pdf_generated_at (nullable)
order_equipments  order_id, equipment_id (fk, nullable), name, brand, model, serial_number,
                  asset_tag, accessories — cópia (snapshot) no momento da criação da OS
order_items       order_id, quantity, description, unit_price (nullable)
```

Detalhes de cada campo e o mapa completo planilha → sistema em
[`docs/escopo-v1.md`](./docs/escopo-v1.md).

## Acompanhamento

O backlog está organizado em issues e milestones por fase do ciclo de desenvolvimento
(Planejamento → Análise → Projeto → Programação → Testes → Implantação), tanto neste
repositório quanto no [medfusion-os-api](https://github.com/celsojuniorsfs/medfusion-os-api).
