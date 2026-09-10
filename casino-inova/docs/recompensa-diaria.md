# Recompensa diária — o que existe, o que falta, e o que conflita

Especificação registrada a pedido do produto. **Nada aqui foi implementado ainda** — este
documento existe para que a implementação não recrie o que já está no ar e não passe por
cima de decisões que já foram tomadas com motivo.

---

## 1. O que JÁ EXISTE no servidor

Isto está no ar, tem conferência (`npm run verify:recompensas`) e **não deve ser recriado**:

| Peça | Onde | O que faz |
|---|---|---|
| Tabela | `daily_rewards` | `user_id` (PK), `last_claim_day` (1–30), `last_claim_on` (DATE), `streak` |
| Calendário | `recompensas/calendario.ts` | 30 dias, marcos em 7/14/21/30, valor de cada dia |
| Sequência | `estadoDaSequencia()` | fronteira do dia em **UTC**; perdeu um dia, volta ao dia 1 |
| Coleta | `RecompensasService.coletar()` | trava de corrida via `ON CONFLICT … WHERE last_claim_on < CURRENT_DATE` |
| Extrato | origem `recompensa-diaria` | toda coleta já aparece no histórico da carteira |
| Rotas | `recompensas.controller.ts` | calendário e coleta |

E os **assets já existem** em `app/assets/images/recompensas/` — não gerar de novo:

| Arquivo | Serve para |
|---|---|
| `selo-dia-fechado.png` | dia **LOCKED** (futuro) |
| `selo-dia-aberto.png` | dia **AVAILABLE** (hoje, dá pra coletar) |
| `selo-dia-coletado.png` | dia **CLAIMED** |
| `cofre-do-mes.png` | o marco de fim de mês |
| `brilho-coletar.png` | o brilho da animação de coleta |
| `pilha-fichas-{pequena,media,grande}.png` | as faixas de valor |
| `fundo-recompensas-{celular,computador}` | o fundo da tela |

**MISSED não tem asset, e não precisa ter.** O dia perdido é o selo fechado dessaturado e
com opacidade menor, por código — mesmo desenho, outro estado. Criar uma décima imagem
para dizer "este dia passou" seria gastar arte para repetir informação que a posição no
calendário já dá.

**Não existe tela.** Nada em `app/src/` referencia esses arquivos hoje.

---

## 2. Os quatro conflitos entre o que existe e o que foi pedido

Estes precisam de decisão antes de qualquer código. Nenhum é bug: os dois lados têm razão
escrita, e é por isso que a escolha é do produto.

### 2.1 O prêmio sai do SALDO hoje; o pedido é sair do NÍVEL

Hoje: `prêmio = mínimo da mesa do saldo atual × multiplicador do dia`.

A razão registrada em `calendario.ts` é boa: *"dez mil fichas é uma banca inteira pra quem
começou e é troco pra quem tem noventa e nove bilhões"*. E quem zera a conta cai em Bronze
e recebe o de Bronze — **exatamente o suficiente para sentar numa mesa Bronze e jogar de
novo**. Isso é um piso funcionando, e a recompensa diária existe justamente como caminho
de volta para quem quebrou.

O pedido (item 19) desmonta isso por outro motivo, também correto: com o saldo na fórmula,
**quem é rico recebe mais por já ser rico**, e o valor despenca no dia seguinte a uma
perda grande — o oposto de um piso.

**Recomendação:** trocar saldo por nível, como pedido, **mas preservar o piso**. O nível
representa progressão, que é o que se quer premiar; o piso se mantém garantindo que a
recompensa nunca fique abaixo de N apostas mínimas da mesa Bronze. As duas coisas cabem
juntas, e é o §4 que precisa ser aprovado para valer.

### 2.2 O calendário tem 30 dias fixos; o pedido é o mês real

`DIAS_DO_CALENDARIO = 30`, e o banco reforça: `CHECK (last_claim_day BETWEEN 1 AND 30)`.

Precisa virar o mês de verdade — 28, 29, 30 ou 31 —, o que muda a constante, o `CHECK` e o
marco de fim de mês (hoje fixo no dia 30). Fevereiro e ano bissexto saem de graça se a
conta usar o calendário real (`new Date(ano, mes, 0).getDate()`), e não uma tabela à mão.

### 2.3 Existe janela entre marcar e pagar

Em `coletar()`, a linha é marcada como coletada **antes** de `wallet.credit`. Se o processo
morrer entre as duas, a pessoa fica marcada como tendo coletado **e não recebe** — e não
pode coletar de novo.

