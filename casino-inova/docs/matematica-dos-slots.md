# A matemática do caça-níqueis

Registro do P0.1: o que estava errado, o que mudou, e como qualquer pessoa confere.

**Reproduzir:**

```bash
python3 tools/analisa-slot.py                                  # distribuição exata, sem simular
cd server && npx ts-node src/modules/games/slots/verify-rtp.ts # a trava, com 5 milhões de giros
```

---

## O modelo

Cinco rolos por três fileiras. Cada uma das 15 células é sorteada **independente**, com o
mesmo peso por símbolo — não há *strip* de rolo com peso próprio por coluna. Cinco linhas
de pagamento, e toda combinação começa obrigatoriamente no rolo 1 e anda pra direita até
quebrar. O prêmio de cada linha é `aposta × multiplicador`; a aposta **não** é dividida
entre as linhas, então o retorno de um giro é a soma das cinco.

Esse modelo é mais simples que o de um slot comercial, e isso é uma escolha: ele torna o
RTP calculável em **fórmula fechada**, e não só estimável por simulação.

---

## O que estava errado

| | Antes | Depois |
|---|---|---|
| RTP | **89,1673%** | **95,9715%** |
| Margem da casa | 10,8327% | 4,0285% |
| Frequência de vitória | 13,73% (1 em 7,3) | **21,72%** (1 em 4,6) |
| Desvio padrão do retorno | 5,32× | 9,97× |
| Volatilidade | média-baixa | média |
| Maior prêmio de uma linha | Jackpot 5.000× | Jackpot 8.500× |
| Frequência dele | 1 em 320 bilhões | **1 em 8,2 milhões** |
| Contribuição do Jackpot | 0,013 ponto | 4,66 pontos |
| Repartição do RTP | 80% nos 4 comuns | 70% comuns / 20% médios / 10% altos |

O problema não era só o número baixo. Era a **forma**:

1. **Poucas vitórias.** Um giro em 7,3. Slot de vídeo de verdade fica entre 20% e 30%.
2. **Prêmio de cima inalcançável.** O maior prêmio possível (as cinco linhas com Jackpot)
   saía uma vez a cada 3,3 × 10³⁴ giros. Não é prêmio, é enfeite.
3. **Escada de prêmios só no papel.** Barras contribuía 25,3 pontos de RTP e o Jackpot
   0,013. Os quatro símbolos de cima somados davam 5,2 pontos de 89.

A combinação das três é a pior possível: come o saldo devagar e sem emoção.

---

## O que mudou, e por quê

**Pesos mais concentrados nos comuns.** A frequência de vitória depende da soma dos `p³`
dos símbolos, e essa soma sobe quando a distribuição é *menos* uniforme — não quando ela é
mais generosa. Ferradura foi de 22 para 33 e Sino de 20 para 22. A soma dos `p³` foi de
0,0294 para 0,0502, e a frequência de vitória de 13,73% para 21,72%.

**Prêmios de cima alcançáveis.** O Jackpot foi de peso 0,5 (p = 0,5%) para 3 (p = 3%).
Cinco Jackpots numa linha passaram de uma vez a cada 320 bilhões de giros para uma a cada
8,2 milhões. Continua raro — é um jackpot — mas agora existe.

**Escada real.** Cada símbolo passou a contribuir entre 4,7 e 27 pontos de RTP.

### A tabela

| Símbolo | Peso | p | 3 iguais | 4 iguais | 5 iguais | Contribuição |
|---|---|---|---|---|---|---|
| Ferradura | 33 | 33,00% | 0,35× | 1,8× | 8× | 27,02 pontos |
| Sino | 22 | 22,00% | 1,5× | 7× | 35× | 21,64 |
| Barras | 13 | 13,00% | 5× | 25× | 140× | 10,48 |
| Estrela | 9 | 9,00% | 15× | 70× | 350× | 8,10 |
| Moeda | 7 | 7,00% | 30× | 150× | 700× | 7,05 |
| Coroa | 5,5 | 5,50% | 60× | 300× | 1.400× | 6,37 |
| Diamante | 4 | 4,00% | 150× | 700× | 3.500× | 5,65 |
| Sete | 3,5 | 3,50% | 200× | 1.000× | 5.500× | 5,01 |
| Jackpot | 3 | 3,00% | 300× | 1.600× | 8.500× | 4,66 |

---

## Por que 96%

Foi decisão de produto, não de programação.

- É o **RTP modal do slot de vídeo regulado**. Um jogador que já jogou slot reconhece.
- Deixa o slot como a **mesa mais apertada da casa** — Banca Francesa 98,41%, Roleta
  97,30%, Blackjack ~99,5% — que é exatamente o que um slot é em qualquer cassino.
- Não há dinheiro real aqui, então a margem não financia nada: ela só decide a velocidade
  com que o saldo derrete. 89% derretia rápido demais para um jogo que não vende nada.

---

## A coisa desconfortável, dita em voz alta

**9,59% dos giros devolvem alguma coisa abaixo da aposta** — a média dessa faixa é 0,39×.
Devolver 40 numa aposta de 100 é como todo slot funciona, e não dá pra evitar sem derrubar
a frequência de vitória.

Mas **isso não é ganhar**, e a tela não pode comemorar como se fosse. Luz, som e a palavra
"ganhou" em cima de um giro que devolveu menos que a aposta é derrota disfarçada de
vitória — a coisa que este projeto decidiu não fazer. A matemática está resolvida; a
apresentação disso é tarefa da interface, e fica anotada como P1.

---

## A trava

`verify-rtp.ts` **reprova** (sai com 1), e confere seis coisas:

1. **Fórmula bate com simulação** — cinco milhões de giros pelo motor de verdade, com
   folga de três erros padrão calculados da própria variância observada. Uma folga fixa
   seria errada nos dois sentidos: frouxa quando a volatilidade é alta (era o caso: dois
   pontos de folga com erro padrão de 1,5 ponto não travava nada) e apertada demais se o
   jogo ficar mais calmo.
2. **RTP na faixa decidida** — 96% ± 0,5 ponto. Mudar isso é decisão de produto, e a
   conferência obriga quem mudar a mexer no alvo dela também.
3. **Frequência de vitória entre 18% e 30%.**
4. **A escada sobe** — mais raro paga mais, e 3 < 4 < 5 em todos.
5. **O maior prêmio sai pelo menos uma vez a cada 50 milhões de giros.**
6. **Nenhum símbolo contribui menos de 0,5 ponto de RTP** — símbolo que não move o retorno
   só serve pra criar expectativa que a matemática não sustenta.
