# Briefing de imagens — Casino Inova

**Como usar:** copie tudo a partir da linha "Você vai atuar como diretor de arte..." (inclui a Parte 0 até o final) e cole inteiro numa conversa do ChatGPT com geração de imagens e Python/Code Interpreter ativados. Deixe ele gerar tudo na mesma conversa — é o que mantém o estilo consistente entre uma imagem e outra. No final, ele empacota tudo num `.zip` pronto pra baixar.

Depois de baixar e descompactar, os arquivos vão exatamente para dentro de `casino-inova/app/assets/images/`, seguindo a mesma estrutura de pastas pedida no final deste prompt (confira `app/assets/images/README.md` no projeto).

---

## Texto para colar no ChatGPT

Você vai atuar como diretor de arte de um estúdio AAA de jogos mobile e vai gerar, um por um, **todo o pacote de assets visuais** de um cassino social chamado **Casino Inova**. É um app de cassino social para celular — sem dinheiro real em jogo, só entretenimento — com caça-níqueis, roleta, blackjack, bacará, banca francesa, truco, dominó e poker. Preciso que cada imagem pareça ter saído do mesmo jogo, então siga o guia de estilo abaixo em **todas** as gerações, sem exceção, e mantenha os mesmos personagens reconhecíveis sempre que eles reaparecerem.

### PARTE 0 — Regras gerais para todas as imagens