É o mesmo problema que o P0.2 resolveu para as rodadas, e lá a ordem ficou certa: registrar
antes de mexer no dinheiro, para o pior caso ser uma rodada aberta e visível em vez de
dinheiro movido sem explicação. Aqui está ao contrário: o pior caso é **dinheiro não movido
com a marca já gravada**, que é invisível.

A correção é a mesma receita: `claimId`, uma linha de coleta gravada antes, e o crédito
amarrado a ela na mesma transação — o que também entrega a idempotência que o item 12 pede.

### 2.4 Duas definições de "dia" no mesmo arquivo

`estadoDaSequencia()` usa **UTC**; o SQL usa **`CURRENT_DATE`**, que é a data do fuso do
servidor de banco. Aqui coincidem porque este Postgres está em `Etc/UTC` — mas isso é
propriedade do ambiente, não do código. Num host com outro fuso, as duas discordam, e é
exatamente o bug do item 9 ("23:59 coletou, 00:01 o sistema acha que foram dois dias").

Correção: uma única fonte para a fronteira do dia, passada explicitamente ao SQL, nunca
`CURRENT_DATE`.

---

## 3. O que falta construir

Nenhum destes existe hoje.

| | Pedido |
|---|---|
| Tela | Calendário do mês, responsivo, com os selos que já temos |
| Modal | Aparece no login quando há recompensa; **a pessoa toca COLETAR** (não cai sozinha) |
| Estados | LOCKED · AVAILABLE · CLAIMED · MISSED |
| Marcos | 7, 14, 21 e **último dia do mês**, com brilho/moldura/selo por código — não 31 imagens |
| Multiplicador por nível | tabela do item 14, teto 2,5× |
| Crescimento por streak | tabela do item 15, separada da tabela de dias |
| `claimId` | idempotência de verdade (itens 12 e 22) |
| Histórico | jogador, data, streak, nível no momento, multiplicador, prêmio, `claimId` (itens 21 e 28) |
| Configuração | `daily_reward_config` versionada (item 20) |
| Notificação | **arquitetura compatível**, sem implementar push agora (item 27) |

### Sobre a troca de mês (item 23)

Concordo com a preferência do produto, e sem ressalva: **o streak não reseta por virar o
mês**. 31 de agosto e 1º de setembro são dias consecutivos, e a sequência é sobre dias
consecutivos. O calendário mensal é apresentação; a sequência é a regra. Não vejo problema
econômico nem técnico nisso — o único cuidado é que o *dia do calendário* mostrado e o
*tamanho do streak* passam a ser dois números diferentes, e a tela precisa dizer os dois
sem confundir.

---

## 4. A proposta econômica — **pendente, e obrigatória antes de congelar valores**

O produto pediu explicitamente para ver a tabela antes de qualquer número entrar no código.
Ela ainda não está feita. O que já está medido, e que ela precisa respeitar:

| | |
|---|---|
| Banca de boas-vindas | 10.000 fichas |
| Mesa Bronze | mínimo 50 · Prata 500 · Ouro 5.000 · Diamante 50.000 · ×10 por degrau |
| Maior pacote da loja | 120.000 fichas por R$ 149,90 |
| XP | `1 + √(aposta/10)`, teto 50 por rodada; nível N custa `500 + (N−1)×250` |
| **Recompensa de hoje, 30 dias** | **1.874 × o mínimo da mesa do saldo** |

**O número que obriga a mudança:** no degrau Diamante isso dá **93,7 milhões de fichas por
mês, de graça**, contra 120 mil do maior pacote pago — a recompensa diária vale **780
pacotes da loja por mês**. Acima de Prata, a loja deixa de ter função econômica.

A proposta terá: recompensa base, crescimento diário, multiplicadores por nível, os quatro
marcos, e o total de 30 dias para nível baixo, médio e alto, com o impacto estimado. **Sem
aprovação dela, nenhum valor entra no código.**

---

## 5. Os testes que o produto exigiu (item 29)

Primeira coleta · coleta duplicada · dois cliques simultâneos · queda de internet · login
em dois aparelhos · troca de dia · troca de mês · fevereiro · ano bissexto · mudança de
fuso · streak de 1 dia · streak longo · nível baixo, médio e alto · recompensa de marco ·
perda de um dia · reset correto · extrato · saldo · reconstrução após reinício do servidor.

Vale a mesma regra das outras conferências do projeto: cada uma tem que **falhar quando o
código quebra**. Conferência que passa sempre não prova nada, e as deste projeto são
testadas por mutação antes de contarem como prova.
