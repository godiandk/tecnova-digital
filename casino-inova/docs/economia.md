# A economia do Casino Inova — proposta para aprovação

**Nada aqui foi implementado.** É a proposta e a simulação que o produto pediu ver antes
de qualquer número entrar no código.

Tudo abaixo sai das constantes reais do projeto: `niveis-de-mesa.ts`, `progressao/niveis.ts`,
`recompensas/calendario.ts`, `store.service.ts` e o RTP medido do caça-níqueis (95,9922%).

---

## O achado que muda tudo, antes da proposta

**A recompensa diária de hoje é uma catraca de juros compostos. Ela leva qualquer conta ao
topo da escada de doze degraus em 171 dias — sem jogar uma única rodada.**

O prêmio é `mínimo da mesa do saldo × multiplicador do dia`. Quando o saldo sobe de degrau,
o mínimo multiplica por dez, e o prêmio do dia seguinte multiplica por dez junto. Só
coletando:

| Degrau | Chega no dia | Mínimo da mesa |
|---|---|---|
| Prata | 21 | 500 |
| Ouro | 30 | 5 mil |
| Diamante | 51 | 50 mil |
| Rubi | 60 | 500 mil |
| Safira | 81 | 5 mi |
| Esmeralda | 90 | 50 mi |
| Ônix | 111 | 500 mi |
| Platina | 120 | 5 bi |
| Titânio | 141 | 50 bi |
| Cristal | 150 | 500 bi |
| **Eclipse** | **171** | **5 tri** |

Saldo no dia 365, sem jogar: **102,3 quatrilhões de fichas.**

E a economia está **invertida** — jogar empobrece:

| Perfil | Rodadas/dia | Nível e saldo em 1 ano |
|---|---|---|
| casual | 60 | nível 88 · **44,2 quatrilhões** · Eclipse |
| regular | 200 | nível 155 · 7,6 quatrilhões · Eclipse |
| pesado | 800 | nível 94 · **14,1 mil** · Bronze |
| muito pesado | 2.000 | nível 94 · **50** · Bronze |

Quem joga muito fica preso no Bronze; quem só coleta chega ao topo.

### A régua que explica isso, e que governa a economia inteira

Na escada atual, `entrada(degrau) = 100 × mínimo(degrau)` e `mínimo(degrau+1) = 10 × mínimo(degrau)`.
Logo:

> **Subir um degrau custa cerca de 900 apostas mínimas de receita.**

A recompensa de hoje entrega **1.874 mínimos por mês** — duas larguras de degrau. Por isso
ela sobe a escada sozinha. **Qualquer receita proporcional ao próprio degrau e maior que
900 mínimos/mês sobe a escada**, seja ela de graça ou paga.

---

## A. A proposta

### Um conceito só: `economicTier`

```
economicTier = o MENOR entre
                 (o degrau que o SALDO banca)      ← ninguém senta onde não pode pagar
                 (o degrau que o NÍVEL liberou)    ← ninguém compra passagem que não jogou
```

Ele manda em tudo, como pedido: `economicTier → mesa → apostas → recompensa → loja`.

Precisa dos dois lados. Só saldo é a economia de hoje (e a catraca). Só nível deixaria
alguém sentar numa mesa que não pode pagar.

### As três fórmulas

```
bônusDeNível(L) = min(3,0 ; 1 + 0,5 × log10(L))        (+0,5× a cada década de nível)

recompensa(dia,L) = 50 × multDoDia(dia) × bônusDeNível(L)
                    └── ANCORADA NO BRONZE, nunca no saldo

pacote(preço,L)   = k(preço) × mínimo(economicTier) × bônusDeNível(L)
                    └── k = quantas apostas mínimas o preço compra
```

`k` calibrado para não tirar nada de quem já joga: no Bronze os quatro pacotes dão
exatamente o que dão hoje.

| Preço | k (apostas mínimas) | No Bronze, hoje e depois |
|---|---|---|
| R$ 9,90 | 100 | 5.000 |
| R$ 24,90 | 300 | 15.000 |
| R$ 59,90 | 800 | 40.000 |
| R$ 149,90 | 2.400 | 120.000 |

**A recompensa é de graça e o pacote é pago — e é por isso que só o pacote escala com a
mesa.** Escalar um presente pelo saldo é dar mais a quem já tem mais (o pedido 19 recusa
isso, com razão). Escalar um produto pago é entregar o mesmo valor por real em qualquer
degrau, que é o que faz a loja voltar a existir acima do Ouro.

### A curva do bônus

`+0,5× a cada vez que o nível multiplica por dez`, com teto em 3×. Forte no começo
(nível 1→10 já vale +50%), desacelerando sozinha (nível 1.000→10.000 vale só +0,5×).
Sem tabelas chumbadas: uma linha de código.

| Nível | 1 | 10 | 50 | 100 | 250 | 500 | 1.000 | 10.000 |
|---|---|---|---|---|---|---|---|---|
| Bônus | 1,00× | 1,50× | 1,85× | 2,00× | 2,20× | 2,35× | 2,50× | 3,00× |

