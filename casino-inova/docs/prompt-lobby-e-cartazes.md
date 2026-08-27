# Prompt — cartazes dos jogos e interface do lobby

Cole na **mesma conversa do ChatGPT** dos lotes anteriores (ele já tem o guia de estilo e o emblema Casino Inova). São **25 imagens**, uma de cada vez, na ordem.

> **Antes de começar, o que é cada coisa:**
>
> **Cartaz de jogo** é o retângulo em pé que a pessoa vê no lobby e clica pra entrar. É a "capa" do jogo — precisa dar vontade de clicar e dizer na hora que jogo é aquele.
>
> **Cartaz de variante** aparece na tela seguinte, quando o jogo tem mais de um jeito de jogar. Truco, por exemplo, abre uma tela pra escolher entre Paulista e Mineiro, e depois entre 1x1 e 2x2. Já Stock Market não tem variante — clicou, abriu o jogo.
>
> **Moldura de interface** é um enfeite vazio onde o app escreve o número por cima (fichas, nível). Elas mudam a toda hora, então o texto nunca vem na imagem.

---

## Texto para colar

Mais um lote pro Casino Inova, seguindo o mesmo guia de estilo de sempre (3D fotorrealista de jogo mobile AAA, preto-carvão, verde-esmeralda de feltro, dourado quente, iluminação dramática com bloom — nunca cartoon, nunca flat design).

**Três regras pro lote inteiro:**

**A) Nos cartazes, o nome do jogo VEM escrito na imagem** — é a única parte deste projeto em que quero texto embutido. Escreva exatamente o nome que eu indicar, em letras douradas maiúsculas, tipografia serifada elegante de cassino, com leve relevo metálico e um brilho fino de contorno, posicionado no **terço inferior** do cartaz. Nenhuma outra palavra além do nome.

**B) Composição dos cartazes:** retrato **2:3, 800x1200**. O assunto principal ocupa os dois terços de cima, e o terço de baixo é mais escuro (um degradê que desce pro preto) pra o nome ficar legível por cima. Enquadramento fechado e dramático, como pôster de filme — não uma foto de mesa vista de longe.

**C) Quando eu pedir fundo transparente**, precisa ser transparente de verdade (PNG com alfa), sem fundo branco nem xadrez desenhado.

---

# PARTE 1 — Cartazes dos 10 jogos (pasta `cartazes/`)

Todos: retrato 2:3, **800x1200**, com o nome escrito no terço inferior conforme a regra A.

### 1. `cartaz-slots.png` — nome: **CAÇA-NÍQUEIS**
Close dramático na frente de um gabinete de caça-níquel dourado, com três rolos iluminados por dentro mostrando símbolos brilhando (um sete vermelho, uma coroa, um diamante verde), luzes correndo pela moldura, moedas de ouro saltando congeladas no ar na frente da tela. Luz quente forte vindo de dentro do gabinete.

### 2. `cartaz-roleta.png` — nome: **ROLETA**
A roda de roleta vista de um ângulo baixo e inclinado, girando (com leve borrão de movimento nas casas), a bola de marfim congelada no ar prestes a cair, aro dourado refletindo luz, o zero verde em destaque nítido no meio do borrão. Fundo escuro de salão desfocado.

### 3. `cartaz-blackjack.png` — nome: **BLACKJACK**
Duas cartas em close sobre feltro verde: um Ás de espadas e um Rei de copas, levemente sobrepostas e inclinadas, com uma pilha de fichas douradas desfocada atrás. A mão do dealer de colete preto entrando pela borda do quadro, no gesto de virar a carta.

### 4. `cartaz-bacara.png` — nome: **BACARÁ**
Ambiente de sala VIP: uma sapata de cartas dourada em primeiro plano com uma carta saindo, feltro verde-escuro encorpado, taças de cristal desfocadas ao fundo, iluminação baixa e íntima. Ar de exclusividade, mais sóbrio que os outros cartazes.

### 5. `cartaz-banca-francesa.png` — nome: **BANCA FRANCESA**
Três dados de cassino verde-esmeralda translúcidos com pontos dourados, congelados no ar em pleno rolar sobre feltro verde, com rastro de movimento suave atrás. Ao fundo, desfocada, a curva dourada da zona de aposta da mesa.

