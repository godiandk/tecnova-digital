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

**Corrigido — a curva nova está no §H.**

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


---

# H. A curva de XP nova

## A tensão que precisa ser dita antes da fórmula

Dois dos requisitos são **matematicamente incompatíveis** ao pé da letra:

- *"deve existir retorno decrescente"* → a função é côncava;
- *"apostar pouco não pode ser exploit"* → XP por ficha não pode cair com a aposta.

Se a função é côncava, **XP por ficha cai sempre** — é a definição de concavidade. A única
função com XP/ficha constante é a linear, que o próprio pedido proíbe (*"não quero XP
simplesmente 100% proporcional à aposta"*).

Então a pergunta certa não é *por ficha*, é **por rodada** — porque o que limita uma pessoa
é **tempo**, não fichas. Quem aposta o mínimo precisa de muito mais rodadas.

A curva escolhida trata os três eixos separadamente:

| Eixo | O que acontece | Por quê |
|---|---|---|
| por **rodada** | apostar grande ganha 4,5× | é o eixo de quem joga com o dedo |
| por **ficha** | apostar pequeno ainda ganha, mas **4×** em vez de **29×** | é o preço do retorno decrescente |
| por **dia** | **teto** | é o que trava robô e automação |

## A fórmula

```
r  = aposta / mínimo do economicTier DA PESSOA     ← em unidades da mesa, nunca em fichas
XP = min(60 ; 50 × ln(1 + r) / ln(21))
teto diário: 60.000 XP
```

**`r` em unidades da mesa é o que impede pay-to-level.** Um Bronze apostando 20× o mínimo
(1.000 fichas) e um Eclipse apostando 20× o mínimo (100 trilhões) ganham **exatamente o
mesmo XP**. Dinheiro compra fichas → fichas compram mesa alta → **mas mesa alta não dá XP**.
O que dá XP é jogar grande *para a sua mesa*, e isso todo mundo pode fazer.

| Aposta | XP/rodada | XP por 1.000 fichas | vs mínimo | Rodadas p/ 1.000 XP |
|---|---|---|---|---|
| 1× (mínimo) | 11 | 220,00 | 100% | 91 |
| 2× | 18 | 180,00 | 82% | 56 |
| 5× | 29 | 116,00 | 53% | 34 |
| 10× | 39 | 78,00 | 35% | 26 |
| 25× | 53 | 42,40 | 19% | 19 |
| 50× | 60 (teto) | 24,00 | 11% | 17 |
| 100× | 60 | 12,00 | 5% | 17 |
| 500× | 60 | 2,40 | 1% | 17 |
| 1.000× | 60 | 1,20 | 1% | 17 |

## O custo de cada nível

`custo(N) = 197 × √N` — calibrado para o hardcore alcançar o nível 10.000 em **6 anos**.

| Nível | Custo do nível | XP acumulado | casual | regular | ativo | hardcore |
|---|---|---|---|---|---|---|
| 10 | 623 | 3.804 | 1 dia | 5 h | 2 h | 2 h |
| 50 | 1.393 | 45.698 | 13 dias | 3 dias | 23 h | 18 h |
| 100 | 1.970 | 130.309 | 36 dias | 7 dias | 3 dias | 2 dias |
| 250 | 3.115 | 517.550 | 4,7 meses | 30 dias | 11 dias | 9 dias |
| 500 | 4.405 | 1.466.112 | 13,4 meses | 2,8 meses | 31 dias | 24 dias |
| 1.000 | 6.230 | 4.149.977 | 3,2 anos | 7,8 meses | 2,9 meses | 2,3 meses |
| 2.500 | 9.850 | 16.411.709 | 12,5 anos | 2,6 anos | 11,5 meses | 9,0 meses |
| 5.000 | 13.930 | 46.426.355 | 35,3 anos | 7,3 anos | 2,7 anos | 2,1 anos |
| **10.000** | 19.700 | 131.323.444 | 99,9 anos | 20,7 anos | 7,7 anos | **6,0 anos** |

*perfis: casual 200 rodadas/dia a 2× · regular 600 a 5× · ativo 1.200 a 10× · hardcore 2.400 a 20×
(o hardcore bate no teto diário — é ele que impede o robô de correr mais que o humano)*

**O nível 10.000 existe e é prestígio de verdade**: seis anos de jogo pesado, vinte para o
regular. E as faixas caem onde você descreveu:

| Faixa | Nome | regular | ativo | hardcore |
|---|---|---|---|---|
| 1–20 | onboarding | 16 h | 6 h | 5 h |
| 21–100 | progressão normal | 7 dias | 3 dias | 2 dias |
| 101–500 | experiente | 2,8 meses | 31 dias | 24 dias |
| 501–1.000 | veterano | 7,8 meses | 2,9 meses | 2,3 meses |
| 1.001–2.500 | elite | 2,6 anos | 11,5 meses | 9,0 meses |
| 2.501–5.000 | extremamente raro | 7,3 anos | 2,7 anos | 2,1 anos |
| 5.001–10.000 | prestígio | 20,7 anos | 7,7 anos | 6,0 anos |

## Os degraus econômicos passam a abrir pelo nível

Doze degraus, dez mil níveis — e o Eclipse no topo dos dois:

| Degrau | Nível | regular | ativo | hardcore |
|---|---|---|---|---|
| Bronze | 1 | — | — | — |
| Prata | 20 | 16 h | 6 h | 5 h |
| Ouro | 50 | 3 dias | 23 h | 18 h |
| Diamante | 100 | 7 dias | 3 dias | 2 dias |
| Rubi | 200 | 21 dias | 8 dias | 6 dias |
| Safira | 400 | 2,0 meses | 22 dias | 17 dias |
| Esmeralda | 700 | 4,6 meses | 52 dias | 40 dias |
| Ônix | 1.200 | 10,3 meses | 3,8 meses | 3,0 meses |
| Platina | 2.000 | 22,2 meses | 8,3 meses | 6,4 meses |
| Titânio | 3.500 | 4,3 anos | 19,1 meses | 14,9 meses |
| Cristal | 6.000 | 9,6 anos | 3,6 anos | 2,8 anos |
| **Eclipse** | **10.000** | 20,7 anos | 7,7 anos | 6,0 anos |

## Exploits da curva nova

| | Situação | Estado |
|---|---|---|
| **A** | **Sentar numa mesa abaixo da sua.** Se o XP usasse o mínimo da *mesa*, um Rubi apostando 500.000 numa mesa Diamante ganharia 39 XP em vez de 11 — **3,5× de graça** | **fechado**: o XP usa o mínimo do `economicTier` **da pessoa**, não o da mesa onde ela sentou |
| **B** | **Empobrecer de propósito.** Num degrau baixo, o mesmo XP custa menos fichas (Ouro: 100 mil por 60 XP; Rubi: 10 milhões) | **contido**: `economicTier = min(saldo, nível)`. Quem fica pobre tem nível alto e degrau baixo — o ganho para no bônus, com teto de 3× |
| **C** | **Robô no mínimo.** 5.455 rodadas/dia para bater o teto, contra 1.200 do humano na ficha maior | **contido pelo teto diário**: os dois batem no mesmo teto de 60.000 XP. O robô gasta menos fichas mas **não sobe mais rápido** |
| **D** | **Comprar nível com aposta gigante.** Teto de 60 XP/rodada; um nível de prestígio custa 19.700 XP | **fechado**: são 328 rodadas no mínimo, aposte-se o que for |
| **E** | **Resultado da partida.** O XP sai da aposta feita, nunca do prêmio | **já era assim**, e precisa continuar. Em blackjack, `double` e `split` contam como volume apostado |

---

# I. O número que governa o produto inteiro

Com a recompensa entregando 1.874 mínimos/mês e a casa ficando com 4,01% de cada aposta,
**quantas rodadas por dia a economia grátis banca:**

| Aposta | nível 1 | nível 100 | nível 1.000 | nível 10.000 |
|---|---|---|---|---|
| 1× o mínimo | 1.559 | 3.117 | 3.897 | 4.676 |
| 2× | 779 | 1.559 | 1.948 | 2.338 |
| **5×** | **312** | **623** | **779** | **935** |
| 10× | 156 | 312 | 390 | 468 |
| 20× | 78 | 156 | 195 | 234 |

É o **mesmo número em qualquer degrau** — os dois lados são múltiplos do mínimo da mesa.

> **A economia grátis banca cerca de 300 rodadas por dia apostando 5× o mínimo.
> Acima disso, o jogador precisa ganhar ou comprar.**

Esse é o modelo de negócio, e agora ele está **escrito em número** em vez de suposto.

E é isso que explica a inversão da simulação:

| Perfil | Perde por mês | Recompensa por mês | |
|---|---|---|---|
| casual | 481 mín | 4.685 mín | sobra |
| regular | 3.607 mín | 4.685 mín | sobra |
| ativo | 14.428 mín | 4.685 mín | **falta** |
| hardcore | 57.712 mín | 4.685 mín | **falta** |

Não é defeito de fórmula: é a margem da casa encontrando um subsídio fixo.

---

# J. A decisão que sobra, e é sua

**Onde a recompensa diária é ancorada.** As duas saídas são defensáveis e dão jogos
diferentes:

### Âncora A — no **Bronze** (o piso)
- Jogador grátis vive no Bronze/Prata **para sempre**, em qualquer nível.
- Degraus 3 a 12 são para quem **ganha grande ou compra**.
- **Zero inflação.** A loja fica sendo o caminho, e vale muito.
- Custo: o bônus de nível (teto 3×) **nunca** alcança um degrau que está 10× acima, então
  a progressão de nível não muda onde a pessoa joga.

### Âncora B — no **`economicTier`** (limitado pelo nível)
- A recompensa acompanha o degrau que a progressão liberou.
- Jogador casual chega a **Platina em 10 anos**; o nível é o freio, não o saldo.
- Custo: **a catraca volta em versão fraca** — quem joga pouco acumula. Medido: casual
  chega a 423 trilhões em 10 anos, enquanto ativo e hardcore quebram.

**Recomendo a Âncora A**, por três razões: não inflaciona, faz a loja ter função, e mantém
a recompensa sendo o que ela foi criada para ser — *o caminho de volta para quem zerou*, e
não um salário. Se a Âncora B for a escolhida, recomendo cortar os multiplicadores de dia
pela metade, senão a inversão fica pior.

---

A ordem de execução é: XP → `economicTier` → apostas → loja → recompensa diária, sobre a
mesma fundação.

---

# K. O que já está implementado, e onde a implementação divergiu da proposta

Esta seção é o registro do que saiu do papel. Ela existe para que a proposta acima não
vire a versão "oficial" de coisas que o código faz diferente.

## Etapa 1 — XP (feita)

| Peça | Onde | Estado |
|---|---|---|
| Curva `50 × ln(1+r) / ln(21)`, com `r = aposta / mínimo do degrau` | `progressao/niveis.ts` | feito |
| Custo do nível `197 × √N` | `progressao/niveis.ts` | feito |
| Teto de 60.000 XP por dia, com o dia zerando sozinho | `users.service.ts` + `users.xp_do_dia` | feito |
| Nível máximo 10.000 de verdade, no código | `NIVEL_MAXIMO` | feito |
| XP ligado aos dez jogos e às três salas | `tournaments.recordRound` | feito |
| Régua de dia única, em UTC | `comum/dia-do-servidor.ts` | feito |
| 6 conferências de XP + 5 de calendário + 5 de ponta a ponta | `verify-xp`, `verifica-dia-do-servidor`, `verify-tournaments` | feito |

### Três coisas que a implementação descobriu, e que a proposta não previa

**1. A barra JÁ andava.** A auditoria dizia que `xpDaRodada` era chamado só no torneio e
que os dez jogos não davam XP. Errado: `recordRound` é o funil, e os dez jogos e as três
salas passam por ele. O defeito real era outro e mais sutil — a conta antiga olhava só o
NÚMERO DE FICHAS, e número de fichas depende do degrau. Quem comprava fichas e subia de
mesa apostava mais fichas pela mesma jogada, e subia de nível mais rápido. Era
pay-to-level, só que por acidente.

**2. A trava de 100 níveis por chamada estourava a barra.** `somarXp` parava de subir
depois de cem níveis numa chamada só. Dez milhões de XP de uma vez levavam ao nível 102
com **9.865.741 de XP sobrando** numa barra que segura 1.990 — cheia muito além do fim. O
teto certo não é "cem por vez", é o topo da escada: `NIVEL_MAXIMO = 10.000`. Acima dele o
XP some, e isso está dito no código: não existe nível pra comprar com ele.

**3. Um piso de 1 XP por rodada.** Quem desce um degrau pra jogar barato num dia ruim
aposta muito abaixo do mínimo do próprio degrau; `r` fica em 0,02 e a conta arredondava
pra **zero**. Uma rodada jogada de verdade valendo zero parece defeito. O piso não dá pra
farmar: a 1 XP por rodada seriam 60.000 rodadas pra encher o teto do dia, contra 5.455
apostando o mínimo do próprio degrau.

### O guarda do saldo

O XP precisa do saldo de ANTES da rodada, e a direção do erro importa: saldo alto = degrau
alto = mínimo alto = **menos** XP pela mesma ficha. Quem quisesse fraudar isto quereria o
saldo **baixo**. Então um saldo que não se sustenta (menor que a própria aposta — que é
impossível) paga o **piso**, não o máximo, e fica registrado como defeito de programação.

Foi por isso que o saldo de antes virou parâmetro **obrigatório** de `recordRound`: um
valor padrão silencioso ali seria um jogo novo passando o degrau errado sem ninguém
perceber. Exigido, o compilador acha.

### Os números, conferidos rodando

| | XP/dia | nível 20 | nível 100 | nível 1.000 | nível 10.000 |
|---|---|---|---|---|---|
| casual (30 rodadas no mínimo) | 330 | 34 d | 13 meses | 34 anos | — |
| médio (150 rodadas em 5×) | 4.350 | 3 d | 30 d | 3 anos | 83 anos |
| pesado (batendo o teto diário) | 60.000 | 5 h | 2 d | 69 d | **6,0 anos** |

- aposta mínima: **11 XP**; ficha maior (20×): **50 XP** — 4,5× por rodada
- por ficha, o mínimo rende **4,4×** mais que a ficha maior (a fórmula antiga dava **29×**)
- primeiro nível em **18 rodadas** de aposta mínima
- teto do dia: **5.455** rodadas no mínimo ou **1.200** na ficha maior — o mesmo lugar

**Oito mutações deliberadas foram testadas** (divisor fixo, teto por rodada acima do custo
do nível 1, curva de custo antiga, teto diário solto, subir um nível por chamada, sem teto
de nível, `noTopo` sempre falso, curva reta) e **as oito foram pegas** pelas conferências.

## Etapa 2 — `economicTier` e as apostas (feita)

| Peça | Onde | Estado |
|---|---|---|
| `degrauEconomico = min(saldo, nível)` | `games/shared/niveis-de-mesa.ts` | feito |
| Níveis de abertura (Bronze 1 … Eclipse 10.000) | `NIVEL_PARA_ABRIR_O_DEGRAU` | feito |
| `DegrauDoJogador`: saldo, nível e degrau num lugar só | `games/shared/degrau-do-jogador.service.ts` | feito |
| Os 7 jogos contra a casa validam pelo degrau econômico | cada `*.service.ts` | feito |
| Truco, dominó e pôquer saem do buy-in fixo 100–5.000 | `faixaDeEntrada`, `problemaComAEntrada` | feito |
| As entradas oferecidas são `k × mínimo(economicTier)`, k ∈ {1, 2, 5, 10, 20} — as fichas do degrau | `config.entradas` | feito |
| Cegas do pôquer proporcionais ao buy-in | `apostasDaMesa` | feito |
| `/niveis/meu` e `/niveis/escada` publicam o freio de nível | `niveis.controller.ts` | feito |
| Seletor de entrada no lugar dos 5 steppers de `+`/`−` | `aposta/SeletorDeEntrada.tsx` | feito |
| Espelho do degrau no aplicativo, conferido contra o servidor | `aposta/degrau.ts` | feito |

### O exploit que o `economicTier` abriu, e que foi fechado junto

Travar o degrau pelo nível cria um jogador novo: **rico e preso numa mesa barata**. Como
não existe aposta máxima (é decisão do dono do jogo), esse jogador podia apostar cem vezes
o mínimo do Bronze e levar o teto de XP em toda rodada — 20% a mais que quem aposta a ficha
maior honestamente. Comprar fichas voltaria a acelerar o nível, por outra porta.

**Fechado**: o `r` da fórmula de XP para na ficha maior (`R_DE_REFERENCIA = 20`). Apostar
acima dela continua permitido; só não rende XP a mais. Isso baixou o teto por rodada de 60
para **50 XP** — e o teto por rodada nunca foi o que governa a progressão (quem governa é o
teto diário de 60.000), então os prazos até o nível 10.000 não mudaram.

### O que cada jogador vê agora

| | saldo | nível | degrau | mínimo da mesa | buy-in do truco |
|---|---|---|---|---|---|
| começou hoje | 10 mil | 1 | Bronze | 50 | 50 a 1.000 |
| comprou muito, nível 1 | 5 quatrilhões | 1 | **Bronze** | 50 | 50 a 1.000 |
| jogou muito, sem fichas | 0 | 10.000 | **Bronze** | 50 | — |
| jogou e tem banca | 1 bilhão | 400 | Safira | 5 milhões | 5 mi a 100 mi |

O `/niveis/meu` manda `travadoPeloNivel` e `proximaPorNivel` para a tela poder dizer, com o
número: *"seu saldo alcança a mesa Ouro; ela abre no nível 50"*. Uma mesa que não abre sem
explicação é a diferença entre uma regra e um defeito — e quem comprou fichas é justamente
quem vai perguntar.

### Conferências

- `verify-niveis`: 80 combinações de saldo × nível, e as duas pontas (nível 1 com 5
  quatrilhões → Bronze; nível 10.000 com saldo zero → Bronze)
- `verify:escada-de-aposta`: 325 combinações comparando o degrau do **aplicativo** com o do
  **servidor**, mais "toda aposta que o seletor deixa montar, o servidor aceita" agora
  varrido em 12 níveis
- `verify-tournaments`: prova pelos dois lados — mesma aposta relativa vale o mesmo em
  degraus diferentes, e apostar acima da ficha maior não rende XP a mais

Uma mutação (o aplicativo ignorando o freio de nível) foi testada e pega.

## Etapa 3 — recompensa diária (feita)

| Peça | Onde | Estado |
|---|---|---|
| Âncora no Bronze × `bonusDeNivel(L)`, teto 3× | `recompensas/calendario.ts` | feito |
| Mês de verdade (28/29/30/31), marco no último dia | `diasDoMes` | feito |
| Coleta numa transação só (histórico + carteira + sequência) | `recompensas.service.ts` | feito |
| `claimId` idempotente, e o retry devolve o mesmo prêmio | `daily_reward_claims` | feito |
| Régua de dia única, em UTC — `CURRENT_DATE` fora | `comum/dia-do-servidor.ts` | feito |
| Histórico com nível, multiplicador e bônus de cada coleta | `/recompensas/diaria/historico` | feito |
| `daily_reward_config` versionada | schema | tabela criada, vazia (valem os valores do código) |
| Tela do calendário + modal no salão com COLETAR | `RecompensaDiariaScreen`, `ModalDeRecompensa` | feito |
| Os testes do item 29 | `verify:recompensas` | feito |
| Notificação push | — | **não**, só a arquitetura compatível (item 27 pedia isso) |

**A catraca morreu, medida:** um ano só coletando cai de **102,3 quatrilhões** para **1,1
milhão** de fichas (nível 1) ou 3,4 milhões (nível 10.000). O degrau alcançado sem jogar
uma única rodada deixa de ser o Eclipse e passa a ser o Bronze, para sempre.

O múltiplo do mês **continua 1.874** apostas mínimas, como na proposta — o que mudou é de
que mesa ele é múltiplo: sempre do Bronze, nunca do degrau de quem coleta.

Sete mutações testadas, sete pegas. A mais importante: desligando por completo a checagem
em código (`podeColetar` sempre verdadeiro), os testes de pagamento duplo continuam
passando — quem protege é o índice único do banco, não o `if`.

## Etapa 4 — loja (feita)

| Peça | Onde | Estado |
|---|---|---|
| `pacote = k(preço) × mínimo(economicTier) × bônusDeNível` | `store/pacotes.ts` | feito |
| k = 100 / 300 / 800 / 2.400 | `PRECOS` | feito |
| BRL, USD e EUR — uma tabela por moeda, sem conversão de câmbio | `PRECOS.precos` | feito |
| Promoções com prazo, pacotes e degraus elegíveis, limite por pessoa | `store_promotions` | feito |
| `PaymentProvider` (porta), webhook, idempotência, validação no servidor | `porta-de-pagamento.ts` | feito |
| A compra guarda degrau, nível, preço, moeda, promoção e porta | `purchases` | feito |
| Tela da loja lendo o servidor (era uma lista escrita no aplicativo) | `StoreScreen` | feito |
| NFT / cripto | — | **não**, por decisão registrada |

**O número que obrigava a mudança, e como ficou.** O maior pacote pago (R$ 149,90):

| Degrau | Antes (120.000 fichas fixas) | Agora |
|---|---|---|
| Bronze | 2.400 apostas mínimas | 2.400 |
| Ouro | 24 | 2.400 |
| Diamante | 2 | 2.400 |
| Rubi | **0 — nem uma** | 2.400 |

No Bronze **nada mudou** para quem já jogava: foi assim que o `k` foi calibrado.

**A catraca da loja está fechada pelo `economicTier`:** comprar aumenta o saldo, saldo
maior subiria o degrau, degrau maior aumentaria o pacote seguinte. Com o freio do nível, o
degrau só sobe jogando, e a espiral não fecha. Sem ele, medido: R$ 149,90/mês subiriam um
degrau por mês e R$ 1.800 chegariam ao Eclipse em um ano.

**As promoções não fabricam urgência.** `terminaEm` é a data real de fim, publicada para a
tela dizer "termina domingo" — nunca um relógio regressivo que reinicia a cada abertura. E
nenhuma promoção é disparada por derrota ou por saldo caindo: a elegibilidade olha degrau e
pacote, e mais nada. O limite por pessoa é **teto** contra inflação, não gatilho de pressa.

**Pix e cartão:** a porta existe e está documentada, a implementação não — pagamento fora
da loja de aplicativo depende de um adquirente e de uma decisão sobre as regras da Apple
para bens digitais. Apple Pay e Google Pay funcionam pela RevenueCat, que é como compra de
ficha acontece dentro das lojas.

Cinco mutações testadas, cinco pegas.

## Etapa 5 — segurança do aplicativo (feita)

Fora do escopo econômico, mas era o último item aberto: ver
`docs/auditoria-de-seguranca-do-aplicativo.md`. Sete achados corrigidos — dois de gravidade
alta (CORS e WebSocket abertos a qualquer origem; nenhum limite de tentativas em lugar
nenhum) — e três registrados em aberto com o caminho de cada um.