1. **Nunca escreva texto solto na imagem** (números, palavras, HUD), exceto nos dois itens em que eu pedir explicitamente um logotipo ou ícone com a marca. Todo texto de interface (saldo, apostas, nomes) é desenhado depois dentro do app — se a imagem vier com texto embutido, ela não serve.
2. **Emblema da marca:** sempre que eu pedir para aplicar "o emblema Casino Inova", use um losango/ficha de cassino estilizado, verde-esmeralda com borda dourada, com as iniciais "CI" entrelaçadas em dourado no centro — sem escrever o nome completo. Esse emblema pode aparecer bordado em uniformes, gravado no verso das cartas, entalhado em mesas.
3. **Estilo visual:** 3D fotorrealista renderizado, qualidade de jogo mobile AAA (referência de nível: Jackpot World, Blackjackist, Golden Hearts Games) — nunca cartoon achatado, nunca flat design, nunca ilustração 2D.
4. **Paleta de cores obrigatória:** preto/carvão profundo (#0B0F0D) como base, verde-esmeralda de feltro (#0F5132 a #177A4C) nas mesas e painéis, dourado quente (#E5B567 a #FFD98A) em todo metal, borda e destaque, toques pontuais de vermelho-rubi (#E63950) só em elementos de "jackpot" ou urgência, branco-creme (#F5F1E6) em qualquer superfície clara. Nunca usar roxo, rosa neon ou paleta "candy" — o tom é cassino de luxo (Vegas/Mônaco contemporâneo), não parque de diversões.
5. **Iluminação:** spotlights quentes e dramáticos, brilho dourado (bloom) suave em bordas metálicas, partículas de brilho discretas no ar, reflexos nítidos em superfícies polidas (vidro, metal, verniz). Fundo sempre com profundidade — nunca cor chapada atrás do assunto.
6. **Materiais recorrentes:** veludo e feltro nas mesas, madeira escura tipo mogno nas bordas e molduras, metal dourado polido em detalhes e frisos, couro nos encostos de cadeira quando aparecerem.
7. **Proporção:** eu vou indicar a proporção/tamanho de cada imagem — gere exatamente nessa proporção, é para uso direto em tela de celular.
8. Gere as imagens **nesta ordem**, uma de cada vez, e mantenha esta lista de instruções em mente do início ao fim da conversa.

### PARTE 1 — Marca (pasta `branding/`)

**1. `logo-principal.png`** — quadrado, 2048x2048.
Logotipo do "Casino Inova": o emblema descrito na regra 2 (losango/ficha verde-esmeralda com borda dourada e "CI" entrelaçado em dourado no centro), mas aqui, e só aqui, acompanhado por baixo do wordmark completo "CASINO INOVA" numa tipografia bold, geométrica, levemente arredondada, toda em maiúsculas, com leve efeito de metal dourado escovado e um brilho fino de contorno. Fundo transparente ou preto-carvão liso, iluminação de estúdio, o logo centralizado, com uma leve sombra dourada projetada atrás para dar profundidade.

**2. `logo-mono.png`** — quadrado, 2048x2048.
A mesma composição do item 1, mas em versão monocromática dourada sólida sobre fundo transparente, sem gradientes nem brilho — para uso em lugares pequenos como favicon ou splash minimalista.

**3. `app-icon.png`** — quadrado, 1024x1024, cantos retos (o sistema operacional aplica o arredondamento depois).
Só o emblema (losango/ficha com "CI"), sem o wordmark, preenchendo quase todo o quadro, fundo com gradiente radial de verde-esmeralda escuro para quase preto nas bordas, brilho dourado forte contornando o emblema, aspecto de ícone premium de app de cassino.

**4. `app-icon-adaptive.png`** — quadrado, 1024x1024, com margem de segurança de 20% em todos os lados (para o recorte adaptativo do Android).
Mesmo emblema do item 3, mas menor e centralizado dentro da margem de segurança, fundo verde-esmeralda sólido (sem gradiente) para combinar com o `backgroundColor` do ícone adaptativo.

### PARTE 2 — Fundos de tela (pasta `backgrounds/`)

Todos os itens desta seção: proporção retrato de celular, 1284x2778.

**5. `splash.png`**
Plano fechado do emblema Casino Inova flutuando no centro de um salão de cassino vazio e escurecido, feixes de luz dourada cruzando o ambiente como holofotes de show, partículas de brilho no ar, piso de mármore escuro refletindo a luz, silhuetas de mesas de jogo desfocadas ao fundo. Atmosfera de "o cassino está prestes a abrir".

**6. `login-fundo.png`**
Entrada de um cassino de luxo à noite, vista de dentro para fora: portas de vidro e latão dourado entreabertas, tapete vermelho-vinho levando o olhar para dentro, lustres de cristal ao fundo fora de foco, luz quente vazando pelas frestas. Metade inferior da imagem mais escura e menos detalhada — é onde o formulário de login vai ficar sobreposto.

**7. `lobby-fundo.png`**
Vista panorâmica de um salão principal de cassino visto de um mezanino, com várias mesas de jogos diferentes (roleta, cartas, dados) dispostas pelo salão, tapete estampado verde e dourado, colunas de mármore, teto alto com lustres, tudo em profundidade de campo suave para não competir com os ícones de jogo que vão ficar por cima. Terço superior da imagem mais aberto e menos denso — é onde o cabeçalho (saldo, avatar) vai ficar sobreposto.

**8. `torneios-fundo.png`**
Um palco elevado dentro do cassino, com um pódio de três degraus dourado ao centro (sem troféus ainda, o pódio vai ficar vazio pra eu sobrepor números depois), holofotes cruzando de cima, confete dourado congelado no ar, bandeirolas vermelho-rubi e douradas discretas nas laterais. Sensação de "premiação", não de mesa de jogo.

**9. `loja-fundo.png`**
Um cofre de cassino estilizado, com a porta redonda de aço escovado entreaberta deixando escapar uma luz dourada intensa de dentro, pilhas desfocadas de fichas de cassino brilhando na penumbra ao fundo. Metáfora visual de "loja = tesouro guardado".

### PARTE 3 — Perfil do jogador (pasta `perfil/`)

**10. `molduras-avatar.png`** — quadrado, 2048x2048, grade 2x2 com as 4 molduras lado a lado, fundo transparente.
Quatro molduras circulares de avatar, uma por nível de clube: (a) Bronze — anel metálico bronze fosco simples; (b) Prata — anel de prata polida com pequenos frisos; (c) Ouro — anel dourado brilhante com padrão de losangos entalhados, referência ao emblema da marca; (d) Diamante — anel dourado com cristais/diamantes incrustados e um brilho pulsante mais intenso. As quatro na mesma escala e ângulo, só variando o acabamento.

**11. `avatares-padrao.png`** — retrato, 2048x3072, grade 2 colunas x 3 linhas com 6 personagens.
Seis bustos de personagens jogáveis (avatares padrão que o jogador escolhe no perfil, não dealers), diversos em idade, gênero e etnia, todos vestidos com um toque de traje de cassino casual-chique (não uniforme de funcionário) — por exemplo: um homem de smoking desabotoado com gravata solta, uma mulher de vestido de coquetel verde-esmeralda com brincos dourados, um senhor de terno cinza com lenço de bolso dourado, uma jovem de blazer preto e colar de fichas de cassino como acessório estiloso, um homem afrodescendente de camisa social preta com abotoaduras douradas, uma mulher asiática de vestido dourado metálico. Fundo neutro escuro em todos, iluminação de estúdio idêntica, enquadramento de busto (ombros para cima), todos olhando de frente com leve sorriso confiante — este arquivo vira depois seis ícones separados de avatar.

**12. `selo-vip.png`** — quadrado, 1024x1024, fundo transparente.
Um selo/brasão circular de "Clube VIP": coroa dourada estilizada no topo, moldura de losango verde-esmeralda com borda dourada dupla, sem nenhum texto (o app escreve o nível VIP por cima depois).

### PARTE 4 — Personagens dealer, um por mesa (pasta `dealers/`)

Todos os itens desta seção: retrato 3:4, 1536x2048, corpo inteiro ou 3/4, em pé, fundo neutro escuro com leve gradiente e spot de luz atrás do personagem (para poder recortar e usar sobre qualquer mesa depois).

**13. `dealer-blackjack.png`**
Dealer de blackjack, homem ou mulher (à sua escolha), uniforme clássico: colete preto abotoado sobre camisa social branca engomada, gravata borboleta preta, mangas com elástico dourado no braço, o emblema Casino Inova bordado discretamente no bolso do peito do colete. Postura ereta, mãos levemente à frente como quem está prestes a distribuir cartas, expressão profissional e receptiva.

**14. `dealer-roleta.png`**
Crupiê de roleta, colete em veludo vinho profundo (não preto — pra diferenciar visualmente da mesa de blackjack) sobre camisa branca, gravata preta simples, luvas brancas de algodão (padrão real de crupiê de roleta, que não pode tocar as fichas sem luva), postura lateral como quem está girando a roda, um braço estendido.

**15. `dealer-bacara.png`**
Crupiê de bacará, traje mais formal que os anteriores — smoking preto completo com lapela de cetim, gravata borboleta preta, sensação de "sala VIP", postura mais contida e cerimoniosa, mãos cruzadas à frente.

**16. `dealer-poker.png`**
Dealer de sala de poker, visual mais casual-profissional: polo preta ajustada com o emblema Casino Inova bordado no peito (em vez de colete formal), um cordão de identificação simples no pescoço, mangas curtas, postura mais relaxada e atenta, como quem está observando várias mãos ao mesmo tempo.

**17. `banca-francesa-banqueiro.png`**
O **banqueiro** da mesa de banca francesa — o funcionário que recebe e paga as apostas. Colete xadrez preto e dourado (padrão bem marcado, tipo tabuleiro pequeno), camisa branca, gravata borboleta dourada, luvas brancas, um cinto/bolsa de couro preto na cintura com compartimentos pra fichas (referência real de "banco" que anda com o caixa). Postura atenta, uma mão estendida como quem paga uma aposta, a outra seneurando um maço de fichas.

**18. `banca-francesa-tirador.png`**
O **tirador de dados** (shooter) da mesma mesa de banca francesa — mesmo uniforme colete xadrez preto e dourado da equipe, mas sem a bolsa de fichas (ele não mexe em dinheiro, só nos dados). Segurando um cinto de couro ou copo de dados de couro, no gesto de prestes a lançar os dados sobre a mesa, postura mais dinâmica e inclinada para frente.

**19. `banca-francesa-apontador.png`**
O **apontador de pontos** (scorekeeper) da mesma mesa — também de colete xadrez preto e dourado, mas com um pequeno bloco/placar de madeira com giz ou marcador na mão, como quem está registrando o resultado da última rodada num quadro de pontuação. Postura voltada de lado, meio corpo em direção a um quadro (o quadro em si não precisa aparecer, só o gesto).

**20. `anfitriao-truco-domino.png`**
Um anfitrião de mesa para as salas de truco e dominó — visual mais brasileiro e descontraído que os dealers formais das outras mesas: camisa social de manga curta num tom verde-garrafa, sem gravata, um avental curto de couro por cima (estilo "boteco chique"), o emblema Casino Inova bordado pequeno no avental. Expressão mais aberta e sorridente, braços cruzados, em pé ao lado de uma mesa (sugerida, não detalhada).

**21. `anfitria-slots.png`**
Uma anfitriã (ou anfitrião) de salão de caça-níqueis, vestido de coquetel dourado metálico, luvas longas pretas, postura de boas-vindas com um braço aberto convidando a entrar, usada como personagem de destaque na tela de boas-vindas da seção de slots.

### PARTE 5 — Mesas de jogo, uma por jogo (pasta `mesas/`)

Vista de cima (top-down ou levemente angulada, ~60 graus), retrato 1284x2778, mostrando o tampo completo da mesa preenchendo o quadro, sem personagens nem cartas/fichas em jogo (a mesa "vazia e pronta", pra receber as peças do jogo desenhadas depois em cima pelo app).

**22. `mesa-blackjack.png`**
Mesa semicircular clássica de blackjack, feltro verde-esmeralda, borda estofada em couro preto com friso dourado, arco de texto entalhado em dourado no feltro dizendo apenas o desenho de um leque de cartas (sem escrever "blackjack pays 3 to 2" — sem texto), sete círculos de aposta dourados marcados no feltro.

**23. `mesa-roleta.png`**
Mesa de roleta completa: a roda dourada e preta com os números encaixada numa extremidade, o painel de apostas (números 0 a 36 em vermelho e preto sobre fundo verde) ocupando o resto do tampo, acabamento de madeira escura na borda.

**24. `mesa-bacara.png`**
Mesa oval de bacará, feltro verde mais escuro e luxuoso que o do blackjack, com as áreas demarcadas em dourado para "Punto" e "Banco" (representadas como formas/campos geométricos, sem escrever as palavras), estofado em couro bordô nas bordas.

**25. `mesa-banca-francesa.png`**
Mesa de banca francesa (jogo real "Grande e Pequena": aposta-se na soma de 3 dados, não num número) — layout completo e o texto exato pra pedir essa imagem estão em `docs/prompt-mesa-banca-francesa.md`, já que o layout de apostas (zonas Pequeno/Grande/Ases/Linha) é mais específico do que cabe num item deste briefing geral.

**26. `mesa-truco.png`**
Mesa de truco brasileira, mais rústica e calorosa que as outras: tampo de madeira de lei escura envernizada (não feltro), um centro com uma leve textura de couro trançado, quatro lugares marcados nos cantos, um pequeno espaço lateral com marcador de pontos entalhado em relevo (sem números escritos).

**27. `mesa-domino.png`**
Mesa de dominó, tampo também em madeira escura como a de truco (para reforçar a mesma "sala brasileira"), mas com uma superfície de feltro fino verde-escuro embutida só na área central onde as peças são jogadas, quatro lugares marcados.

**28. `mesa-poker.png`**
Mesa oval de poker, feltro verde-esmeralda com uma trilha dourada contornando toda a borda (racetrack), estofado preto acolchoado na beirada, um pequeno recorte redondo dourado de cada lado para as fichas do jogador, área central mais escura para o pote.

**29. `caca-niquel-gabinete-fortuna.png`** — retrato 1284x2778.
Um gabinete físico de caça-níquel de luxo, tema "Fortuna" — moldura dourada esculpida ao redor da tela, topper iluminado no alto com o emblema Casino Inova, botões grandes de couro vermelho e dourado na base, luzes correndo pela moldura como num caça-níquel de cassino de verdade. A tela do gabinete pode ficar com um brilho azul-esverdeado neutro (sem símbolos definidos — eles vêm do item 33).

### PARTE 6 — Cartas, fichas e dados (pastas `cartas/`, `fichas/`, `dados/`)

**30. `verso-carta.png`** (`cartas/`) — proporção de carta, 750x1050, cantos arredondados.
Verso de baralho: fundo verde-esmeralda profundo com um padrão geométrico repetido sutil de losangos dourados finos, o emblema Casino Inova centralizado em dourado, borda fina dourada contornando toda a carta.

**31. `naipes-frente.png`** (`cartas/`) — retrato 2048x2048, grade 4x4 mostrando os 4 naipes (copas, ouros, paus, espadas) em 4 estilos de índice (A, K, Q, J como amostra).
Frente de carta clássica em fundo branco-creme, naipes vermelho-rubi (copas e ouros) e preto-carvão (paus e espadas) com um acabamento levemente texturizado tipo papel de alta qualidade, as figuras (K, Q, J) redesenhadas com roupas inspiradas em realeza de cassino moderno (dourado e verde-esmeralda) em vez do estilo tradicional francês.

**32. `fichas-conjunto.png`** (`fichas/`) — quadrado, 2048x2048, as fichas dispostas em leque ou em pilha organizada.
Seis fichas de cassino em denominações diferentes, cada uma com cor própria e o emblema Casino Inova gravado no centro: branca (menor valor), vermelha, azul, verde, preta, e uma dourada com detalhe de cristal (maior valor, "VIP"). Bordas com o padrão listrado tradicional de ficha de cassino, material com leve brilho fosco de resina.

**33. `dados-conjunto.png`** (`dados/`) — quadrado, 1024x1024.
Dois dados de cassino em close-up, material vermelho translúcido com pontos brancos (padrão real de dado de cassino profissional), levemente inclinados mostrando três faces cada, apoiados sobre feltro verde-escuro, uma sombra suave embaixo.

### PARTE 7 — Roleta e slots (pasta `roleta/`, `slots/`)

**34. `roda-roleta.png`** (`roleta/`) — quadrado, 2048x2048, vista de cima, fundo transparente.
Roda de roleta europeia isolada (sem a mesa ao redor), aro externo dourado polido, números alternando vermelho e preto com o zero em verde-esmeralda, centro em metal dourado escovado com detalhes entalhados, bola de marfim branca visível numa das casas.

**35. `simbolos-slot.png`** (`slots/`) — quadrado, 2048x2048, grade 3x3 com 9 símbolos.
Nove símbolos de caça-níquel no mesmo estilo 3D dourado/joia: sete (vermelho brilhante), sino de ouro, ferradura dourada, três barras (BAR) em placa esmaltada preta e dourada, diamante verde-esmeralda facetado, coroa dourada com joias, moeda de ouro com o emblema Casino Inova gravado, estrela dourada, e um símbolo de "jackpot" (um caixote/baú do tesouro entreaberto brilhando). Todos com o mesmo acabamento brilhante e a mesma direção de luz.

### PARTE 8 — Ícones e premiação (pastas `icones/`, `trofeus/`)

**36. `icones-ui.png`** (`icones/`) — quadrado, 2048x2048, grade 4x4, fundo transparente, ícones pequenos e simples (não cenas complexas como as anteriores).
Dezesseis ícones no mesmo estilo 3D dourado com leve brilho: moeda/ficha, coroa VIP, troféu, sino de notificação, envelope de presente (fichas de amigo), cadeado (mesa bloqueada por nível), coração/curtida, balão de chat, calendário (torneio diário), relógio de areia (torneio semanal), estrela (favoritos), engrenagem (configurações), escudo (segurança/antifraude), seta para cima (nível up), carrinho de compras (loja), lupa (buscar amigos).

**37. `trofeus-ranking.png`** (`trofeus/`) — retrato 1536x2048.
Três troféus de cassino lado a lado em tamanhos diferentes (1º lugar mais alto e ao centro, 2º e 3º menores nas laterais), taças douradas estilizadas com uma ficha de cassino incrustada no topo de cada uma no lugar da alça tradicional, base de mármore preto, o troféu do centro com um brilho mais intenso que os outros dois.

**38. `podio-3d.png`** (`trofeus/`) — retrato 1284x2778.
Pódio de premiação de três degraus (1º mais alto ao centro, 2º à esquerda, 3º à direita), material mármore preto com friso dourado nas bordas de cada degrau, holofotes de cima iluminando cada posição, confete dourado congelado no ar — os degraus ficam vazios (sem números) para o app sobrepor o avatar de cada jogador depois.

---

### Instrução final — empacotar tudo

Depois de gerar todas as imagens da Parte 1 até a Parte 8, organize cada arquivo na pasta indicada entre parênteses no título de cada item (por exemplo, `logo-principal.png` vai em `branding/`) e compacte a pasta inteira num único arquivo `casino-inova-assets.zip`, mantendo essa estrutura de subpastas:

```
casino-inova-assets/
  branding/
  backgrounds/
  perfil/
  dealers/
  mesas/
  cartas/
  fichas/
  dados/
  roleta/
  slots/
  icones/
  trofeus/
```

Me devolva o link de download do zip ao final.
