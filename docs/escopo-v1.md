# Escopo da v1 e critérios de aceite

> Fecha a issue [#21 — Definir escopo da v1 e critérios de aceite](https://github.com/celsojuniorsfs/medfusion-os-web/issues/21).
> Vocabulário e decisões de negócio em [`CONTEXT.md`](../CONTEXT.md). Contrato da API em
> [`medfusion-os-api/docs/openapi.yaml`](https://github.com/celsojuniorsfs/medfusion-os-api/blob/main/docs/openapi.yaml).

## Dentro da v1

- **Autenticação** de técnicos via Laravel Sanctum (token), sem papéis/permissões — todo usuário
  autenticado tem o mesmo poder. Toda OS registra quem a criou.
- **Clientes**: CRUD completo, listagem paginada com busca por razão social/CNPJ.
- **Ordens de Serviço**: criação, edição, listagem (com filtros) e visualização, espelhando o
  formulário atual em Excel — dados do cliente, tipo de atendimento, até 2 equipamentos, defeito
  apresentado, manutenção a aplicar, observação, peças de reposição, forma de pagamento, garantia
  e validade da proposta.
- **Numeração sequencial** da OS, auto-sugerida a partir de **1336**, editável pelo técnico.
- **Status da OS**: acompanhamento do ciclo de vida (ver seção própria abaixo).
- **PDF da OS**: geração e download, fiel ao layout da planilha atual.

## Fora da v1 (backlog pós-v1)

- Aba **CUSTOS** (peças/fornecedor, custos de viagem, controle de pagamento/laudo) — ver
  `CONTEXT.md`.
- **Certificados** por tipo de equipamento — apenas o campo de vínculo `certificado_numero` é
  modelado agora.
- Múltiplos papéis de usuário (ex.: admin vs. técnico) e qualquer controle de permissão.
- Relatórios e dashboards.

## Modelo de dados da v1

Esta é a versão de referência da Fase 1 — corrige e substitui a seção "Modelo de dados" do
`README.md`, que ainda não tinha `status`, `observacao`, `user_id` nem os campos de PDF.

```
users            name, email, password
clients          razao_social, cnpj, solicitante, setor, telefone, endereco, cidade, cep
orders           numero (unique, seed 1336), data, client_id, user_id,
                 retirado, garantia, treinamento_tecnico, orc_local, locacao (bool),
                 defeito_apresentado, manutencao_a_aplicar, observacao,
                 forma_pagamento, garantia_prazo, validade_proposta,
                 total, status, certificado_numero (nullable),
                 pdf_path (nullable), pdf_generated_at (nullable)
order_equipments order_id, ordem (1|2), equipamento, marca, modelo,
                 numero_serie, patrimonio, acessorios
order_items      order_id, quantidade, descricao, valor_unitario
```

Notas sobre campos que não estavam explícitos no controle manual:

- **`observacao`** — a OS 1336 traz a linha livre *"Orçamento apenas de peças, mão de obra inclusa
  no contrato"*, abaixo da manutenção a aplicar e acima da tabela de peças. Campo de texto livre,
  opcional.
- **`status`** — não existe na planilha (o controle de andamento hoje é informal), mas várias
  telas do backlog já dependem dele (listagem com filtro por status, endpoint de atualização de
  status). Ver ciclo de vida abaixo.
- **`pdf_path` / `pdf_generated_at`** — o PDF é gerado sob demanda e guardado no Object Storage do
  Laravel Cloud (ver [`ambientes.md`](https://github.com/celsojuniorsfs/medfusion-os-api/blob/main/docs/ambientes.md)
  no repo da API); esses campos guardam a referência e a data da última geração.
- **`garantia_prazo`** — a planilha tem uma caixa "GARANTIA: 90 DIAS" distinta do checkbox de tipo
  de atendimento `GARANTIA`. São dois conceitos diferentes: o checkbox marca que o atendimento
  *é* uma cobertura de garantia; `garantia_prazo` é o prazo de garantia oferecido no orçamento.

## Mapa planilha → sistema

Baseado em `public/OS.xlsx`, `public/exemplo-os-1.jpeg` (OS 1336, Fundação UNICAMP–AME) e
`public/exemplos-os-2.jpeg` (tabela de peças e rodapé).

| Campo na planilha | Campo no sistema | Observação |
|---|---|---|
| Orçamento (nº) | `orders.numero` | |
| Data | `orders.data` | |
| Cliente / CNPJ / Solicitante / Setor / Telefone / Endereço / Cidade / CEP | `clients.*` | Setor e CEP costumam vir vazios no exemplo — campos opcionais |
| RETIRADO / GARANTIA / TREINAMENTO TÉCNICO / ORÇ. LOCAL / LOCAÇÃO | `orders.retirado`, `.garantia`, `.treinamento_tecnico`, `.orc_local`, `.locacao` | booleanos independentes, não excludentes |
| EQUIP 1 / EQUIP 2 (Equipamento, Marca, Modelo, N/S, PAT, Acessórios) | `order_equipments` (`ordem` 1 ou 2) | EQUIP 1 obrigatório, EQUIP 2 opcional; PAT frequentemente vazio |
| Defeito apresentado | `orders.defeito_apresentado` | |
| Manutenção a aplicar | `orders.manutencao_a_aplicar` | |
| Observação | `orders.observacao` | ver nota acima |
| Peças reposição (Quant./Descrição/Valor) | `order_items` | quantidade, descrição e valor unitário sempre obrigatórios |
| Forma pagamento | `orders.forma_pagamento` | |
| Garantia (prazo) | `orders.garantia_prazo` | distinto do checkbox `GARANTIA` |
| Validade proposta | `orders.validade_proposta` | |
| Total | `orders.total` | calculado, somatório de `order_items` |

## Critérios de aceite

Formato Dado / Quando / Então para o comportamento que decide implementação:

### Numeração da OS

- **Dado** que o técnico abre o formulário de nova OS, **quando** a tela carrega, **então** o
  campo Número vem preenchido com `último número emitido + 1` (seed: 1336).
- **Dado** que o técnico edita o número sugerido, **quando** salva a OS, **então** o sistema
  aceita o valor informado.
- **Dado** que o número informado já existe em outra OS, **quando** o técnico salva, **então** o
  sistema recusa com erro de validação no campo Número (ver `409 Conflict` na API), sem persistir
  nada.

### Peças de reposição

- **Dado** uma linha de peça, **quando** o técnico tenta salvar sem quantidade, descrição ou valor
  unitário, **então** a linha é rejeitada — os três campos são obrigatórios.
- **Dado** uma ou mais linhas de peça preenchidas, **quando** o valor ou a quantidade de qualquer
  linha muda, **então** o campo Total é recalculado automaticamente e não é editável à mão.

### Equipamentos

- **Dado** uma OS nova, **quando** o técnico tenta salvar sem preencher EQUIP 1, **então** o
  sistema recusa — EQUIP 1 é obrigatório.
- **Dado** uma OS com EQUIP 1 preenchido, **então** EQUIP 2 é opcional; no máximo 2 equipamentos
  por OS.

### Tipo de atendimento

- **Dado** os cinco checkboxes de tipo de atendimento, **então** qualquer combinação é válida,
  incluindo nenhum marcado — são independentes entre si, como na planilha atual.

### Status da OS

- **Dado** uma OS recém-criada, **então** seu status inicial é `aberta`.
- **Dado** uma OS `aberta`, **então** pode transicionar para `aprovada` ou `cancelada`.
- **Dado** uma OS `aprovada`, **então** pode transicionar para `concluida` ou `cancelada`.
- **Dado** uma OS `concluida` ou `cancelada`, **então** nenhuma transição de status é permitida
  (estados finais) — não há retorno de status na v1.

### PDF

- **Dado** uma OS ainda não salva, **então** a geração de PDF não está disponível.
- **Dado** uma OS salva, **quando** o técnico solicita o PDF, **então** o sistema gera um
  documento fiel ao layout da planilha (cabeçalho fixo com dados da Med Fusion) e disponibiliza
  para download.
