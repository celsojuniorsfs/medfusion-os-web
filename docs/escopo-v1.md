# Escopo da v1 e critérios de aceite

> Fecha a issue [#21 — Definir escopo da v1 e critérios de aceite](https://github.com/celsojuniorsfs/medfusion-os-web/issues/21).
> Vocabulário e decisões de negócio em [`CONTEXT.md`](../CONTEXT.md). Contrato da API em
> [`medfusion-os-api/docs/openapi.yaml`](https://github.com/celsojuniorsfs/medfusion-os-api/blob/main/docs/openapi.yaml).
>
> **Atualizado em 07/09/2026** com as correções de três rodadas de validação de escopo feitas
> com o cliente (áudio via WhatsApp) — ver `CONTEXT.md` § Validação com o cliente. Todos os
> pontos já têm confirmação fechada, incluindo o fluxo de status.

## Dentro da v1

- **Autenticação** de técnicos via Laravel Sanctum (token), sem papéis/permissões — todo usuário
  autenticado tem o mesmo poder. Toda OS registra quem a criou.
- **Clientes**: CRUD completo, listagem paginada com busca por razão social/CNPJ.
- **Catálogo de equipamentos por cliente**: cada equipamento é cadastrado uma vez no cliente e
  reaproveitado nas próximas OS's — não se redigita a cada atendimento (ver nota abaixo).
- **Histórico de OS por equipamento**: tela dedicada no cadastro do equipamento, listando as
  OS's anteriores daquele equipamento específico (data, status, valores). Serve de referência de
  preço — ex.: "esse valor já foi recusado nesse equipamento antes" — para clientes que têm mais
  de uma unidade do mesmo equipamento (ver critério de aceite abaixo).
- **Ordens de Serviço**: criação, edição, listagem (com filtros) e visualização, espelhando o
  formulário atual em Excel — dados do cliente, tipo de atendimento, **qualquer quantidade de
  equipamentos** (não mais limitado a 2), defeito apresentado, manutenção a aplicar, observação,
  peças de reposição (com valor opcional) e valor de mão de obra, forma de pagamento, garantia e
  validade da proposta.
- **Numeração sequencial** da OS, auto-sugerida a partir de **1336**, editável pelo técnico. O
  bloco físico de papel deixa de ser usado assim que o sistema entrar em operação.
- **Status da OS**: acompanhamento do ciclo de vida, incluindo a reabertura por garantia/retrabalho
  e o status `nao_aprovado` para orçamentos sem retorno do cliente (ver seção própria abaixo).
- **PDF da OS**: geração e download, fiel ao layout da planilha atual.
- **Notificação automática**: ao registrar a OS, uma cópia do PDF é enviada automaticamente ao
  cliente por e-mail e por WhatsApp.

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
equipments       client_id, equipamento, marca, modelo, numero_serie, patrimonio, acessorios
orders           numero (unique, seed 1336), data, client_id, user_id,
                 retirado, garantia, treinamento_tecnico, orc_local, locacao (bool),
                 defeito_apresentado, manutencao_a_aplicar, observacao,
                 forma_pagamento, garantia_prazo, validade_proposta,
                 valor_mao_obra (nullable), total, status,
                 certificado_numero (nullable),
                 pdf_path (nullable), pdf_generated_at (nullable)
order_equipments order_id, equipment_id
order_items      order_id, quantidade, descricao, valor_unitario (nullable)
```

Notas sobre campos que não estavam explícitos no controle manual:

- **`observacao`** — a OS 1336 traz a linha livre *"Orçamento apenas de peças, mão de obra inclusa
  no contrato"*, abaixo da manutenção a aplicar e acima da tabela de peças. Campo de texto livre,
  opcional.
- **`status`** — não existe na planilha (o controle de andamento hoje é informal), mas várias
  telas do backlog já dependem dele (listagem com filtro por status, endpoint de atualização de
  status). Ver ciclo de vida abaixo — fluxo ampliado nas duas rodadas de validação de 07/09/2026.
- **`pdf_path` / `pdf_generated_at`** — o PDF é gerado sob demanda e guardado no Object Storage do
  Laravel Cloud (ver [`ambientes.md`](https://github.com/celsojuniorsfs/medfusion-os-api/blob/main/docs/ambientes.md)
  no repo da API); esses campos guardam a referência e a data da última geração.
- **`garantia_prazo`** — a planilha tem uma caixa "GARANTIA: 90 DIAS" distinta do checkbox de tipo
  de atendimento `GARANTIA`. São dois conceitos diferentes: o checkbox marca que o atendimento
  *é* uma cobertura de garantia; `garantia_prazo` é o prazo de garantia oferecido no orçamento.
- **`equipments` (catálogo por cliente)** — corrige a v1 original, que tratava equipamento como
  texto solto por OS. Confirmado na validação: o cliente espera que o equipamento seja cadastrado
  uma vez e reaproveitado nas próximas OS's do mesmo cliente, como já acontece com os dados do
  cliente. `order_equipments` vira apenas o vínculo entre a OS e os equipamentos atendidos —
  **sem limite de quantidade** (ver critérios de aceite). Um equipamento digitado pela primeira
  vez numa OS é automaticamente salvo no catálogo do cliente.
- **`valor_mao_obra`** — novo campo, corrige a v1 original ("valor sempre obrigatório" em cada
  peça). Casos reais levantados na validação: orçamentos de prefeitura costumam mostrar só o
  valor da mão de obra (peça embutida, para não disparar licitação acima de um teto); clientes
  particulares costumam ver os dois valores separados. Por isso `order_items.valor_unitario`
  passa a ser opcional, e `orders.total` soma o que estiver preenchido (itens com valor +
  `valor_mao_obra`, quando houver).

## Mapa planilha → sistema

Baseado em `public/OS.xlsx`, `public/exemplo-os-1.jpeg` (OS 1336, Fundação UNICAMP–AME) e
`public/exemplos-os-2.jpeg` (tabela de peças e rodapé).

| Campo na planilha | Campo no sistema | Observação |
|---|---|---|
| Orçamento (nº) | `orders.numero` | |
| Data | `orders.data` | |
| Cliente / CNPJ / Solicitante / Setor / Telefone / Endereço / Cidade / CEP | `clients.*` | Setor e CEP costumam vir vazios no exemplo — campos opcionais |
| RETIRADO / GARANTIA / TREINAMENTO TÉCNICO / ORÇ. LOCAL / LOCAÇÃO | `orders.retirado`, `.garantia`, `.treinamento_tecnico`, `.orc_local`, `.locacao` | booleanos independentes, não excludentes |
| EQUIP 1 / EQUIP 2 (Equipamento, Marca, Modelo, N/S, PAT, Acessórios) | `equipments` (catálogo do cliente) + `order_equipments` (vínculo) | **Sem limite de quantidade** — corrigido na validação; PAT confirmado opcional (só preenchido em clientes com patrimônio ativo) |
| Defeito apresentado | `orders.defeito_apresentado` | |
| Manutenção a aplicar | `orders.manutencao_a_aplicar` | |
| Observação | `orders.observacao` | ver nota acima |
| Peças reposição (Quant./Descrição/Valor) | `order_items` | quantidade e descrição obrigatórias; **valor unitário opcional** — corrigido na validação |
| (sem equivalente direto) | `orders.valor_mao_obra` | novo campo — ver nota acima |
| Forma pagamento | `orders.forma_pagamento` | |
| Garantia (prazo) | `orders.garantia_prazo` | distinto do checkbox `GARANTIA` |
| Validade proposta | `orders.validade_proposta` | |
| Total | `orders.total` | calculado: soma de `order_items` com valor + `valor_mao_obra`, quando houver |

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

### Peças de reposição e mão de obra

- **Dado** uma linha de peça, **quando** o técnico tenta salvar sem quantidade ou descrição,
  **então** a linha é rejeitada — esses dois campos são obrigatórios. **Valor unitário é opcional**
  (corrigido na validação: prefeituras pedem orçamento só com valor de mão de obra, peça embutida).
- **Dado** que nenhuma peça tem valor preenchido e `valor_mao_obra` também está vazio, **quando**
  o técnico tenta salvar, **então** o sistema recusa — a OS precisa mostrar pelo menos um valor
  (peças, mão de obra, ou os dois).
- **Dado** uma ou mais linhas de peça com valor e/ou `valor_mao_obra` preenchidos, **quando**
  qualquer um desses muda, **então** o campo Total é recalculado automaticamente (soma do que
  estiver preenchido) e não é editável à mão.

### Equipamentos

- **Dado** uma OS nova, **quando** o técnico tenta salvar sem nenhum equipamento, **então** o
  sistema recusa — pelo menos um equipamento é obrigatório.
- **Dado** uma OS com um equipamento preenchido, **então** o técnico pode adicionar quantos
  equipamentos forem necessários — **sem limite de quantidade** (corrigido na validação: hospitais
  e instituições maiores chegam a dezenas ou centenas de equipamentos numa única OS).
- **Dado** um cliente com equipamentos já cadastrados, **quando** o técnico abre uma nova OS para
  esse cliente, **então** ele pode escolher entre os equipamentos já cadastrados ou cadastrar um
  novo — que fica salvo no catálogo do cliente para a próxima OS.

### Histórico do equipamento

Confirmado na terceira rodada de validação: o cliente usa OS's `nao_aprovado` (e demais status)
como referência de preço quando volta a orçar o mesmo equipamento — clientes costumam ter mais de
uma unidade do mesmo modelo, e ver o que já foi recusado antes ajuda a calibrar o próximo
orçamento.

- **Dado** um equipamento do catálogo de um cliente, **quando** o técnico abre a tela de
  histórico desse equipamento, **então** vê a lista de OS's anteriores **daquele equipamento
  específico** (mesmo `equipment_id`/nº de série) com data, status e valores (peça e mão de
  obra).
- **Dado** um equipamento sem nenhuma OS anterior, **então** a tela de histórico mostra que não
  há registros — não é um erro.
- Fora do escopo por ora: agrupar histórico por modelo/marca entre unidades diferentes do mesmo
  cliente (o pedido foi sobre o mesmo equipamento, não sobre "equipamentos parecidos").

### Tipo de atendimento

- **Dado** os cinco checkboxes de tipo de atendimento, **então** qualquer combinação é válida,
  incluindo nenhum marcado — são independentes entre si, como na planilha atual.

### Status da OS

Fluxo fechado após as duas rodadas de validação de 07/09/2026 (o cliente mencionou "aguardando
aprovação", "em análise", "orçamento externo", o retrabalho de garantia, e — na segunda rodada —
a necessidade de medir separadamente orçamentos que ficam sem resposta do cliente):

```
aberta → em_analise → orcamento_externo (opcional, quando terceirizado) → aguardando_aprovacao
       → aprovada → concluida
cancelada: alcançável a partir de aberta, em_analise, orcamento_externo ou aguardando_aprovacao
nao_aprovado: só a partir de aguardando_aprovacao — orçamento que ficou sem retorno do cliente
              por tempo suficiente; mudança manual do técnico, sem prazo automático. Distinto de
              `cancelada`: aqui o cliente simplesmente não se posicionou, não decidiu que não
              queria mais o serviço.
garantia: reabertura especial, só a partir de concluida, dentro do prazo de garantia — depois
          volta a fluir para concluida. É a MESMA OS (não cria uma nova) — serve para a empresa
          medir quantos retrabalhos aconteceram num período.
```

- **Dado** uma OS recém-criada, **então** seu status inicial é `aberta`.
- **Dado** uma OS em `aberta`, `em_analise`, `orcamento_externo` ou `aguardando_aprovacao`,
  **então** pode ser cancelada.
- **Dado** uma OS em `aguardando_aprovacao` sem retorno do cliente, **então** o técnico pode
  marcá-la manualmente como `nao_aprovado` — não há reabertura desse estado, mas o histórico
  continua consultável normalmente (ver critério de PDF/consulta abaixo).
- **Dado** uma OS `concluida` dentro do prazo de garantia, **quando** o equipamento volta com
  retrabalho, **então** o técnico reabre a **mesma OS** com status `garantia` (não cria uma OS
  nova); ao terminar o retrabalho, volta para `concluida`.
- **Dado** uma OS `concluida` fora do prazo de garantia, `cancelada` ou `nao_aprovado`, **então**
  nenhuma transição é permitida — são os únicos estados realmente finais. Nenhum deles impede a
  consulta aos dados da OS depois — o técnico pode reabrir a tela de visualização (nunca o
  status) para reaproveitar os dados num contato futuro do cliente.

### PDF e notificação automática

- **Dado** uma OS ainda não salva, **então** a geração de PDF não está disponível.
- **Dado** uma OS salva, **quando** o técnico solicita o PDF, **então** o sistema gera um
  documento fiel ao layout da planilha (cabeçalho fixo com dados da Med Fusion) e disponibiliza
  para download.
- **Dado** uma OS recém-criada, **então** o sistema envia automaticamente uma cópia do PDF para
  o cliente por e-mail e por WhatsApp — sem ação manual do técnico.
