# Contexto de domínio — Med Fusion OS

Este documento registra o vocabulário e as decisões de negócio levantadas na entrevista com o
cliente e na análise do controle manual atual (`public/OS.xlsx`, `public/exemplo-os-1.jpeg`,
`public/exemplos-os-2.jpeg`), para que essas fontes deixem de ser a única referência do domínio.

## Glossário

- **OS (Ordem de Serviço) / Orçamento Técnico** — o documento central do processo: registra o
  que foi solicitado por um cliente para um ou dois equipamentos, o defeito apresentado, a
  manutenção a aplicar e as peças usadas. Hoje é uma aba de Excel por atendimento; na v1 vira
  um registro no sistema com PDF gerado a partir dele.
- **Número da OS** — numeração sequencial crescente, controlada hoje pelo bloco físico de OS da
  empresa. Está em **1336** no momento da análise (07/11/2025 no exemplo mais recente). O sistema
  sugere o próximo número automaticamente, mas permite o técnico sobrescrever. Confirmado na
  validação de 07/09/2026: o **bloco físico deixa de ser usado assim que o sistema entrar em
  operação** — cada técnico terá login próprio, inclusive em campo (pelo celular), e não haverá
  mais motivo para o bloco de papel conviver em paralelo.
- **Tipo de atendimento** — checkboxes não excludentes na OS: `RETIRADO` (equipamento levado para
  a oficina), `GARANTIA`, `TREINAMENTO TÉCNICO`, `ORÇ. LOCAL` (orçamento feito no local do
  cliente), `LOCAÇÃO`.
- **Equipamentos (EQUIP 1 / EQUIP 2 na planilha)** — cada um com Equipamento, Marca, Modelo, N/S
  (número de série), PAT (patrimônio do cliente) e Acessórios. Na planilha o formulário só tem
  espaço para 2; **corrigido na validação de 07/09/2026: não há limite real** — clínicas menores
  atendem 5–10 equipamentos por OS, instituições maiores 50–100, e o maior caso já registrado
  (um hospital) chegou a 300. O sistema também passa a cadastrar o equipamento **por cliente**,
  reaproveitável entre OS's, em vez de redigitado a cada atendimento.
- **PAT** — número de patrimônio do equipamento no cliente. Confirmado opcional na validação:
  só costuma ser preenchido em clientes com controle de patrimônio ativo (prefeituras,
  hospitais); na maioria dos atendimentos fica em branco.
- **N/S** — número de série do equipamento.
- **Peças de reposição** — tabela de Quantidade / Descrição / Valor usada no orçamento
  apresentado ao cliente. Distinta do custo interno da peça (ver CUSTOS). Confirmado na validação:
  o **valor unitário é opcional**, não obrigatório como registrado antes — ver `valor_mao_obra`.
- **Valor de mão de obra** — campo novo, separado do valor das peças. Existem três formatos reais
  de orçamento apresentados ao cliente: só valor de peça, só valor de mão de obra (peça embutida —
  caso comum com prefeituras, para o total não ultrapassar o teto que dispara licitação), ou os
  dois valores separados (caso mais comum com clientes particulares).
- **Certificado** — documento à parte, gerado a partir de um modelo padrão por tipo de
  equipamento (ex.: modelo "bisturi"). Normalmente usa o **mesmo número da OS**. Fora da v1;
  o modelo de dados já prevê o campo `certificado_numero` em `orders` para o vínculo futuro.
  Confirmado na validação: continuam sendo emitidos manualmente por enquanto, seguindo a
  numeração da OS gerada pelo sistema para não haver duplicidade; a empresa tem mais de
  100–200 modelos diferentes (um por tipo de equipamento/finalidade/parâmetro de análise) e vai
  enviá-los para quando a emissão automática entrar em desenvolvimento.
- **Status da OS** — campo sem equivalente na planilha (o controle de andamento hoje é
  informal), introduzido na v1 porque o backlog já depende dele. **[proposto — aguardando
  confirmação do cliente, validação de 07/09/2026]** Fluxo ampliado:
  `aberta` → `em_analise` → `orcamento_externo` (opcional, quando enviado a terceiro para
  avaliação) → `aguardando_aprovacao` → `aprovada` → `concluida`; `cancelada` alcançável a
  partir de qualquer estado anterior a `aprovada`. `garantia` é uma reabertura especial: só a
  partir de `concluida`, dentro do prazo de garantia, quando o mesmo equipamento volta com
  retrabalho — reabre a **mesma OS** (não cria uma nova) e depois volta a fluir para `concluida`.
  Serve para a empresa medir quantos retrabalhos aconteceram num período.
