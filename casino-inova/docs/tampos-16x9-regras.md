# CASINO INOVA — PACOTE 16:9 PARA TABLET E COMPUTADOR

Este pacote contém os **10 tampos individuais** do Casino Inova em formato 16:9, separados por dispositivo:

- `01-COMPUTADOR-1920x1080/`
- `02-TABLET-1600x900/`

Cada pasta contém:
1. Caça-Níqueis
2. Roleta Europeia
3. Blackjack
4. Bacará
5. Bac Bo
6. Stock Market
7. Banca Francesa
8. Truco
9. Dominó
10. Poker — Texas Hold'em

## REGRA PRINCIPAL PARA O CLAUDE

Estas imagens são a **CAMADA VISUAL BASE / TAMPO (L1)**.

Não transformar a imagem inteira em interface clicável e não gravar no arquivo o que muda durante a partida.

O aplicativo deve construir por cima, em camadas separadas:
- dealer/host;
- cartas;
- fichas;
- dados;
- dominós;
- símbolos dos rolos;
- saldo;
- valor da aposta;
- prêmio;
- cronômetro;
- botões;
- histórico;
- placar;
- resultados;
- tooltips e acessibilidade.

Use `object-fit: contain`. Nunca cortar a mesa para preencher a tela. Em caso de letterbox, completar com ambiente escuro/vinheta.

## ESTILO VISUAL

- feltro esmeralda profundo, com textura e pelo visível;
- borda de couro preto elevada, com grão, costura e sombra no feltro;
- madeira escura envernizada com veio aparente;
- filetes e letras de regra em dourado champanhe gravado;
- iluminação quente de cima e da frente;
- salão de cassino desfocado no entorno, sem a mesa “flutuar” num fundo preto.

## 01 — CAÇA-NÍQUEIS

Arquivo: `01-caca-niqueis.webp`

Gabinete art déco com **cinco rolos vazios**. Os símbolos entram dinamicamente no aplicativo.
Não fixar saldo, aposta, prêmio, paylines ou botão GIRAR na arte-base.

## 02 — ROLETA EUROPEIA

Arquivo: `02-roleta-europeia.webp`

Roda europeia de **zero único** + pano 0–36, três colunas, três dúzias e apostas externas.
Fichas, bola, marcador vencedor e histórico são dinâmicos.

## 03 — BLACKJACK

Arquivo: `03-blackjack.webp`

Mesa semicircular com **sete casas de aposta**, descarte à esquerda e shoe à direita.
Regra impressa no feltro: Blackjack paga 3 por 2 e dealer para em 17.
Cartas, fichas e totais ficam em camadas separadas.

## 04 — BACARÁ

Arquivo: `04-bacara.webp`

Mesa longa/oval com áreas **JOGADOR / EMPATE / BANCA**, pares e quatro slots de carta.
Cartas e roadmap/histórico são dinâmicos.

## 05 — BAC BO

Arquivo: `05-bac-bo.webp`

Quatro agitadores de vidro individuais no alto.
Dois pertencem ao JOGADOR e dois à BANCA.
Na implementação funcional: **1 dado por shaker**, dois dados azuis somados para o JOGADOR e dois vermelhos somados para a BANCA.
A tabela de empate deve usar:
- 2/12 = 88:1
- 3/11 = 25:1
- 4/10 = 10:1
- 5/9 = 6:1
- 6/7/8 = 4:1

## 06 — STOCK MARKET

Arquivo: `06-stock-market.webp`

Gráfico vazio no centro e somente duas opções: **ALTA** e **BAIXA**.
Não existe EMPATE.
Escala funcional: de 0 até +100% para alta e de 0 até -100% para baixa.
Cotação, linha, resultado, carteira e P/L são dinâmicos.

## 07 — BANCA FRANCESA

Arquivo: `07-banca-francesa.webp`

Usar a geometria tradicional:
- ASES = 3
- GRANDE = 14 / 15 / 16
- PEQUENO = 5 / 6 / 7
- exatamente **3 dados**, cada um com faces de 1 a 6.

Manter os arcos simples e contínuos.
Há um único spot circular sobre a linha do GRANDE e um único spot circular sobre a linha do PEQUENO.
Não transformar em Bacará ou Sic Bo.

## 08 — TRUCO

Arquivo: `08-truco.webp`

Mesa quadrada com quatro lugares:
- NORTE
- LESTE
- SUL
- OESTE

Centro livre para a vaza.
Cartas, vira, placar e chamadas são dinâmicos.
Chamadas: TRUCO → 6 → 9 → 12.
Chat/mensagens devem ficar em componente separado.

## 09 — DOMINÓ

Arquivo: `09-domino.webp`

Mesa octogonal com quatro posições e centro totalmente livre.
Usar conjunto **double-six de 28 peças**.
A corrente é dinâmica e deve casar sempre ponta com ponta pelo mesmo número.
Peças duplas entram perpendiculares à corrente.

## 10 — POKER — TEXAS HOLD'EM

Arquivo: `10-poker-texas-holdem.webp`

Mesa oval, posições de jogador no perímetro e **cinco slots comunitários** no centro.
Hole cards, flop/turn/river, fichas, pote, blinds e botão D são dinâmicos.

## IMPORTANTE — O QUE NÃO DEVE SER PINTADO NA ARTE

Não colocar como elemento fixo:
- saldo;
- aposta;
- prêmio;
- tempo;
- botões;
- trilho de fichas;
- fichas já apostadas;
- cartas já distribuídas;
- dados de resultado;
- dominós já jogados;
- resultado/histórico;
- nome de outro cassino.

O objetivo é permitir que o Claude use a imagem como palco e coloque a jogabilidade real por cima.

## EXPORTAÇÃO

Computador:
- 1920×1080
- 16:9
- WebP

Tablet:
- 1600×900
- 16:9
- WebP

As duas versões preservam a mesma composição horizontal; não há deformação de proporção.
