# CASINO INOVA — Guia completo para Claude/Claudio

## Objetivo deste pacote

Este pacote reúne imagens originais do CASINO INOVA para orientar a criação do lobby, das páginas dos jogos, das mesas online e das salas de casino ao vivo. As imagens estão organizadas por jogo e nomeadas de acordo com o uso recomendado.

As imagens em `.webp` estão otimizadas para site e aplicativo. Os arquivos oficiais de identidade visual permanecem em `.png`, dentro de `00-BRANDING`.

## Regras gerais de implementação

1. Usar somente `logo-principal-oficial.png` ou `app-icon-oficial.png`. Não redesenhar, deformar, girar ou substituir o logotipo.
2. Manter a identidade visual preta, verde-esmeralda e dourada, com acabamento Art Déco.
3. Preservar as proporções das mesas, cartas, fichas, peças e dados.
4. Não inventar áreas de aposta, assentos, placares ou controles que ocupem posições de jogadores.
5. As imagens são referências visuais. O motor de jogo, probabilidades, RNG, pagamentos e regras finais precisam ser implementados e certificados separadamente.
6. A interface deve ser responsiva. Não cortar cartas, dados, placares, botões de ação ou nomes do jogo em telas menores.

## 01 — Caça-Níqueis

### Como funciona

O jogador escolhe o valor da aposta e aciona o giro. Um RNG determina os símbolos que param nos rolos. O prêmio depende da tabela de pagamentos, das linhas ou formas de ganhar, dos símbolos especiais e dos recursos de bônus. Um caça-níqueis comum não depende de dealer ao vivo; a imagem “ao vivo” deste pacote representa uma anfitriã promocional e a apresentação visual do jogo.

### Imagens e finalidade

- `01-capa-lobby.webp`: cartaz para o lobby e seletor de jogos.
- `02-cassino-fisico.webp`: gabinete físico de referência.
- `03-cassino-ao-vivo.webp`: composição com anfitriã e gabinete.
- `04-jogo-online.webp`: tela principal do slot online.
- `05-detalhe-rolos.webp`: detalhe dos cinco rolos e símbolos.

### Não alterar

Manter cinco rolos, símbolos nítidos, botão de giro visível e área inferior reservada a aposta, saldo e controles.

## 02 — Roleta

### Como funciona

Esta referência usa roleta europeia de zero único. O jogador aposta em números ou grupos de números; depois a bola gira na roda e o número onde ela para determina o resultado. A mesa deve permitir apostas internas e externas, como número pleno, divisão, rua, coluna, dúzia, vermelho/preto, par/ímpar e baixo/alto.

### Imagens e finalidade

- `01-capa-lobby.webp`: cartaz do lobby.
- `02-cassino-fisico.webp`: mesa física com roda e pano numerado.
- `03-cassino-ao-vivo.webp`: dealer, mesa e painel de fundo com o nome `ROLETA`.
- `04-jogo-online-com-nome.webp`: interface online com roda, pano e nome do jogo no painel superior.
- `05-detalhe-roda.webp`: detalhe da roda europeia.

### Não alterar

O painel superior não pode ficar vazio: deve mostrar o emblema oficial e `ROLETA`. Usar somente um zero. Não trocar a ordem real dos números da roda por uma sequência numérica simples.

## 03 — Blackjack

### Como funciona

Cada jogador tenta chegar mais perto de 21 do que o dealer sem ultrapassar 21. As cartas numéricas valem o número mostrado; figuras valem 10; o ás vale 1 ou 11. Um blackjack natural é ás mais uma carta de valor 10. Ações comuns: pedir, parar, dobrar e dividir. O dealer compra ou para segundo regras fixas da mesa.

### Imagens e finalidade

- `01-capa-lobby.webp`: cartaz do lobby.
- `02-cassino-fisico.webp`: formato da mesa física.
- `03-cassino-ao-vivo.webp`: dealer e mesa para composição ao vivo.
- `04-jogo-online.webp`: interface base sem cartas de todos os jogadores.
- `05-demonstracao-distribuicao-inicial.webp`: dealer com 10 aberto e uma carta fechada; quatro jogadores com mãos de 21, 18, 11 e 16.
- `06-demonstracao-rodada-em-andamento.webp`: exemplos de blackjack, pedido de carta e divisão de par.
- `07-detalhe-cartas-dos-jogadores.webp`: recorte para explicar visualmente as mãos.

### Não alterar

