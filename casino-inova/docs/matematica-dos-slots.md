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
| RTP | **89,1673%** | **95,9922%** |
| Margem da casa | 10,8327% | **4,0078%** |
| Frequência de vitória | 13,73% (1 em 7,3) | **19,4579%** (1 em 5,1) |
| Desvio padrão do retorno | 5,32× | 17,096× |
| Volatilidade | média-baixa | média-alta |
| Maior prêmio de uma linha | Jackpot 5.000× | Jackpot **16.000×** |
| Frequência dele | 1 em 320 bilhões | **1 em 38,2 milhões** |
| Contribuição do Jackpot | 0,013 ponto | **11,26 pontos** |
| Repartição do RTP | 80% nos 4 comuns | 51% comuns / 20% médios / 29% altos |
| Menor prêmio | 1× | **1× — nunca abaixo da aposta** |

*(A coluna "Antes" é a tabela original, de peso 22/20/18/14/12/7/4/2,5/0,5. Entre ela e a
de hoje houve uma calibração intermediária, com multiplicadores de 0,35× e 1,8×, que foi
**descartada** — ver "A tabela" abaixo. Onde este documento falava em 95,9715%, 21,72% de
vitória ou prêmio de 8.500×, eram números daquela tentativa, não desta.)*

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
mais generosa. A soma dos `p³` foi de 0,0294 para 0,0439, e a frequência de vitória de
13,73% para 19,46%.

**Prêmios de cima alcançáveis.** O Jackpot foi de peso 0,5 (p = 0,5%) para 6 num total de
197 (p = 3,05%). Cinco Jackpots numa linha passaram de uma vez a cada 320 bilhões de giros
para uma a cada 38,2 milhões. Continua raro — é um jackpot — mas agora existe.

**Escada real.** Cada símbolo passou a contribuir entre 4,9 e 19,7 pontos de RTP. Antes,
Barras sozinho carregava 25,3 pontos e o Jackpot 0,013.

### A tabela

**Todos os 27 multiplicadores são inteiros**, e isso não é estética. A primeira calibração
usou 0,35× e 1,8× para segurar o símbolo mais comum: a matemática fechava e a mesa
quebrava, porque numa aposta de 50 um prêmio de 0,35× vale 17,5 fichas e a carteira recusa
fração de ficha — é a regra que impede margem escondida em arredondamento. A conferência
de ponta a ponta pegou isso com um 400 na cara do jogador. Esta tabela não pode repetir o
problema, e há uma trava que reprova se alguém tentar.

| Símbolo | Peso | p | 3 iguais | 4 iguais | 5 iguais | Contribuição |
|---|---|---|---|---|---|---|
| Ferradura | 60 | 30,46% | 1× | 2× | 3× | 19,74 pontos |
| Sino | 44 | 22,34% | 2× | 5× | 15× | 17,65 |
| Barras | 28 | 14,21% | 4× | 20× | 100× | 11,33 |
| Jackpot | 6 | 3,05% | 700× | 3.500× | 16.000× | 11,26 |
| Sete | 7 | 3,55% | 400× | 2.000× | 10.000× | 10,48 |
| Estrela | 20 | 10,15% | 10× | 50× | 250× | 8,44 |
| Moeda | 14 | 7,11% | 25× | 125× | 600× | 6,19 |
| Diamante | 8 | 4,06% | 150× | 750× | 3.500× | 5,99 |
| Coroa | 10 | 5,08% | 60× | 300× | 1.500× | 4,92 |

*(Ordenada por contribuição, não por raridade — é assim que se vê que a escada é real: os
três de cima somam 27,7 pontos, e nenhum símbolo está lá só de enfeite. Soma dos pesos:
197.)*

---

## Por que 96%

Foi decisão de produto, não de programação.

- É o **RTP modal do slot de vídeo regulado**. Um jogador que já jogou slot reconhece.
- Deixa o slot como a **mesa mais apertada da casa** — Banca Francesa 98,41%, Roleta
  97,30%, Blackjack ~99,5% — que é exatamente o que um slot é em qualquer cassino.
- Não há dinheiro real aqui, então a margem não financia nada: ela só decide a velocidade
  com que o saldo derrete. 89% derretia rápido demais para um jogo que não vende nada.

---

## A coisa desconfortável — que deixou de existir

Esta seção dizia, sobre a calibração intermediária: *"9,59% dos giros devolvem alguma coisa
abaixo da aposta"*. Devolver 40 numa aposta de 100 e comemorar como vitória é derrota
disfarçada de vitória — a coisa que este projeto decidiu não fazer —, e a nota dizia que a
matemática estava resolvida e a apresentação ficaria pra depois.

**Não ficou pra depois: sumiu.** Ao trocar os multiplicadores fracionários por inteiros
(pelo motivo prático da fração de ficha), o menor multiplicador da tabela voltou a ser 1.
Como todo prêmio é `aposta × multiplicador`, **nenhum retorno fica abaixo da aposta**: se
acendeu, no mínimo empatou.

A distribuição exata confirma: 7,34% dos giros devolvem exatamente 1× — o empate — e nada
cai entre 0 e 1. Isso caiu no colo junto com os inteiros, e é melhor do que parece: todo
slot comercial paga fração da aposta o tempo todo e comemora como vitória. Aqui não há o
que disfarçar, porque não há perda disfarçada de ganho.

Há uma trava para isso não voltar (item 7 abaixo).

---

## A trava

`verify-rtp.ts` **reprova** (sai com 1), e confere oito coisas:

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
7. **Todo multiplicador é inteiro** — nenhum prêmio pode dar fração de ficha. É a trava do
   defeito que a primeira calibração produziu.
8. **O menor prêmio devolve pelo menos 1×** — se acendeu, no mínimo empatou. É esta que
   impede a volta da "derrota disfarçada de vitória".
