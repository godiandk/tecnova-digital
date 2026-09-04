# CASINO INOVA --- Referências visuais para celular

## Finalidade

Esta pasta reúne **uma imagem individual para cada um dos 10 jogos** do
Casino Inova, em versão de referência para celular. As imagens devem
orientar o Claude na composição visual e responsiva do aplicativo. Elas
**não são sprites finais nem regras codificadas**.

Regra de implementação: separar tampo, peças, dealer/host, histórico,
placar, controles e resultados em camadas. Não rasterizar valores
dinâmicos no tampo final.

## 01 --- CAÇA-NÍQUEIS

Arquivo: `01-CACA-NIQUEIS-CELULAR.png`

Referência de um gabinete vertical do Casino Inova. O centro é reservado
para **cinco rolos**. Símbolos, paylines, saldo, aposta, ganho, jackpot
e giro devem ser dinâmicos. O logo CI deve permanecer único. O
host/dealer não pode cobrir os rolos.

## 02 --- ROLETA EUROPEIA

Arquivo: `02-ROLETA-EUROPEIA-CELULAR.png`

Referência para roleta europeia de **zero único**. A implementação real
deve possuir 0--36, três colunas, três dúzias e as apostas externas
1--18, PAR, VERMELHO, PRETO, ÍMPAR e 19--36. Fichas, bola, vencedor e
histórico são camadas dinâmicas.

## 03 --- BLACKJACK

Arquivo: `03-BLACKJACK-CELULAR.png`

Mesa de Blackjack para celular. Preservar **sete spots**, regra 3:2,
dealer para em 17 e áreas de side bet PAR PERFEITO e 21+3. Cartas,
fichas, totais e ações entram dinamicamente.

## 04 --- BACARÁ

Arquivo: `04-BACARA-CELULAR.png`

Referência visual para Bacará. A versão funcional deve preservar
JOGADOR, EMPATE, BANCA, pares e áreas de cartas. O roadmap/histórico
deve ficar fora das apostas. Cartas e resultados não devem ser fixados
na imagem-base.

## 05 --- BAC BO

Arquivo: `05-BAC-BO-CELULAR.png`

O jogo usa **quatro shakers e quatro dados no total**: dois dados azuis
do JOGADOR e dois dados vermelhos da BANCA, sendo **um dado por
shaker**. O resultado de cada lado é a **soma dos seus dois dados**. O
histórico deve comparar a soma azul com a soma vermelha e indicar o lado
vencedor ou empate. Não interpretar cada dado como resultado
independente.

## 06 --- STOCK MARKET

Arquivo: `06-STOCK-MARKET-CELULAR.png`

Referência para o jogo Stock Market. Existem apenas dois sentidos:
**ALTA** e **BAIXA**. A escala parte de 0 e pode atingir até **+100%**
ou **−100%**. **Não existe EMPATE**. Gráfico, percentual, entrada,
cash-out, carteira, P/L e histórico são dados dinâmicos.

## 07 --- BANCA FRANCESA

Arquivo: `07-BANCA-FRANCESA-CELULAR.png`

Referência baseada na geometria tradicional da Banca Francesa: **três
dados comuns, cada um de 1 a 6**; ASES = 3; GRANDE = 14/15/16; PEQUENO =
5/6/7.

Preservar o padrão simples das curvas. Há **um círculo/spot sobre a
linha do GRANDE e um círculo/spot sobre a linha do PEQUENO**, sem
multiplicar círculos ou inventar novas zonas. Não transformar o jogo em
Bacará ou Sic Bo e não inserir cartas.

## 08 --- TRUCO

Arquivo: `08-TRUCO-CELULAR.png`

Quatro posições: NORTE, OESTE, SUL e LESTE. Cada jogador recebe três
cartas. O centro é reservado à vaza e existe a vira. As chamadas do jogo
devem ficar claramente separadas do chat: **TRUCO → SEIS → NOVE →
DOZE**, com respostas como QUERO/NÃO QUERO. Mensagens sociais ficam em
um painel separado.

A implementação deve usar o baralho e as regras configuradas para o
Truco do produto; a imagem é referência de interface, não autoridade
para resolver variações regionais.

## 09 --- DOMINÓ

Arquivo: `09-DOMINO-CELULAR.png`

Dominó **double-six, total de 28 peças**. Quatro orientações de jogador
e corrente no centro. Toda peça colocada deve conectar uma ponta ao
**mesmo número (0--6)** da ponta aberta.

Importante: 28 é o total do conjunto, não o tamanho permanente do monte.
O monte restante deve ser calculado dinamicamente:
`28 − peças nas mãos − peças já jogadas = peças restantes no monte`.

## 10 --- POKER --- TEXAS HOLD'EM

Arquivo: `10-POKER-TEXAS-HOLDEM-CELULAR.png`

Referência para Texas Hold'em. Cada jogador recebe duas hole cards; o
board possui **cinco cartas comunitárias** (flop, turn e river). Pote,
blinds, ante, fichas, botão D, stacks, ações e histórico são dinâmicos.
Ações principais: Fold, Check, Call e Raise.

## Regras gerais para o Claude

-   Usar as imagens como **referência visual**, não como uma tela única
    rasterizada.
-   Separar L1 tampo, L3 peças/estados, L4 HUD e L5
    título/acessibilidade.
-   Não copiar identidade de terceiros.
-   Não alterar a geometria original de cada jogo para encaixar HUD.
-   Dealer/host e histórico ficam fora das áreas de jogo.
-   Resultados, cartas, dados, dominós, fichas, percentuais, saldos e
    pontuações devem vir do estado/servidor.
-   Celular: título → host minimizado → mesa → histórico → ações.
-   Alvos de toque mínimos de 48 px CSS e contraste acessível.
-   Quando a imagem de referência contiver um valor ilustrativo, a
    **regra descrita neste README e a configuração do servidor têm
    prioridade**.

## Próxima etapa

Depois da aprovação das referências de celular, criar versões próprias
para tablet e computador, preservando as mesmas âncoras sem simplesmente
esticar ou rotacionar a composição.
