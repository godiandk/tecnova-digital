# Prompt — placar de histórico, Bac Bo em ação e Stock Market

Cole na **mesma conversa do ChatGPT** dos lotes anteriores (ele já tem o guia de estilo e o emblema Casino Inova). São **16 imagens**, uma de cada vez, na ordem.

> **Nota importante sobre o placar:** os pontinhos coloridos do placar (vermelho/azul/verde) **não** vêm como imagem — eles são desenhados pelo app em tempo real, porque mudam a cada rodada. O que preciso de você é a **moldura/painel** onde eles vão ser desenhados por cima. Por isso as imagens do placar são molduras vazias com a grade impressa, e não placares preenchidos.

---

## Texto para colar

Mais um lote pro Casino Inova, mesmo guia de estilo de sempre (3D fotorrealista, verde-esmeralda, dourado quente, madeira escura, iluminação dramática de cassino, nada de flat design).

Regra que vale pro lote inteiro: quando eu pedir **fundo transparente**, precisa ser transparente de verdade (PNG com canal alpha), sem fundo branco nem xadrez desenhado.

---

# PARTE A — Placar de histórico ("roadmap")

Em cassino de verdade, toda mesa de bacará, roleta e dados tem um **painel de histórico** ao lado, mostrando o resultado das últimas rodadas em bolinhas coloridas numa grade. É o que o jogador olha pra "ler a mesa" antes de apostar. Preciso das molduras desses painéis.

### 1. `placar-painel-grande.png` — paisagem, 2048x1024, fundo transparente

Uma moldura de painel eletrônico de cassino, vista de frente, **totalmente vazia por dentro**:
- Moldura externa de **metal dourado escovado** com uns 40 pixels de espessura, cantos levemente arredondados, com um leve chanfro e brilho nas bordas superiores (luz vindo de cima).
- Dentro da moldura, um **fundo de vidro preto fosco levemente reflexivo**, como tela de painel LED apagada — pode ter um reflexo suave e diagonal do ambiente no vidro, mas bem discreto, sem distrair.
- Sobre esse fundo escuro, uma **grade fina desenhada em linhas cinza-escuras**, quase apagadas (como se fosse a grade impressa do painel): **6 linhas por 24 colunas**, células perfeitamente quadradas, distribuídas de forma uniforme ocupando toda a área interna com uma margem interna pequena e igual dos quatro lados.
- **Nenhuma bolinha, nenhum número, nenhuma letra dentro da grade** — ela precisa estar completamente vazia, é o app que desenha os resultados em cima.
- No canto superior esquerdo da moldura dourada, gravado no metal em baixo-relevo, o emblema Casino Inova bem pequeno.

### 2. `placar-painel-pequeno.png` — paisagem, 1024x512, fundo transparente

Mesma moldura e mesmo material do item 1, mas menor e com a grade em **6 linhas por 12 colunas**. Serve pros placares derivados, que ficam lado a lado embaixo do principal. Também completamente vazia, sem emblema desta vez.

### 3. `placar-marcadores.png` — quadrado, 2048x2048, grade 4x4, fundo transparente

Dezesseis marcadores que o app vai desenhar dentro da grade do placar. Todos precisam ser **redondos (ou do formato indicado), perfeitamente centrados na sua célula, do mesmo tamanho, e legíveis com 24 pixels na tela**. Estilo: aparência de contas de vidro polido em 3D, com um brilho especular no canto superior esquerdo de cada uma e uma sombra suave embaixo. Nesta ordem exata (linha por linha, esquerda pra direita):

1. **Círculo vermelho preenchido** (vitória da Banca)
2. **Círculo azul preenchido** (vitória do Jogador)
3. **Círculo verde preenchido** (Empate)
4. **Círculo vermelho vazado** (só o anel vermelho grosso, centro transparente)
5. **Círculo azul vazado** (só o anel azul grosso, centro transparente)
6. **Barra diagonal verde** riscando de baixo-esquerda pra cima-direita, com a espessura de um traço de caneta grossa (é o traço que marca empate por cima de um resultado anterior)
7. **Barra diagonal vermelha**, mesma forma do item 6
8. **Barra diagonal azul**, mesma forma do item 6
9. **Círculo vermelho preenchido com um pontinho branco menor no canto superior esquerdo** (Banca com par)
10. **Círculo azul preenchido com um pontinho branco menor no canto inferior direito** (Jogador com par)
11. **Círculo dourado preenchido** (destaque da rodada atual)
12. **Anel dourado fino pulsante** (contorno de "posição atual", centro transparente)
13. **Quadrado vermelho de cantos arredondados** preenchido
14. **Quadrado azul de cantos arredondados** preenchido
15. **Triângulo vermelho** apontando pra cima, cantos levemente arredondados
16. **Triângulo azul** apontando pra baixo, cantos levemente arredondados

