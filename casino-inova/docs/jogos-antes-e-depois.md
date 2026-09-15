# Os jogos, antes e depois — primeira rodada da GAME PRESENTATION REBUILD

> As imagens: `app/verificacao/retratos-antes/` e `app/verificacao/retratos-depois/`.
> Como refazer: com o servidor no ar,
> `node verificacao/retratos-dos-jogos.mjs verificacao/retratos-depois`.
> Viewport: **390 × 844 @3x** — iPhone 14/15, que é onde o jogo é jogado.

O diagnóstico está em `por-que-os-jogos-nao-parecem-jogos.md`. Este documento registra o
que **mudou de fato**, com a imagem dos dois lados, e o que continua na fila.

---

## Como os retratos são tirados

Pelo mesmo caminho que o jogador faz, e não por atalho de teste: abre o site, entra com
e-mail e senha, fecha a recompensa diária, escolhe o jogo no salão, escolhe o modo mais
simples, fecha o tutorial e — quando o jogo tem uma porta antes da mesa — começa a
partida. O que aparece no retrato é o que aparece pra quem joga.

Três coisas que o script precisou aprender, e cada uma delas é um defeito de teste que
teria virado retrato mentiroso:

- **A mesa em destaque muda.** O cartão em destaque ganha um sufixo no rótulo, e o
  destaque gira entre os jogos. Uma lista de rótulos exatos acerta hoje e erra amanhã —
  foi assim que roleta e blackjack começaram a falhar alternadamente sem ninguém ter
  mexido em nada. Agora o cartão é achado pelo COMEÇO do rótulo.
- **O servidor limita dez entradas por cinco minutos**, por IP e por e-mail. Rodando o
  script três vezes pra comparar antes e depois, a terceira levava 429 e os dez retratos
  falhavam. A trava está certa e não se desliga pra tirar foto: o script guarda a sessão
  do navegador e entra uma vez só, como o jogador também faz.
- **O salão sobe modal sozinho.** Recompensa diária e subida de nível cobrem os cartões.
  Sem fechar, o retrato é do modal.

---

## O que mudou

### 1. A quinta ficha estava cortada — em todos os jogos

**Antes:** o trilho de fichas era uma gaveta horizontal com a barra de rolagem
desligada. Num iPhone as cinco fichas do degrau não cabem, então a maior aparecia
partida na borda direita, sem nenhum sinal de que dava pra arrastar. Caça-níqueis,
bacará e dominó mostram a mesma ficha cortada no mesmo lugar.

**Depois:** as cinco dividem a largura e cabem. E o corpo da letra é escolhido pelo
rótulo mais comprido do trilho — `adjustsFontSizeToFit` existe no iOS e **não** existe
no react-native-web, e o jogo chega pelo navegador; sem isso "100 mil" virava "100 …".

Some, de quebra, mais um `ScrollView` de dentro da área de jogo.

### 2. A mesa acabava no meio da tela

**Antes:** o degradê ia de 25% de preto no topo até **cor sólida em 80% da altura** — e é
justamente abaixo dessa linha que ficam os controles das dez telas. Um quinto da tela era
uma laje preta debaixo da foto.

Era essa laje que produzia a leitura do problema: a fotografia virava enfeite de topo, e o
jogo acontecia num painel escuro colado embaixo dela.

**Depois:** o escurecimento vai até a borda e termina em 92%. O texto continua legível
sobre qualquer foto, e a mesa continua lá — no caça-níqueis dá pra ver a máquina inteira,
da coroa à base.

### 3. Bacará: a aposta saiu do formulário e foi pro pano

**Antes:** uma fotografia de mesa de bacará com PLAYER, BANKER e TIE impressos em doze
lugares — e, por cima, três pílulas de texto ("Jogador · ×2", "Banca · ×1,95",
"Empate · ×9"), um rótulo "SUA APOSTA", um botão "Apostar" e a frase "Escolha onde apostar
e mande jogar." boiando no feltro. O jogador escolhia num formulário, em cima de uma mesa
cujas casas eram decoração.

**Depois:** `PanoDoBacara`. Três casas de feltro na disposição de qualquer mesa de bacará
do mundo — empate atravessando por cima, jogador e banca lado a lado embaixo —, cada uma
com o que paga escrito como a mesa escreve, e **a pilha de fichas dentro da casa em que
ela foi encostada**. A casa escolhida ganha linha dourada grossa; a que ganha a rodada
acende.

Duas decisões que o retrato forçou, e que valem pros próximos panos:

- **O pano é desenhado, não recortado da foto.** As casas da fotografia são de doze
  lugares, cada uma do tamanho de um selo: tocar a caixa "BANKER" do assento 7 seria mirar
  em 30 pixels. Aqui joga uma pessoa, e uma pessoa ocupa uma posição inteira.