### 6. `cartaz-bac-bo.png` — nome: **BAC BO**
Quatro agitadores de vidro transparente em fila, iluminados por dentro, dois com halo dourado à esquerda e dois com halo vermelho-rubi à direita, cada um com um dado verde-esmeralda tremendo dentro (leve borrão). Enquadramento frontal e simétrico, bem moderno, com cara de estúdio de cassino ao vivo.

### 7. `cartaz-stock-market.png` — nome: **STOCK MARKET**
Um gráfico de cotação em néon subindo em diagonal forte, verde brilhante, atravessando o quadro, com partículas e números desfocados atrás (ilegíveis de propósito). Embaixo, a silhueta dourada de um touro de bolsa estilizado, discreta. Cores mais frias que o resto do pacote (azul e verde), com o dourado só nas bordas — é o jogo mais "moderno" do catálogo.

### 8. `cartaz-truco.png` — nome: **TRUCO**
Quatro cartas de truco abertas em leque na mão de alguém, em close, com o 4 de paus (o zap) em destaque nítido na frente. Fundo de mesa de madeira escura com marcador de pontos entalhado desfocado atrás, luz quente de boteco chique. Bem brasileiro, mais caloroso e menos formal que os cartazes de cassino.

### 9. `cartaz-domino.png` — nome: **DOMINÓ**
Peças de dominó pretas de resina com pontos dourados incrustados, em pé numa fila em efeito dominó — a primeira já caindo — sobre feltro verde-escuro embutido em madeira. Close baixo, quase na altura da mesa, com profundidade de campo curta.

### 10. `cartaz-poker.png` — nome: **POKER**
Um royal flush de espadas aberto em leque, em close, sobre feltro verde-esmeralda, com pilhas altas de fichas douradas e pretas desfocadas atrás e um "dealer button" branco em primeiro plano. Iluminação de spot forte vindo de cima.

---

# PARTE 2 — Cartazes de variante (pasta `cartazes/variantes/`)

Aparecem na tela seguinte, quando o jogo tem mais de um jeito de jogar. São **mais largos e mais baixos** que os cartazes principais, porque ficam empilhados numa lista.

Todos: paisagem **1200x600**, com o nome escrito à esquerda e a arte à direita.

### 11. `truco-paulista.png` — nome: **PAULISTA**
Lado direito: uma carta virada pra cima (a "vira") com outras três cartas em leque atrás dela, sugerindo que a manilha muda a cada mão. Fundo de madeira escura com friso dourado. Escreva também, em letras bem menores embaixo do nome: **MANILHA SAI DA VIRA**.

### 12. `truco-mineiro.png` — nome: **MINEIRO**
Lado direito: as quatro manilhas fixas abertas lado a lado — 4 de paus, 7 de copas, Ás de espadas e 7 de ouros — todas nítidas e reconhecíveis. Fundo de madeira escura com friso vermelho-rubi (pra diferenciar do Paulista). Escreva em letras menores embaixo do nome: **MANILHAS FIXAS**.

### 13. `modo-1x1.png` — nome: **1 x 1**
Lado direito: duas cadeiras de couro frente a frente numa mesa pequena, vista de cima, com uma carta em cada lugar. Sensação de duelo. Fundo de feltro verde.

### 14. `modo-2x2.png` — nome: **2 x 2**
Lado direito: quatro cadeiras ao redor de uma mesa quadrada, vista de cima, com dois lugares opostos marcados em dourado e os outros dois em vermelho-rubi — mostrando quem é dupla de quem. Fundo de feltro verde.

### 15. `modo-sozinho.png` — nome: **SOZINHO**
Lado direito: uma cadeira só de frente pra uma mesa com o crupiê do outro lado (silhueta), vista lateral. Sugere jogar contra a casa. Fundo de feltro verde.

### 16. `modo-mesa-online.png` — nome: **MESA ONLINE**
Lado direito: uma mesa vista de cima com várias fichas de cores diferentes espalhadas em posições distintas, sugerindo muita gente apostando junto. Fundo de feltro verde com brilho dourado.

---

# PARTE 3 — Interface do lobby (pasta `interface/`)

