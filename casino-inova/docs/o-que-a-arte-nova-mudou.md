# O que a arte nova mudou — e as três decisões que ela abre

Anotação da vistoria do pacote CASINO-INOVA-JOGOS-PARA-CLAUDIO (54 imagens de arte
própria) e do pacote de 50 referências reais de cassino ao vivo e jogo on-line.

## O que entrou no projeto

- `app/assets/images/mesas-online/mesa-*.jpg` — as dez telas de mesa, convertidas de
  WebP pra JPEG. WebP depende de suporte do sistema numa build nativa de iOS; são fotos
  sem transparência, então JPEG passa em qualquer lugar sem risco.
- `app/assets/images/branding/` — logotipo e ícone oficiais.
- `docs/referencia-de-mesa/` — as demonstrações e detalhes, como referência de
  implementação. Não são arte embarcada: são elas que mostram ONDE vai carta, ficha e
  total em cada mesa.
- `docs/guia-das-mesas.md` — o guia de regras e proporções que veio no pacote.

## O que a arte confirma do que já estava certo

- **Banca Francesa.** O nosso motor já implementa o lançamento nulo com relançamento e
  apostas em pé (soma 4, 8–13, 17, 18 não resolve). A arte confirma ASES 3, GRANDE
  14/15/16 e PEQUENO 5/6/7.
- **Roleta.** Zero único e a ordem física real da roda, que já tem teste próprio.
- **Mesa com gente.** O truco on-line da arte mostra NORTE, LESTE, VOCÊ e OESTE, com a
  mão dos outros de costas e o placar FORA da mesa — que é exatamente o
  `MesaComLugares` recém-construído. O dominó mostra a corrente no meio e a mão em
  suporte embaixo, que é a `CorrenteDeDomino`.

## As três decisões que precisam de resposta

### 1. As mesas são DEITADAS

A arte de mesa é 1600x900 — 16:9, paisagem. O app é retrato de ponta a ponta.

É assim que cassino on-line de verdade faz: lobby em pé, mesa deitada. Mas mudar
significa mexer no layout das dez telas de jogo e tratar rotação.

**Alternativas:** (a) mesa deitada, como a arte pede; (b) manter tudo em pé e recortar a
arte, perdendo as laterais — onde ficam justamente o crupiê, o sapato e as áreas de
aposta.

### 2. O caça-níqueis tem CINCO rolos na arte, e três no motor

A arte mostra 5 rolos x 3 linhas, com símbolos de 7, esmeralda, coroa, sino, espada,
copas, ouros e paus. O nosso motor é 3x3 com nove símbolos e cinco linhas de pagamento.

Não é mudança de desenho: é mudança de motor. Precisa de novas fitas de rolo, novas
linhas de pagamento, RTP recalculado e o verificador refeito.

### 3. O Bac Bo tem dado azul e vermelho

A arte e a regra pedem quatro dados em quatro agitadores individuais: **dois azuis** pro
JOGADOR e **dois vermelhos** pra BANCA. A arte que está no projeto hoje é um dado verde
só, usado nos dois lados.

Isto é conserto de arte, não de motor — o sorteio já é de quatro dados em dois pares.

## Um detalhe menor, mas de regra

A arte da Banca Francesa não tem área de LINHA, e o nosso jogo tem essa aposta. A Linha
existe na Banca Francesa portuguesa de verdade (meia aposta em Grande, meia em Pequeno),
e está implementada com a fonte anotada no código. Se ela fica, precisa de um lugar
desenhado no pano; se sai, é decisão de produto.

## Sobre as referências de terceiros

O pacote de 50 referências traz telas de jogos comerciais. Elas servem pra entender
disposição, e é assim que foram usadas. Nada de marca, logotipo, apresentador ou
interface de terceiro entra no aplicativo — a regra está escrita no próprio LEIA-ME do
pacote e vale aqui também.