- **A casa é feltro opaco, não vidro.** Com fundo translúcido, as caixas impressas
  apareciam POR DENTRO das nossas — duas mesas de bacará sobrepostas. Véu nenhum resolve
  isso sem apagar a mesa toda, porque o impresso é dourado sobre verde. Uma casa de aposta
  numa mesa de verdade é feltro.

### 4. Dominó: a peça deixou de ser a string "3|5"

**Antes:** no modo contra o computador, a peça era `${tile.a}|${tile.b}` dentro de um
botão. Sete botões de texto na mão e uma fila de botões de texto na mesa, que rolava de
lado. A arte das 28 peças **já existia** e já era usada na mesa online — o modo contra o
bot, que é o primeiro que qualquer pessoa abre, tinha ficado pra trás.

**Depois:** peças de verdade. Em pé na mão (como se segura), deitadas na mesa (como
encostam ponta com ponta), e a carroça atravessada. A corrente dobra esquina em vez de
rolar. A peça escolhida sobe da mão; as que a regra da abertura proíbe ficam apagadas.

E o aviso mostra **a peça**, não o nome dela: "abra com o 6|6" é código; a peça é a peça.

### 5. A partida existia e a tela não achava mais

Defeito achado pelo retrato, e é de dinheiro: truco, dominó e pôquer guardam a partida na
memória do servidor, e a tela só a conhecia como resposta de uma jogada. Bastava recarregar
a página pra a tela abrir no "Começar partida" e o servidor recusar com *"você já tem uma
partida em andamento"*. A entrada estava debitada, a partida viva, e não havia caminho de
volta — ficava assim até o servidor reiniciar.

Agora existe `GET /games/{truco,domino,poker}/partida`, e as três telas pedem ao abrir.
(O caso em que o servidor reinicia de verdade é o outro conserto, do P0: a entrada volta
pro jogador — `verify:devolucao`.)

---

## O que ficou guardado por conferência

`npm run verify:apresentacao` (no aplicativo) guarda o que já foi consertado:

- o orçamento de rolagem — nove telas ainda rolam, com o motivo de cada uma, e a lista
  **só pode encolher**;
- nenhuma tela desenha peça de dominó como texto;
- o degradê vai até a borda e termina translúcido;
- o bacará aposta num pano, e não numa lista de pílulas;
- nenhuma tela joga `erro.message` na cara do jogador.

---

### 6. Bacará: o placar saiu de baixo da mesa, e a mesa parou de rolar

Medindo os dez jogos com a mesa em jogo (`npm run verify:cabe-na-tela`, 390 × 844), o
bacará era o **único** que transbordava: 559 pixels. E o que transbordava era o painel de
histórico, que só aparece depois da primeira rodada.

Ele foi pro mesmo lugar em que o Bac Bo já o põe — atrás de um botão no topo, numa folha
que sobe de baixo. Numa casa de verdade o histórico fica num monitor AO LADO da mesa, não
sobre o feltro. Sem ele empilhado, a mesa cabe e a rolagem saiu.

**Dois enganos no caminho, que valem mais escritos que escondidos:**

- Tirar a rolagem e centrar o conteúdo (`justifyContent: 'center'`) deixou a tela PIOR: com
  o conteúdo passando da altura livre, o centro empurra a sobra pros dois lados — o título
  subiu por cima do saldo e o "Apostar" saiu pela borda de baixo. Cortado dos dois lados é
  pior que rolando. A mesa passou a começar de cima, e quem encolhe primeiro é o lugar das
  cartas, que é quem tem folga.
- A medida que aprovou isso só olhava transbordo. **"Não rola" não é "cabe".** Ela passou a
  medir também o que é tocável e está fora da janela — e, junto, a ignorar o que está
  dentro de uma gaveta com setas, senão acusava três jogos por fazerem a coisa certa.

Hoje: **10 de 10 cabem, sem rolar e sem cortar.**

### 7. Stock Market: os dois blocos verdes viraram posições na mesa

A tela era a definição do problema em miniatura: uma fotografia de pregão — parede de
telas com cotações verdes e vermelhas — coberta por uma moldura de gráfico VAZIA (borda,
fundo escuro, grade e as marcas +100% / 0 / −100% em volta de nada) e, embaixo, dois
retângulos escuros translúcidos escritos ALTA e BAIXA. É o "bloco verde transparente"
apontado como estilo padrão de interação.

**Agora:**

- **ALTA e BAIXA são posições, com superfície própria** — verde de compra e vinho de
  venda, as cores do pregão e não as do tema, que qualquer pessoa que já viu uma tela de
  bolsa reconhece antes de ler a palavra. O que a posição paga vem escrito nela, e a ficha
  apostada fica em cima da posição escolhida (`PilhaDeFichas`, o mesmo do bacará e do
  blackjack).