Aqui é o oposto dos cartazes: **nenhum texto e nenhum número**, porque o app escreve tudo por cima. São molduras e enfeites vazios.

### 17. `hud-fichas.png` — paisagem, 600x200, fundo transparente
A moldura do contador de fichas que fica no topo da tela. Uma cápsula horizontal alongada de cantos bem arredondados, em vidro preto fosco com borda dourada fina. Na ponta esquerda, **saindo pra fora da cápsula**, uma pilha de três fichas de cassino douradas empilhadas e levemente inclinadas, com brilho. O resto da cápsula fica **vazio e escuro** — é onde o número de fichas é escrito. Na ponta direita, um pequeno botão redondo dourado com um sinal de **+** gravado (é o atalho pra loja).

### 18. `hud-barra-nivel.png` — paisagem, 800x120, fundo transparente
A barra de progresso de nível, **vazia**. Uma calha horizontal longa e fina, de cantos arredondados, em metal escuro com borda dourada, com o interior vazio e escuro (o app desenha o preenchimento por cima). Na ponta esquerda, um **escudo/brasão circular dourado vazio** encostado na calha — é onde o número do nível é escrito. Sem nenhuma marcação de porcentagem.

### 19. `hud-barra-nivel-preenchimento.png` — paisagem, 800x120, fundo transparente
Só o **preenchimento** da barra do item 18: uma faixa horizontal com exatamente a mesma altura e o mesmo arredondamento do interior da calha, em degradê dourado brilhante (mais claro no meio, mais escuro nas bordas), com um brilho suave correndo por cima. Precisa ter a **largura total da calha** — o app corta pela porcentagem. Sem moldura, só a faixa.

### 20. `moldura-cartaz.png` — retrato, 800x1200, fundo transparente
A moldura que envolve cada cartaz de jogo no lobby, pra dar acabamento. Só o **contorno**: uma borda dourada de uns 20 pixels de espessura, cantos arredondados, com um pequeno ornamento de losango no meio de cada lado. O **centro precisa ser completamente transparente**, porque a arte do jogo aparece por dentro.

### 21. `moldura-cartaz-destaque.png` — retrato, 800x1200, fundo transparente
A mesma moldura do item 20, no mesmo alinhamento exato, mas em versão "em destaque": mais grossa, com brilho dourado intenso ao redor e pequenas partículas de luz nos cantos. Serve pro jogo em promoção ou recém-lançado.

### 22. `selo-bloqueado.png` — quadrado, 400x400, fundo transparente
Um cadeado dourado fechado, de estilo antigo e ornamentado, com um leve reflexo. Vai por cima do cartaz de um jogo que a pessoa ainda não desbloqueou por nível.

### 23. `selo-novo.png` — paisagem, 500x200, fundo transparente
Uma fita diagonal (tipo faixa de canto) em vermelho-rubi com borda dourada, **vazia** — o app escreve "NOVO" por cima. Só a fita, inclinada em 45 graus, com uma leve sombra.

### 24. `fundo-selecao-modo.png` — retrato, 1284x2778
O fundo da tela em que a pessoa escolhe a variante e o modo. Um corredor de cassino visto de dentro, com portas douradas fechadas de cada lado se perdendo na profundidade, tapete verde-escuro no chão, luz baixa e quente. Bem desfocado e escuro no geral — é fundo, não pode competir com os cartazes que vão por cima. Sem nenhum texto.

### 25. `icones-lobby.png` — quadrado, 1024x1024, grade 2x2, fundo transparente
Quatro ícones no mesmo estilo 3D dourado dos que você já fez: (a) um par de pessoas lado a lado (entrar em mesa online), (b) uma pessoa sozinha (jogar contra a casa), (c) duas setas girando em círculo (atualizar lista de mesas), (d) uma estrela dentro de um círculo (favoritar jogo).

---

### Instrução final

Organize e me devolva um zip chamado `casino-inova-lobby.zip`:

```
casino-inova-lobby/
  cartazes/            (itens 1 a 10: os 10 jogos)
  cartazes/variantes/  (itens 11 a 16: variantes e modos)
  interface/           (itens 17 a 25: HUD, molduras, selos e fundo)
```