Todos os dezesseis na mesma escala, mesmo ângulo frontal, mesma iluminação, cada um centralizado na sua célula da grade 4x4 com espaçamento igual — vou recortar célula por célula, então **o espaçamento precisa ser uniforme**.

### 4. `placar-legenda.png` — paisagem, 1024x256, fundo transparente

Uma pequena barra horizontal de legenda, mesmo material dourado/vidro dos painéis, contendo quatro contadores lado a lado separados por um friso dourado fino vertical. Cada contador é só um **rótulo com um espaço vazio ao lado** pro app escrever o número por cima. Os quatro rótulos, escritos em letras douradas maiúsculas pequenas: **BANCA**, **JOGADOR**, **EMPATE**, **TOTAL**. Deixe um espaço retangular escuro e vazio à direita de cada rótulo, do tamanho de uns 3 dígitos.

---

# PARTE B — Bac Bo em ação (animação dos dados)

No Bac Bo de verdade, os dados **não são jogados numa mesa**: eles ficam dentro de **quatro agitadores de vidro transparentes**, em fila, que tremem e depois param revelando a face de cima. São **quatro agitadores com um dado cada** — dois do lado Player e dois do lado Banker. A revelação é alternada, na ordem: Player, Banker, Player, Banker.

Pra eu conseguir animar isso no app, preciso das peças **separadas em camadas**, não de uma cena pronta.

### 5. `bacbo-agitador-vazio.png` — retrato, 1024x1536, fundo transparente

**Um único** agitador de dados, isolado, visto de frente, levemente de cima (uns 15 graus):
- Formato de **cúpula/campânula de vidro grosso transparente**, com base cilíndrica de metal dourado escovado e um anel dourado na junção do vidro com a base.
- O vidro precisa ser **realmente transparente e vazio por dentro** (dá pra ver através dele), com reflexos especulares nas laterais e um brilho vertical suave — mas **sem nenhum dado dentro**, porque o app vai desenhar o dado por baixo desta imagem.
- A base de metal com um leve acabamento gravado.
- Sombra suave projetada embaixo da base.
- É essencial que o interior do vidro seja transparente de verdade no PNG, não pintado de cinza ou branco.

### 6. `bacbo-agitador-brilho-player.png` — retrato, 1024x1536, fundo transparente

Exatamente o mesmo agitador do item 5, no mesmo ângulo, mesma escala e mesma posição exata no quadro (precisa alinhar pixel a pixel com o item 5), mas agora com um **halo/brilho dourado intenso** ao redor do vidro e da base, como se o agitador estivesse iluminado por dentro — é o estado "este é o dado do Player" e "acabou de ser revelado".

### 7. `bacbo-agitador-brilho-banker.png` — retrato, 1024x1536, fundo transparente

Idêntico ao item 6, mesmo alinhamento, mas com o halo em **vermelho-rubi** em vez de dourado (estado "dado do Banker").

### 8. `bacbo-dado-face-1.png` até **12.** `bacbo-dado-face-6.png` — seis arquivos separados, cada um quadrado 512x512, fundo transparente

**Seis arquivos individuais** (não uma grade — preciso deles separados pra trocar rapidinho e simular o dado girando). Cada arquivo mostra **o mesmo dado**, no **mesmo ângulo frontal**, na **mesma posição e escala exatas** dentro do quadro, mudando **só a face virada pra frente**:
- `bacbo-dado-face-1.png` mostra a face **1**
- `bacbo-dado-face-2.png` mostra a face **2**
- e assim por diante até a face **6**

O dado: **resina verde-esmeralda translúcida** com os pontos (pips) em **dourado metálico incrustado**, cantos vivos (dado de cassino de verdade tem canto reto, não arredondado), faces polidas com reflexo. Na face **1**, o ponto único é substituído pelo **emblema Casino Inova** gravado em dourado.

Ponto crítico: como vou trocar essas seis imagens em sequência rápida pra dar a sensação de rolagem, o dado precisa estar **exatamente na mesma posição, tamanho e ângulo nas seis** — se ele "pular" de lugar entre uma imagem e outra, a animação fica quebrada. Gere as seis com o mesmo enquadramento rigorosamente.

### 13. `bacbo-dado-borrado.png` — quadrado, 512x512, fundo transparente

O mesmo dado dos itens 8 a 12, na mesma posição e escala, mas **com desfoque de movimento (motion blur) rotacional forte**, como se estivesse girando rápido demais pra distinguir a face. As faces devem ficar irreconhecíveis, virando um borrão verde-esmeralda com riscos dourados girando. É o quadro que o app mostra durante o chacoalhar, antes de parar numa face.

---

# PARTE C — Stock Market