- **Sem cotação, sem painel de cotação.** Na primeira visita não existe fechamento nenhum
  pra mostrar, e a tela desenhava a moldura inteira mesmo assim. Escala de um gráfico que
  não existe é enfeite fingindo ser informação — e era o que mais fazia a tela parecer
  corretora. Com dados, a moldura volta: aí ela está medindo alguma coisa.
- **Uma instrução, não duas.** "Escolha um lado e invista pra ver a cotação andar." ficava
  em cinza no meio da arte, dizendo o que o botão lá embaixo já diz ("Escolha alta ou
  baixa"). Saiu.
- **O RTP virou legível.** É promessa publicada; estava em cinza de rodapé por cima da
  parede de telas, e sumia. Ganhou tarja escura, como a placa de acrílico atrás do número
  da regra numa mesa de verdade.

### 8. A cena conta o resultado: o prêmio vira ficha voando até o saldo

Era uma frase. *"Banca venceu — +9.750 fichas"*, em texto, embaixo do pano. O jogador
ganhava e a tela **contava** pra ele, como um extrato conta. Num jogo, pagar é um
acontecimento com lugar e direção: o crupiê empurra as fichas da casa vencedora até quem
ganhou. Era isso que o olho procurava e não achava.

`PagamentoNaMesa`: as fichas partem de onde a aposta estava — a casa vencedora no bacará,
a grade no caça-níqueis, a posição no stock market, o pano na roleta e no bac bo, o círculo
do jogador no blackjack, o pote no pôquer, a mesa no truco e no dominó — e sobem até o
saldo, no topo. Os dez jogos.

Na banca francesa de mesa o caminho é outro, porque a mesa é de várias pessoas e o estado
chega pelo socket: o gatilho é `lastRound.at`, a hora em que a rodada fechou — ela muda uma
vez por rodada e só quando a rodada fecha. Sem esse gatilho, qualquer atualização da mesa
(alguém sentando, um bot apostando) faria as fichas saírem de novo.

**E o valor vem do servidor, sempre.** Truco e dominó não publicavam quanto a partida tinha
pago: a tela PODERIA ter subtraído o saldo de antes do de agora, e é exatamente por isso
que o campo `retorno` passou a existir nos dois. Valor que o jogador vê sai do servidor,
nunca de uma conta feita no cliente — a mesma regra que já vale pra multiplicador,
resultado e prêmio. No pôquer o campo já existia: o que a mão paga é o stack que sobrou. O voo
não é reto: uma ficha empurrada na mesa sobe, cruza o feltro e assenta; reta é como se
copia um arquivo, não como anda uma ficha.

**A regra que não se quebra, e esta é a camada onde seria mais fácil quebrar sem ninguém
ver: a animação conta o que JÁ aconteceu.** O servidor resolve a rodada, credita o ledger e
devolve o saldo novo antes de qualquer ficha se mexer. Se o aparelho travar no meio do voo,
o dinheiro está lá do mesmo jeito. Nada ali decide, sorteia, arredonda ou "quase" paga.

Duas conferências guardam isso (`verify:apresentacao`), e as duas são sobre ordem:

1. o componente do voo **não calcula prêmio** — ele recebe o valor pago;
2. em toda tela que paga, `saldoChegouDeFora` vem **antes** de disparar o voo. Provado por
   mutação: trocando a ordem no caça-níqueis, a conferência reprova pelo nome da tela.

**E o voo tem retrato.** Uma animação de um segundo não aparece num retrato parado:
`npm run verify:pagamento-voando` gira até sair prêmio e fotografa DURANTE o voo
(`retratos-depois/caca-niqueis-pagamento.png`), depois confere que o céu limpa sozinho.

A primeira versão dessa conferência media 1,5 s depois do toque e via zero — não porque o
voo não acontecia, mas porque ele já tinha acabado. Uma coisa que dura um segundo não se
fotografa com uma amostra só: observa-se de 80 em 80 ms até aparecer.

## O que continua na fila

Pela ordem do diagnóstico, o que ainda não foi feito:

1. **Zonas no pano para blackjack e bac bo** — a técnica está pronta no bacará.
2. **Tirar a rolagem** das sete telas que ainda rolam na mesa (o orçamento está em
   `verify:apresentacao` e só pode cair). Nenhuma delas transborda hoje — são dívida
   potencial, não defeito visível.
3. ~~A cena contando o resultado na banca francesa online.~~ **Feito — e eu tinha errado
   o diagnóstico.** Escrevi que faltava um evento carregando o valor pago, e que isso era
   mudança de protocolo. Não era: `lastRound.bySeat[eu].totalReturn` já vinha na mesa, e
   `lastRound.at` já servia de marca de rodada. O que faltava era ler o que já estava lá.
   Os dez jogos pagam com a ficha voando.
4. **O que depende de renderer** — reel engine do caça-níqueis, roda da roleta com
   física, shakers do bac bo — continua esperando a medição em aparelho
   (`RENDERING_STRATEGY.md` §6). Nada disso é pré-requisito dos três itens acima.