As demonstrações devem manter as cartas de todos os jogadores visíveis. Cada mão precisa exibir um total coerente. Não colocar uma mesma carta em posições deformadas, não esconder assentos e não substituir uma posição de jogador por painel ou placar.

## 04 — Bacará

### Como funciona

O jogador aposta em `JOGADOR`, `BANCA` ou `EMPATE`. Cada lado recebe duas cartas e, conforme regras automáticas do bacará, pode receber uma terceira. Ás vale 1; cartas de 2 a 9 valem o número; 10, valete, dama e rei valem zero. Quando a soma passa de 9, considera-se apenas o último algarismo. Exemplo: 15 vale 5.

### Imagens e finalidade

- `01-capa-lobby.webp`: cartaz do lobby.
- `02-cassino-fisico.webp`: formato da mesa física.
- `03-cassino-ao-vivo.webp`: dealer e mesa para sala ao vivo.
- `04-jogo-online.webp`: interface base com as áreas JOGADOR, EMPATE e BANCA.
- `05-demonstracao-duas-cartas.webp`: JOGADOR com 4+3 = 7 e BANCA com K+6 = 6.
- `06-demonstracao-terceira-carta.webp`: exemplo com três cartas do JOGADOR totalizando 9 e duas cartas da BANCA totalizando 8.
- `07-detalhe-cartas-jogador-banca.webp`: detalhe da distribuição das cartas em lados separados.

### Não alterar

As cartas do JOGADOR ficam à esquerda e as da BANCA à direita. A área EMPATE permanece no centro e não deve receber cartas. A terceira carta não é uma escolha manual do jogador; ela segue a tabela automática de compra.

## 05 — Bac Bo

### Como funciona

Bac Bo adapta o confronto JOGADOR versus BANCA usando quatro dados. Dois dados azuis formam o total do JOGADOR e dois dados vermelhos formam o total da BANCA. Cada dado fica em um agitador automático individual. O maior total vence; totais iguais resultam em EMPATE. Os empates podem ter pagamentos diferentes conforme o total empatado.

### Imagens e finalidade

- `01-capa-lobby.webp`: cartaz do lobby.
- `02-jogo-online-correto.webp`: interface completa com quatro agitadores separados.
- `03-cassino-ao-vivo-correto.webp`: apresentadora e mesa realista ao vivo.
- `04-detalhe-quatro-agitadores.webp`: os quatro agitadores — dois azuis e dois vermelhos.
- `05-detalhe-dados-azuis-vermelhos.webp`: detalhe das cores e separação dos dados.

### Não alterar

São exatamente quatro dados cúbicos, nunca retangulares: dois azuis para JOGADOR e dois vermelhos para BANCA. Cada dado deve permanecer no seu próprio agitador.

## 06 — Stock Market

### Como funciona

O jogador escolhe `ALTA` ou `BAIXA` antes da sessão. Um gráfico percentual gerado por RNG varia entre -100% e +100% e não termina em 0%. Se a direção escolhida coincidir com o resultado final, a carteira aumenta de acordo com a variação percentual; se não coincidir, diminui proporcionalmente. Dependendo da versão, existe apresentadora ao vivo e opção de reinvestimento automático. O saque pode estar sujeito à comissão prevista na versão do jogo.

### Imagens e finalidade

- `01-capa-lobby.webp`: cartaz do lobby.
- `02-jogo-online-correto.webp`: versão online sem apresentadora.
- `03-cassino-ao-vivo-correto.webp`: versão com apresentadora em janela de vídeo.
- `04-detalhe-grafico-percentual.webp`: gráfico correto de -100% a +100%.
- `05-detalhe-alta-baixa-controles.webp`: botões ALTA/BAIXA, fichas e controles.

### Não alterar

Não transformar o jogo em terminal de compra e venda de ações, gráfico de velas ou simulador de bolsa tradicional. O elemento central é uma única linha percentual de ALTA/BAIXA, com carteira e temporizador.

## 07 — Banca Francesa

### Como funciona

O resultado é a soma das faces superiores de três dados. As chances são:

- `ASES`: total 3.
- `PEQUENO`: total 5, 6 ou 7.
- `GRANDE`: total 14, 15 ou 16.
- Totais 4, 8, 9, 10, 11, 12, 13, 17 ou 18 são lançamento nulo; a aposta não ganha nem perde.

A mesa possui duas linhas contínuas em forma de arcos concêntricos: a área interior é GRANDE e a área exterior é PEQUENO. A área ASES fica no recorte superior esquerdo. Os três dados são lançados numa arena própria.

### Imagens e finalidade