É um jogo em que você aposta se uma "ação" vai **subir** ou **descer**. Um gráfico desenha a variação ao vivo e fecha num valor entre -100% e +100%; você ganha a porcentagem exata do movimento que acertou. O visual é de **mesa de operações de bolsa de valores**, não de mesa de feltro — é a exceção do pacote: aqui manda o clima de sala de trading de luxo, com telas, mas mantendo o dourado e o verde-esmeralda da marca.

### 14. `mesa-stock-market.png` — retrato, 1284x2778

Um **cenário de estúdio de trading de luxo**, visto de frente, como se o jogador estivesse sentado na mesa do operador:
- Ao fundo, uma **parede curva de telas** de cotação em vidro escuro, mostrando gráficos e colunas de números **desfocados e ilegíveis** (fora de foco de propósito — não escreva número nenhum legível), com linhas verdes e vermelhas subindo e descendo.
- No centro, uma **bancada de madeira escura envernizada** com tampo de vidro fumê, e sobre ela um **painel dourado embutido** — vazio, sem nada escrito, porque é onde o app desenha o gráfico e os botões.
- A **metade inferior da imagem precisa ser bem mais escura e limpa**, praticamente sem detalhe, porque é onde a interface de aposta vai ficar por cima.
- Iluminação: luz azulada fria vindo das telas ao fundo, contrastando com uma luz dourada quente vindo de cima sobre a bancada.
- O emblema Casino Inova gravado em dourado no centro da frente da bancada de madeira.
- Nenhum texto legível em lugar nenhum da imagem.

### 15. `stock-botoes-alta-baixa.png` — quadrado, 2048x2048, grade 2x2, fundo transparente

Quatro botões grandes de aposta, um por célula, no mesmo estilo 3D com acabamento de vidro e metal:
1. **Botão "ALTA" em repouso**: pastilha retangular de cantos arredondados, vidro **verde-esmeralda** translúcido sobre metal dourado, com uma **seta grossa apontando pra cima** gravada em dourado no centro, e a palavra **ALTA** em letras douradas maiúsculas embaixo da seta.
2. **Botão "ALTA" aceso/selecionado**: o mesmo botão, mesma posição e tamanho, mas com brilho interno forte, halo dourado ao redor e a seta iluminada como neon.
3. **Botão "BAIXA" em repouso**: igual ao item 1 mas em vidro **vermelho-rubi**, com a **seta apontando pra baixo** e a palavra **BAIXA**.
4. **Botão "BAIXA" aceso/selecionado**: versão iluminada do item 3.

Os quatro exatamente na mesma escala e no mesmo ângulo frontal, cada um centralizado na sua célula com espaçamento uniforme (vou recortar um por um).

### 16. `stock-painel-grafico.png` — paisagem, 2048x1152, fundo transparente

A **moldura vazia do gráfico** onde o app vai desenhar a linha da cotação ao vivo:
- Moldura de metal dourado escovado, fina e elegante, cantos arredondados.
- Interior de **vidro preto fosco**, com uma **grade de linhas finíssimas cinza-escuras** ao fundo (tipo papel milimetrado de gráfico financeiro): umas 20 colunas verticais e 10 linhas horizontais, bem apagadas.
- Uma **linha horizontal dourada mais visível exatamente no meio da altura**, atravessando de ponta a ponta — é a marca do "zero por cento", o ponto de partida da cotação.
- Do lado esquerdo, por fora da área da grade mas dentro da moldura, uma faixa vertical estreita e escura reservada pra escala (vazia, sem números — o app escreve).
- **Nenhuma linha de cotação desenhada, nenhum número, nenhuma palavra** — a moldura precisa estar vazia.

### 17. `stock-ticker-marcadores.png` — quadrado, 1024x1024, grade 2x2, fundo transparente

Quatro marcadores pequenos pro histórico de rodadas do Stock Market, mesmo estilo de conta de vidro polido dos marcadores do placar (item 3), legíveis com 24 pixels:
1. **Seta verde apontando pra cima**, dentro de um círculo de vidro verde-esmeralda (rodada fechou em alta)
2. **Seta vermelha apontando pra baixo**, dentro de um círculo de vidro vermelho-rubi (rodada fechou em baixa)
3. **Traço horizontal cinza** dentro de um círculo de vidro cinza (rodada fechou praticamente em zero)
4. **Círculo dourado com um raio/relâmpago** gravado dentro (rodada de movimento extremo, acima de 75%)

---

### Instrução final

Organize e me devolva um zip chamado `casino-inova-lote3.zip`:

```
casino-inova-lote3/
  placar/   (itens 1, 2, 3, 4)
  bacbo/    (itens 5, 6, 7, 8, 9, 10, 11, 12, 13)
  stock/    (itens 14, 15, 16, 17)
```