- **Notificação automática** — a partir da validação: ao registrar a OS, o sistema envia
  automaticamente uma cópia do PDF ao cliente por e-mail e por WhatsApp.
- **Observação** — campo de texto livre da OS, visto no exemplo real (`"Orçamento apenas de
  peças, mão de obra inclusa no contrato."`). Mapeado para `orders.observacao`.
- **Aba CUSTOS** (fora da v1) — controle interno de margem por OS, não visto pelo cliente:
  - custo de cada peça, fornecedor, contato, link de compra, e-mail e **status de compra**
    (`em estoque` / `á comprar` / `comprado`), com data de compra e previsão de entrega;
  - custos de viagem do atendimento (combustível, café da manhã/tarde, hotel, almoço/jantar);
  - controle de pagamento: condição, forma, contato, whatsapp, **status do laudo**
    (`OK` / `Ñ OK`), protocolo de entrega, recibo.

## Decisões de escopo (registradas na entrevista de planejamento)

| Tema | Decisão |
|---|---|
| Escopo v1 | Clientes + OS completa (aba `O.S`) + PDF |
| Numeração | Auto-sugerida a partir de 1336, editável, com validação de duplicidade |
| Certificados | Não implementados na v1; apenas campo de vínculo modelado |
| Aba CUSTOS | Backlog pós-v1 |
| PDF | Gerado no backend (Laravel + dompdf), guardado no Object Storage do Laravel Cloud, consumido pelo frontend |
| UI | Angular Material |
| Autenticação | Sanctum em modo token (Bearer); poucos técnicos, sem papéis/permissões |
| Hospedagem | Frontend na Vercel; API + banco (Laravel MySQL) no Laravel Cloud |
| Ambientes | Local e produção apenas — sem staging na v1 |
| Contrato da API | `openapi.yaml` escrito à mão (spec-first), em `medfusion-os-api/docs/` |
| Equipamentos por OS | Corrigido 07/09/2026: sem limite (era "até 2"); catálogo reaproveitável por cliente |
| Valor de peça | Corrigido 07/09/2026: opcional (era "sempre obrigatório"); novo campo `valor_mao_obra` |
| Status da OS | Ampliado 07/09/2026 (8 estados, com reabertura por garantia) — **proposto, aguardando confirmação** |
| Notificação | Novo 07/09/2026: envio automático do PDF por e-mail e WhatsApp na criação da OS |
| Bloco físico de OS | Confirmado 07/09/2026: descontinuado assim que o sistema entrar em operação |

## Validação com o cliente (07/09/2026)

O escopo da v1 foi apresentado ao cliente numa rodada de mensagens de WhatsApp (linguagem de
negócio, sem termos técnicos), cobrindo a jornada da OS, o que o sistema faz, o que fica para
depois e 5 pontos em aberto. O cliente respondeu por áudio. Nenhum ponto ficou sem resposta; as
correções e novidades levantadas estão registradas nos itens do glossário acima e na tabela de
decisões. Resumo do que mudou em relação ao que estava fechado antes dessa rodada:

- **Corrigido**: limite de equipamentos por OS (era 2, agora sem limite) e obrigatoriedade do
  valor da peça (agora opcional, com `valor_mao_obra` como campo novo).
- **Confirmado sem mudança**: PAT opcional, certificados e custos internos seguem fora da v1,
  acesso por técnico como desenhado.
- **Novo pedido de escopo**: catálogo de equipamentos reaproveitável por cliente; notificação
  automática da OS por e-mail e WhatsApp — os dois entram na v1 (WhatsApp via API oficial do
  WhatsApp Cloud da Meta, o que exige verificação de conta comercial pelo cliente).
- **Ainda em aberto**: o fluxo de status ampliado foi montado a partir do que o cliente descreveu,
  mas a confirmação exata do desenho ainda não fechou — segue uma segunda rodada de validação.

Decisões detalhadas e critérios de aceite: [`medfusion-os-web/docs/escopo-v1.md`](./docs/escopo-v1.md),
[`medfusion-os-api/docs/openapi.yaml`](https://github.com/celsojuniorsfs/medfusion-os-api/blob/main/docs/openapi.yaml)
e [`medfusion-os-api/docs/ambientes.md`](https://github.com/celsojuniorsfs/medfusion-os-api/blob/main/docs/ambientes.md).

O backlog completo, organizado por fase do ciclo de desenvolvimento (Planejamento → Análise →
Projeto → Programação → Testes → Implantação), está nas issues e milestones deste repositório e
do [medfusion-os-api](https://github.com/celsojuniorsfs/medfusion-os-api).
