# Med Fusion — Ordem de Serviço (Web)

Frontend Angular do sistema de Ordem de Serviço / Orçamento Técnico da
**Med Fusion Manutenção e Venda Clínica Hospitalar Ltda.**

Substitui o controle atual, feito manualmente em planilhas Excel (uma por OS, nomeadas
`número - cliente - equipamento - nº de série`), por uma aplicação web com numeração
automática, listagem pesquisável e geração de PDF.

Veja o glossário do domínio e as decisões de escopo em [`CONTEXT.md`](./CONTEXT.md), o escopo
completo da v1 e critérios de aceite em [`docs/escopo-v1.md`](./docs/escopo-v1.md), e o contrato
da API em [`openapi.yaml`](https://github.com/celsojuniorsfs/medfusion-os-api/blob/main/docs/openapi.yaml).

## Stack

- **Frontend**: Angular 22 (standalone components) + Angular Material, tema customizado
- **Backend**: [medfusion-os-api](https://github.com/celsojuniorsfs/medfusion-os-api) — Laravel + Sanctum (token Bearer)
- **PDF**: gerado no backend (dompdf) e guardado no Laravel Cloud Object Storage, consumido via API
- **Deploy**: frontend na Vercel, backend + banco (Laravel MySQL) no Laravel Cloud

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

```
users             name, email, password
clients           company_name, tax_id, requester, department, phone, address, city, postal_code
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
