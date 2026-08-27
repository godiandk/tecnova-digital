# Imagens que faltam pro salão ficar do jeito certo

Lista fechada, em ordem de impacto. Nada aqui é enfeite opcional — cada item tapa um
buraco que dá pra ver na tela hoje.

O lugar onde cada peça entra já está construído e funcionando com o que existe: o
destaque já tem a faixa, a barra de abas já tem a placa dourada e o brilho. Falta a
arte. Quando os arquivos chegarem, cada um vira uma linha num mapa de imagens — o Metro
exige caminho escrito literal, então não dá pra deixar a linha pronta antes do arquivo
existir (o app nem monta se o caminho não existir). É um passo mecânico, não uma
remodelagem.

**Paleta de todos:** preto esverdeado (#0B0F0D), feltro esmeralda (#0F5132), dourado
(#E5B567 a #FFD98A). Luz quente vindo de cima, fundo escuro, sem branco puro.

---

## 1. Faixas do destaque — 10 imagens · PRIORIDADE MÁXIMA

**Pasta:** `app/assets/images/destaques/`
**Tamanho:** 1600 x 520 px (deitada, proporção ~3:1)
**Formato:** JPG

Uma por jogo:

```
destaque-slots.jpg          destaque-banca-francesa.jpg
destaque-roleta.jpg         destaque-truco.jpg
destaque-blackjack.jpg      destaque-domino.jpg
destaque-bacara.jpg         destaque-poker.jpg
destaque-bac-bo.jpg         destaque-stock-market.jpg
```

**Por que:** hoje o destaque usa a foto da mesa, que foi feita em formato de celular em
pé. Recortada numa faixa deitada, ela vira um campo de feltro vazio no meio — dá pra
ver isso na tela agora. É o defeito visual mais óbvio que sobrou.

**Como pedir:** a mesa do jogo vista de lado, em ângulo, com a luz do lustre batendo em
cima. **O terço da esquerda tem que ser escuro e sem detalhe** — é onde o nome do jogo e
o botão são escritos por cima. O assunto (roda da roleta, cartas, dados, peças) fica no
meio e na direita.

---

## 2. Ícones da barra de baixo — 10 arquivos

**Pasta:** `app/assets/images/interface/abas/`
**Tamanho:** 128 x 128 px
**Formato:** PNG **com fundo transparente**

Dois de cada — um aceso (dourado #FFD98A, com brilho) e um apagado (cinza esverdeado
#6E786F, chapado):

```
aba-salao.png       aba-salao-apagado.png       (losango / naipe de ouros)
aba-torneios.png    aba-torneios-apagado.png    (troféu)
aba-caixa.png       aba-caixa-apagado.png       (pilha de fichas)
aba-amigos.png      aba-amigos-apagado.png      (duas pessoas)
aba-perfil.png      aba-perfil-apagado.png      (busto com moldura)
```

**Por que:** é o que você reclamou. Hoje são ícones genéricos de biblioteca. Com arte
própria a barra passa a combinar com o resto — a placa dourada e o brilho já estão
prontos esperando.

**Como pedir:** silhueta cheia, desenho simples, sem texto dentro, tudo com o mesmo peso
de traço pra a fileira ficar alinhada.

---

## 3. Figura do destaque pra dois jogos — 2 imagens

**Pasta:** `app/assets/images/dealers/`
**Tamanho:** 1536 x 2048 px (em pé, igual às que já existem)
**Formato:** JPG

```
dealer-bac-bo.jpg          (crupiê ao lado do agitador de dados)
anfitriao-stock-market.jpg (operador de mesa, terno, painel de gráfico atrás)
```

**Por que:** oito jogos já têm crupiê e usam no destaque. Bac Bo e Stock Market caem no
cartaz, e a diferença aparece.

**Como pedir:** igual às que já existem — pessoa da cintura pra cima, olhando pra frente,
luz quente de lado, fundo escuro que se desmancha.

---

## 4. Peças de ornamento — 3 arquivos

**Pasta:** `app/assets/images/interface/ornamentos/`
**Formato:** PNG **com fundo transparente**

```
canto-deco.png     256 x 256   (canto art déco em filigrana dourada)
divisor-deco.png  1024 x  48   (faixa horizontal, motivo repetível, apaga nas pontas)
selo-destaque.png  256 x 256   (roseta/selo dourado com losango no meio)
```

**Por que:** as molduras douradas hoje são retângulos desenhados no código. Com essas
três peças as seções e o destaque ganham canto trabalhado de verdade.

---

## 5. Fundo do salão em formato de monitor — 1 imagem

**Pasta:** `app/assets/images/backgrounds/`
**Nome:** `lobby-fundo-largo.jpg`
**Tamanho:** 2560 x 1440 px

**Por que:** o `lobby-fundo.jpg` de hoje é 1284x2778 (celular em pé). Num monitor ele
funciona, mas ampliado — o lustre fica gigante e o pé-direito some. Uma versão deitada
mostraria o salão inteiro. **Este é o único item da lista que é melhoria, e não conserto:**
se não vier, o fundo de hoje continua servindo.

---

## O que NÃO precisa

Pra não gastar geração à toa:

- **Mesas em formato de monitor.** Já resolvido no código: em tela larga o jogo roda numa
  coluna central e a própria foto, ampliada e escurecida, faz o salão em volta.
- **Cartazes maiores.** Os de hoje são 800x1200 e escalam bem até seis colunas.
- **Fundo de loja e de torneios.** Os arquivos existem e ainda nem estão sendo usados.
