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

- **Frontend**: Angular (standalone components) + Angular Material
- **Backend**: [medfusion-os-api](https://github.com/celsojuniorsfs/medfusion-os-api) — Laravel + Sanctum (token Bearer)
- **PDF**: gerado no backend (dompdf) e guardado no Laravel Cloud Object Storage, consumido via API
- **Deploy**: frontend na Vercel, backend + banco (Laravel MySQL) no Laravel Cloud

## Escopo da v1

- Autenticação de técnicos (login simples, sem papéis/permissões)
- Cadastro de clientes (CRUD, busca, paginação)
- Criação e listagem de Ordens de Serviço, espelhando o formulário atual em Excel
  (dados do cliente, tipo de atendimento, até 2 equipamentos, defeito apresentado,
  manutenção a aplicar, observação, peças de reposição, pagamento/garantia)
- Numeração sequencial da OS, auto-sugerida a partir de **1336** (o número atual do
  bloco físico), editável pelo técnico
- Status da OS: `aberta` → `aprovada` → `concluida`, mais `cancelada`
- Geração e download do PDF da OS

Critérios de aceite completos em [`docs/escopo-v1.md`](./docs/escopo-v1.md).

**Fora da v1** (backlog — ver milestone `Backlog – Pós-v1` nas issues): aba de custos
internos (peças/fornecedor, viagem, pagamento/laudo) e geração de certificados por tipo
de equipamento.

## Modelo de dados

```
users             name, email, password
clients           razao_social, cnpj, solicitante, setor, telefone, endereco, cidade, cep
orders            numero (unique, seed 1336), data, client_id, user_id,
                  retirado, garantia, treinamento_tecnico, orc_local, locacao (bool),
                  defeito_apresentado, manutencao_a_aplicar, observacao,
                  forma_pagamento, garantia_prazo, validade_proposta,
                  total, status, certificado_numero (nullable),
                  pdf_path (nullable), pdf_generated_at (nullable)
order_equipments  order_id, ordem (1|2), equipamento, marca, modelo,
                  numero_serie, patrimonio, acessorios
order_items       order_id, quantidade, descricao, valor_unitario
```

Detalhes de cada campo e o mapa completo planilha → sistema em
[`docs/escopo-v1.md`](./docs/escopo-v1.md).

## Acompanhamento

O backlog está organizado em issues e milestones por fase do ciclo de desenvolvimento
(Planejamento → Análise → Projeto → Programação → Testes → Implantação), tanto neste
repositório quanto no [medfusion-os-api](https://github.com/celsojuniorsfs/medfusion-os-api).
