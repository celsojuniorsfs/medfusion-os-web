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
  sugere o próximo número automaticamente, mas permite o técnico sobrescrever — o bloco físico
  pode, na prática, ser usado em paralelo.
- **Tipo de atendimento** — checkboxes não excludentes na OS: `RETIRADO` (equipamento levado para
  a oficina), `GARANTIA`, `TREINAMENTO TÉCNICO`, `ORÇ. LOCAL` (orçamento feito no local do
  cliente), `LOCAÇÃO`.
- **EQUIP 1 / EQUIP 2** — a OS suporta até dois equipamentos por atendimento, cada um com
  Equipamento, Marca, Modelo, N/S (número de série) e PAT (patrimônio do cliente).
- **PAT** — número de patrimônio do equipamento no cliente (nem sempre preenchido).
- **N/S** — número de série do equipamento.
- **Peças de reposição** — tabela de Quantidade / Descrição / Valor usada no orçamento
  apresentado ao cliente. Distinta do custo interno da peça (ver CUSTOS).
- **Certificado** — documento à parte, gerado a partir de um modelo padrão por tipo de
  equipamento (ex.: modelo "bisturi"). Normalmente usa o **mesmo número da OS**. Fora da v1;
  o modelo de dados já prevê o campo `certificado_numero` em `orders` para o vínculo futuro.
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
| PDF | Gerado no backend (Laravel + dompdf), consumido pelo frontend |
| UI | Angular Material |

O backlog completo, organizado por fase do ciclo de desenvolvimento (Planejamento → Análise →
Projeto → Programação → Testes → Implantação), está nas issues e milestones deste repositório e
do [medfusion-os-api](https://github.com/celsojuniorsfs/medfusion-os-api).