- `01-capa-lobby.webp`: cartaz do lobby.
- `02-cassino-fisico-correto.webp`: formato físico pesquisado e corrigido.
- `03-cassino-ao-vivo-correto.webp`: tiradora e mesa correta.
- `04-jogo-online-correto.webp`: interface online com áreas contínuas e três dados.
- `05-detalhe-areas-e-tres-dados.webp`: detalhe de ASES, GRANDE, PEQUENO e arena.

### Não alterar

Não criar retângulo vazio no pano. Não separar GRANDE e PEQUENO em caixas comuns. Manter os arcos concêntricos, o recorte ASES e exatamente três dados.

## 08 — Truco

### Como funciona

Cada jogador recebe três cartas. As vazas são disputadas uma por vez e a dupla que vencer duas vazas ganha a mão. A pontuação pode aumentar quando alguém pede Truco e o adversário aceita, aumenta ou corre. A ordem das cartas e a definição de manilhas mudam entre variantes, como Truco Paulista e Truco Mineiro; a implementação precisa escolher explicitamente a variante antes de programar a lógica.

### Imagens e finalidade

- `01-capa-lobby.webp`: cartaz do lobby.
- `02-cassino-fisico.webp`: mesa física.
- `03-cassino-ao-vivo.webp`: anfitrião e mesa.
- `04-jogo-online-placar-fora-dos-jogadores.webp`: quatro posições completas — Norte, Leste, Sul/Você e Oeste — com placar no canto superior direito.
- `05-baralho-truco-oficial.webp`: baralho visual do CASINO INOVA.

### Não alterar

O placar nunca pode ocupar o lugar de um jogador. Devem existir exatamente quatro posições, cada uma com três cartas. O placar fica fora da mesa, em margem própria, sem cobrir avatar ou cartas.

## 09 — Dominó

### Como funciona

O conjunto duplo-seis tem 28 peças. Numa configuração comum de quatro jogadores, cada participante recebe sete peças. Na sua vez, o jogador conecta uma peça cuja ponta tenha o mesmo número de uma das extremidades abertas da corrente. Vence quem terminar as peças primeiro ou quem tiver a menor soma quando o jogo fechar, conforme a regra adotada.

### Imagens e finalidade

- `01-capa-lobby.webp`: cartaz do lobby.
- `02-cassino-fisico.webp`: mesa física.
- `03-cassino-ao-vivo.webp`: anfitrião e mesa.
- `04-jogo-online-sete-pecas.webp`: mesa online com exatamente sete peças distintas na mão local.
- `05-conjunto-28-pecas.webp`: conjunto completo duplo-seis.

### Não alterar

As peças são retangulares, mas os pontos e a divisão central devem permanecer corretos. Não repetir sete peças iguais na mão do jogador. O conjunto completo contém 28 combinações únicas.

## 10 — Poker

### Como funciona

Esta referência segue Texas Hold'em. Cada jogador recebe duas cartas fechadas. Até cinco cartas comunitárias são abertas em três etapas: flop com três cartas, turn com uma e river com uma. As rodadas de apostas ocorrem antes do flop e após cada etapa. Vence a melhor combinação de cinco cartas ou o último jogador restante após os demais desistirem.

### Imagens e finalidade

- `01-capa-lobby.webp`: cartaz do lobby.
- `02-cassino-fisico.webp`: mesa física.
- `03-cassino-ao-vivo.webp`: dealer e mesa.
- `04-jogo-online.webp`: mesa online com jogadores, fichas e cartas comunitárias.
- `05-detalhe-cartas-comunitarias.webp`: detalhe do bordo e do pote.

### Não alterar

Cada jogador recebe duas cartas próprias. A mesa deve suportar cinco cartas comunitárias, pote central, botão do dealer, apostas e assentos sem sobreposição.

## Fontes usadas para as três correções pesquisadas

- Banca Francesa: Regulamento n.º 808/2015 do Diário da República — https://diariodarepublica.pt/dr/detalhe/regulamento/808-2015-71113676
- Stock Market: página oficial da Evolution — https://games.evolution.com/live-casino/game-shows/stock-market/
- Bac Bo: página oficial da Evolution — https://games.evolution.com/live-casino/live-craps-and-dice/bac-bo/

## Aviso de produção

Estas imagens são referências originais do CASINO INOVA e não substituem especificações matemáticas, homologação de RNG, regras aprovadas pela jurisdição, controles de idade, jogo responsável, privacidade, segurança ou licenciamento. Antes de publicar um jogo com dinheiro real, validar toda a implementação com fornecedores e órgãos reguladores competentes.