---

## B. A simulação

Jogador regular, 200 rodadas/dia, apostando 2× o mínimo, sem comprar.

| Nível | Saldo esperado | Mesa | Aposta mín | Típica | R$ 9,90 | R$ 59,90 | R$ 149,90 | Daily/dia | Bônus |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 10,0 mil | Bronze | 50 | 100 | 5,0 mil | 40,0 mil | 120,0 mil | 3,1 mil | 1,00× |
| 10 | 15,2 mil | Bronze | 50 | 100 | 7,5 mil | 60,0 mil | 180,0 mil | 4,7 mil | 1,50× |
| 50 | 228,6 mil | Bronze | 50 | 100 | 9,2 mil | 74,0 mil | 221,9 mil | 5,8 mil | 1,85× |
| 100 | 577,0 mil | Prata | 500 | 1,0 mil | 100,0 mil | 800,0 mil | 2,4 mi | 6,2 mil | 2,00× |
| 250 | 238,7 mil | Prata | 500 | 1,0 mil | 109,9 mil | 879,6 mil | 2,6 mi | 6,9 mil | 2,20× |
| 500 | 51,9 mil | Prata | 500 | 1,0 mil | 117,5 mil | 939,8 mil | 2,8 mi | 7,3 mil | 2,35× |
| 1.000 | 59,8 mil | Prata | 500 | 1,0 mil | 125,0 mil | 1,0 mi | 3,0 mi | 7,8 mil | 2,50× |
| 2.500 | — | — | **não alcançável** | | | | | | |
| 5.000 | — | — | **não alcançável** | | | | | | |
| 10.000 | — | — | **não alcançável** | | | | | | |

### O mesmo, em poder de jogo — que é o que importa (pedido 4)

| Nível | Mesa | R$ 9,90 | R$ 59,90 | R$ 149,90 | Daily/mês | O daily sustenta |
|---|---|---|---|---|---|---|
| 1 | Bronze | 100 | 800 | 2.400 | 1.874 | 779 rodadas/dia |
| 50 | Bronze | 185 | 1.480 | 4.439 | 3.466 | 1.441 rodadas/dia |
| 100 | Prata | 200 | 1.600 | 4.800 | 375 | 156 rodadas/dia |
| 500 | Prata | 235 | 1.880 | 5.639 | 440 | 183 rodadas/dia |
| 1.000 | Prata | 250 | 2.000 | 6.000 | 468 | 195 rodadas/dia |

*(em apostas mínimas do degrau. Largura de um degrau = 900.)*

O pacote pequeno compra 100 rodadas no nível 1 e 250 no nível 1.000 — **em qualquer mesa**.
É a "regalia por tempo de casa" pedida, sem inflação: o número de fichas explode com o
degrau, o poder de jogo cresce 2,5×.

### O nível 10.000 não existe

Com a curva atual (`teto de 50 XP/rodada`, nível N custa `500 + (N−1)×250`):

| Nível | Rodadas necessárias | Jogando **sem parar** |
|---|---|---|
| 100 | 25.245 | 1,5 dia |
| 500 | 626.245 | 36 dias |
| 1.000 | 2,5 milhões | 145 dias |
| **10.000** | **250 milhões** | **40 anos** |

Mesmo recalibrando a curva (proposta: `500 + (N−1)×17,2`), o nível 1.000 leva **12 anos**
de jogo regular e o 2.500 não chega.

**Faixas de nível até 10.000 desenham uma tabela para jogadores que não existem.** Ou o
teto de nível vira ~1.000, ou a curva de XP muda de conceito (níveis pequenos, tipo passe
de temporada). É decisão de produto — ver §G.

---

## C. Impacto na loja

- **Quem está no Bronze não perde nada**: os quatro pacotes entregam exatamente o que
  entregam hoje.
- **A loja volta a existir acima do Ouro.** Hoje o maior pacote compra **2 apostas** no
  Diamante e **zero** no Rubi. Depois, compra 2.400 em qualquer degrau.
- **Promoções** entram como bônus percentual sobre `k(preço)`, nunca sobre o preço — assim
  uma promoção não cria um preço novo que precise existir em três moedas.

## D. Impacto nas apostas e mesas

- As apostas continuam saindo do `economicTier`, e o seletor de aposta (já implementado)
  já lê o degrau certo.
- **Muda uma coisa:** o degrau passa a exigir nível, além de saldo. Comprar fichas dá
  **mais rodadas na sua mesa**, não passagem para a mesa de cima. Sem isso, quem compra cai
  numa mesa que não consegue sustentar.
- **Truco, Pôquer e Dominó** têm buy-in fixo em 100–5.000 e ignoram a escada. Entram aqui:
  buy-in = `k × mínimo(economicTier)`.

## E. Impacto na recompensa diária

- **A catraca morre.** Um ano só coletando: de 102,3 quatrilhões para **1,1 milhão**.
- Ela vira o que deve ser: um **piso**. Garante jogo diário na mesa de entrada, e o nível
  aumenta o piso até 3×.
