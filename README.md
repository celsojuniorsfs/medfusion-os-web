# Med Fusion — Ordem de Serviço (Web)

Frontend Angular do sistema de Ordem de Serviço / Orçamento Técnico da
**Med Fusion Manutenção e Venda Clínica Hospitalar Ltda.**

Substitui o controle atual, feito manualmente em planilhas Excel (uma por OS, nomeadas
`número - cliente - equipamento - nº de série`), por uma aplicação web com numeração
automática, listagem pesquisável e geração de PDF.

Veja o glossário do domínio e as decisões de escopo em [`CONTEXT.md`](./CONTEXT.md).

## Stack

- **Frontend**: Angular (standalone components) + Angular Material
- **Backend**: [medfusion-os-api](https://github.com/celsojuniorsfs/medfusion-os-api) — Laravel + Sanctum
- **PDF**: gerado no backend (dompdf), consumido via API
- **Deploy**: Vercel

## Escopo da v1

- Cadastro de clientes (CRUD, busca, paginação)
- Criação e listagem de Ordens de Serviço, espelhando o formulário atual em Excel
  (dados do cliente, tipo de atendimento, até 2 equipamentos, defeito apresentado,
  manutenção a aplicar, peças de reposição, pagamento/garantia)
- Numeração sequencial da OS, auto-sugerida a partir de **1336** (o número atual do
  bloco físico), editável pelo técnico
- Geração e download do PDF da OS

**Fora da v1** (backlog — ver milestone `Backlog – Pós-v1` nas issues): aba de custos
internos (peças/fornecedor, viagem, pagamento/laudo) e geração de certificados por tipo
de equipamento.

## Modelo de dados

```
clients           razao_social, cnpj, solicitante, setor, telefone, endereco, cidade, cep
orders             numero (seed 1336), data, client_id, tipo de atendimento,
                   defeito_apresentado, manutencao_a_aplicar, forma_pagamento,
                   garantia, validade_proposta, total, certificado_numero (nullable)
order_equipments   equipamento, marca, modelo, numero_serie, patrimonio, acessorios (até 2 por OS)
order_items        quantidade, descricao, valor_unitario (peças de reposição)
```

## Acompanhamento

O backlog está organizado em issues e milestones por fase do ciclo de desenvolvimento
(Planejamento → Análise → Projeto → Programação → Testes → Implantação), tanto neste
repositório quanto no [medfusion-os-api](https://github.com/celsojuniorsfs/medfusion-os-api).