- Marcos em 7, 14, 21 e **no último dia do mês** — proporcional, então fevereiro (28 ou 29)
  funciona sem tabela à mão.
- Sequência quebrada volta ao dia 1; virar o mês **não** quebra sequência.

---

## F. Inflação, exploits e maneiras de abusar

### 1. A catraca de graça — **resolvida**
Ancorar a recompensa no Bronze corta o laço. Medido: 102,3 qua → 1,1 mi em um ano.

### 2. A catraca paga — **resolvida pelo freio de nível**
Sem freio: R$ 149,90/mês sobe **um degrau por mês**; R$ 1.800 chegam ao Eclipse em um ano,
e depois não há mais nada para comprar. Com `economicTier` limitado pelo nível, comprar não
passa da progressão.

### 3. **Apostar o mínimo é estritamente a melhor estratégia — e isso quebra o freio de nível**

Este é o problema **não resolvido**, e ele é anterior a esta proposta.

A fórmula é `1 + √(aposta/10)`, com teto 50. O "+1" fixo domina apostas pequenas:

| Aposta | XP/rodada | XP por 1.000 fichas apostadas | vs. mínimo |
|---|---|---|---|
| 50 | 3 | 60,00 | 100% |
| 500 | 8 | 16,00 | 27% |
| 5.000 | 23 | 4,60 | 8% |
| 24.010 | 50 | 2,08 | 3,5% |
| 5 milhões | 50 | 0,01 | **0,02%** |

Apostar o mínimo rende **29× mais XP por ficha** que apostar no teto — **e perde 29× menos
para a casa**, porque a margem é proporcional à aposta. Não há troca: é melhor nos dois
eixos.

Com a proposta isso fica pior: quem otimiza sobe de nível rápido, **libera as mesas altas e
nunca joga nelas**. O nível deixa de significar "joga nessa escala", e o freio de nível
deixa de frear.

**Precisa ser corrigido junto.** A forma natural: XP proporcional ao **volume apostado em
unidades do mínimo da mesa** (`XP = c × aposta / mínimo`), com teto — assim o nível mede
quanto se jogou *na escala em que se joga*, e apostar o mínimo deixa de ser ótimo.

### 4. A fronteira de degrau na loja
Uma ficha separa Diamante de Rubi, e o pacote grande vai de 300 mi para 3 bi. Convida a
completar o saldo antes de comprar. Não é lucro (é preciso ter o saldo), mas é um degrau
de 10×. Suavizar ou aceitar — recomendo **aceitar**, porque espelha a escada que a pessoa
já vê nas mesas.

### 5. Data e fuso na recompensa
Já registrado em `recompensa-diaria.md`: hoje há **duas definições de dia** no mesmo arquivo
(UTC no código, `CURRENT_DATE` no SQL). Coincidem só porque este Postgres está em `Etc/UTC`.

### 6. A janela entre marcar e pagar
Também já registrado: a coleta marca antes de creditar. Se o processo morrer no meio, a
pessoa fica marcada e **não recebe**.

---

## G. Valores recomendados, e as decisões que são suas

### Recomendo aprovar

1. `economicTier = min(degrau do saldo, degrau do nível)` — um conceito, tudo derivando dele.
2. Recompensa **ancorada no Bronze** × bônus de nível. Mata a catraca.
3. Pacote = `k(preço) × mínimo(economicTier) × bônus de nível`, com `k` = 100/300/800/2.400.
4. Bônus = `min(3,0 ; 1 + 0,5·log10(nível))`.
5. Um degrau liberado a cada **85 níveis** (Eclipse no nível 935).
6. Marcos em 7, 14, 21 e último dia do mês.

### Três decisões que preciso de você

**1. O XP (§F.3) — o mais importante.** Sem corrigir, o freio de nível não segura nada.
Recomendo `XP = aposta / mínimo da mesa`, com teto por rodada. Confirma?

**2. O teto de nível.** Com qualquer curva sã, o nível 10.000 é ficção. Duas saídas:
   - **(a)** teto real em ~1.000, faixas de 85 em 85 — *é o que recomendo*;
   - **(b)** manter 10.000 mudando o conceito de nível para incrementos pequenos (tipo
     passe de temporada), o que torna cada nível quase irrelevante.

**3. A escada de doze degraus.** Ela é a raiz de todos estes problemas: 10¹¹ de amplitude
faz qualquer receita proporcional explodir, e produz saldos em quatrilhões. Uma escada
mais curta (8 degraus × 4 = 16 mil de amplitude) resolveria por construção. **Não recomendo
mexer agora** — está construída, conferida e usada pelos dez jogos —, mas fica registrado
que a proposta acima é o conserto *dentro* da escada atual, não o conserto *da* escada.

---

**Nenhum destes números entra no código antes da sua aprovação.** Depois dela, a ordem é:
economia → loja → recompensa diária → apostas, sobre a mesma fundação.
