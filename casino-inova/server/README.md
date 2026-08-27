# Casino Inova — API (Fase 0, esqueleto)

Backend em NestJS + TypeScript. Nesta etapa, **tudo roda em memória** — reiniciar o
servidor apaga os dados. É o suficiente pra validar o formato dos endpoints e o
comportamento do ledger antes de conectar um banco de verdade.

## Rodando

```
cd server
npm install
npm run start:dev
```

API sobe em `http://localhost:3000`.

## Endpoints disponíveis

| Rota | O que faz |
|---|---|
| `GET /users/me` | Retorna o usuário mock (`u1`) — não existe login ainda. |
| `GET /wallet/:userId/saldo` | Soma todas as entradas do ledger daquele usuário. |
| `GET /wallet/:userId/historico` | Lista todas as entradas do ledger daquele usuário. |
| `GET /store/pacotes` | Lista os 4 pacotes de fichas (bronze/prata/ouro/diamante). |
| `POST /store/comprar` `{ userId, packageId }` | Credita as fichas do pacote na carteira — simula o que a RevenueCat faria depois de validar um recibo real. |
| `GET /games/slots/config` | Símbolos, aposta mín/máx e o **RTP teórico exato** (calculado por fórmula, não chutado — ver `slots.engine.ts`). |
| `POST /games/slots/girar` `{ userId, bet }` | Debita a aposta, sorteia a grade 3x3 no servidor, credita o prêmio se houver e devolve o resultado. |
| `GET /games/roleta/config` | Números vermelhos, aposta mín/máx, multiplicador por tipo de aposta e o RTP (36/37 ≈ 97,30%, fixo por regra matemática da roleta europeia). |
| `POST /games/roleta/girar` `{ userId, bet: { type, number? }, amount }` | Debita a aposta, sorteia a casa (0-36) no servidor, credita o retorno se houver. `bet.type` é um de: `numero` (com `number` de 0 a 36), `vermelho`, `preto`, `par`, `impar`, `baixo`, `alto`, `duzia1`, `duzia2`, `duzia3`. |
| `GET /games/blackjack/config` | Aposta mín/máx, multiplicador de blackjack natural (2,5x = "paga 3 para 2") e a regra do dealer (para em 17). |
| `POST /games/blackjack/apostar` `{ userId, bet }` | Debita a aposta e distribui 2 cartas pra cada lado. Se sair blackjack natural (do jogador ou do dealer), a mão já termina aqui. |
| `POST /games/blackjack/pedir-carta` `{ userId }` | Compra mais uma carta pro jogador. Estoura 21 → mão termina, dealer perde a vez de jogar. |
| `POST /games/blackjack/parar` `{ userId }` | Jogador para, dealer compra até 17, resultado é decidido e o prêmio (se houver) é creditado. |
| `GET /games/bacara/config` | Aposta mín/máx. |
| `POST /games/bacara/apostar` `{ userId, betType, amount }` | Roda a mão inteira numa chamada só (bacará não tem decisão do jogador) e credita se houver prêmio. `betType` é `jogador`, `banca` ou `empate`. Empate com aposta em jogador/banca devolve a ficha (nem ganha nem perde). |
| `GET /games/banca-francesa/config` | Aposta mín/máx, os 4 tipos de aposta (`ases`, `pequeno`, `grande`, `linha`), as somas que cada um cobre e o RTP de cada um (todos ≈ 98,41% = 62/63 — é o jogo tradicional português "Grande e Pequena", não o Chuck-a-Luck). |
| `POST /games/banca-francesa/apostar` `{ userId, bets: [{ type, amount }] }` | Lança 3 dados até sair um resultado decisivo (soma 3, 5-7 ou 14-16 — qualquer outra soma é nula e os dados são relançados automaticamente) e resolve cada aposta contra esse resultado. `type` é `ases` (soma 3, paga 61 pra 1), `pequeno` (soma 5-6-7, paga 1 pra 1), `grande` (soma 14-15-16, paga 1 pra 1) ou `linha` (meia aposta em cada lado — só perde tudo se sair ases). |
| `GET /admin/papeis/permissoes` | A matriz de permissões inteira — o que cada papel pode fazer. |
| `GET /admin/usuarios?actingUserId=` | Lista todo mundo com o papel atual — exige `gerenciar_papeis`. |
| `POST /admin/papeis/atribuir` `{ actingUserId, targetUserId, role }` | Promove/rebaixa entre `jogador` e `moderador` — exige `gerenciar_papeis`. Nunca promove a `admin` por aqui (ver seção de papéis abaixo). |
| `POST /admin/suporte/conceder-fichas` `{ actingUserId, targetUserId, chips, reason? }` | Credita fichas de suporte na carteira de alguém — exige `conceder_fichas_suporte`. Moderador tem teto de 5.000 fichas por ação, admin não tem teto. |
| `POST /admin/cupons` `{ actingUserId, code, chips, maxRedemptions }` | Cria um cupom — exige `gerenciar_cupons` (só admin, por padrão). |
| `GET /admin/cupons?actingUserId=` | Lista cupons com quantos resgates cada um já teve — exige `gerenciar_cupons`. |
| `POST /admin/cupons/:code/desativar` `{ actingUserId }` | Desativa um cupom sem apagar o histórico de quem já resgatou. |
| `POST /cupons/resgatar` `{ userId, code }` | Qualquer jogador resgata um cupom ativo — uma vez por pessoa, até o limite de resgates do cupom. Sem permissão nenhuma exigida, é uma ação de jogador normal. |
| `GET /games/truco/config` | Buy-in mín/máx, as duas variantes com a regra de cada uma (`variants`), as manilhas fixas do mineiro, os estilos (`sujo`/`limpo`) e a lista dos 9 sinais. |
| `POST /games/truco/nova-partida` `{ userId, buyIn, variant?, style? }` | Debita o buy-in e começa uma partida nova contra o bot (placar 0 a 0), já distribuindo a primeira mão. `variant` é `paulista` (padrão) ou `mineiro`; `style` é `sujo` (padrão) ou `limpo`. |
| `POST /games/truco/jogar-carta` `{ userId, card: { rank, suit } }` | Joga uma carta da sua mão; o bot responde na hora. Resolve a rodada e, se a mão terminar, já reparte a próxima automaticamente (ou fecha a partida, se alguém chegou a 12). |
| `POST /games/truco/pedir-truco` `{ userId }` | Sobe a mão pro próximo degrau da escada da variante. Quem acabou de pedir não pode pedir de novo — a vez de subir é de quem respondeu. O bot decide aceitar, correr ou aumentar na hora. |
| `POST /games/truco/responder-truco` `{ userId, response }` | Responde ao pedido do bot: `aceitar`, `correr` ou `aumentar` (que sobe mais um degrau e devolve o pedido). |
| `POST /games/truco/sinal` `{ userId, signalId }` | Faz a careta pro parceiro. Só existe no estilo `sujo`; no `limpo` o servidor recusa. Contra bot é só o gesto — em mesa 2x2 ele vai pro socket do parceiro. |

### Variantes de truco

Escolhidas por partida, não por mesa global — a mesma pessoa pode jogar paulista agora e mineiro depois.

| | Paulista | Mineiro |
|---|---|---|
| Manilha | Sai da **vira**: a carta virada define qual é a manilha daquela mão | **Fixa**: 4♣ (zap), 7♥ (copeta), A♠ (espadilha), 7♦ (mole) — não tem vira |
| Mão começa valendo | 1 ponto | 2 pontos |
| Escada de aumento | 1 → 3 → 6 → 9 → 12 | 2 → 4 → 6 → 10 → 12 |
| Partida | 12 pontos | 12 pontos |

A escada do mineiro é a ambiguidade conhecida deste projeto: as fontes divergem entre `2 → 4 → 6 → 10 → 12` e `2 → 4 → 6 → 12`. Adotamos a primeira, e o comentário em `truco.config.ts` marca isso como decisão a confirmar com quem joga na região.

**Sujo x limpo** é sobre sinal, não sobre manilha: no `sujo` combinar por careta com o parceiro é parte do jogo; no `limpo` é proibido, e o endpoint de sinal recusa.

| `GET /games/bac-bo/config` | Aposta mín/máx, a tabela de pagamento do empate por total (2 e 12 pagam 88 pra 1; 7 paga 4 pra 1) e o RTP de cada aposta. |
| `GET /games/bac-bo/placar` | O placar de histórico (as cinco estradas do bacará) montado em cima dos resultados de bac bo. |
| `POST /games/bac-bo/apostar` `{ userId, bets: [{ type, amount }] }` | Rola os 4 dados (2 pro jogador, 2 pra banca), soma cada lado e resolve. `type` é `jogador`, `banca` ou `empate`. No empate, quem apostou em jogador/banca leva 90% de volta — é dessa regra que sai toda a vantagem da casa (1,13%). |
| `GET /games/stock-market/config` | Aposta mín/máx, o teto de movimento (±100%) e a comissão de 1% — a única vantagem da casa neste jogo. |
| `GET /games/stock-market/historico` | Os últimos fechamentos, pro gráfico e pros contadores de alta/baixa. |
| `POST /games/stock-market/apostar` `{ userId, direction, amount }` | `direction` é `alta` ou `baixa`. A cotação anda 30 passos e fecha entre -100% e +100%; você recebe exatamente a porcentagem que acertou, menos a comissão. |
| `GET /games/bacara/placar` `GET /games/banca-francesa/placar` | Mesmo placar de cinco estradas do bac bo, pro jogo correspondente. |
| `GET /games/roleta/historico` | Histórico da roleta — números que saíram e os contadores de vermelho/preto, par/ímpar, baixo/alto. Roleta **não** usa as estradas do bacará: mesa de roleta de verdade mostra outra coisa. |

| `GET /games/domino/config` | Buy-in mín/máx e o tamanho da mão (7 peças). |
| `POST /games/domino/nova-partida` `{ userId, buyIn }` | Debita o buy-in, distribui 7 peças pra cada lado (dominó "block" clássico, sem comprar do monte). |
| `POST /games/domino/jogar-peca` `{ userId, tile: { a, b }, end? }` | Joga uma peça — `end` (`"esquerda"` ou `"direita"`) só é obrigatório depois da primeira peça da mesa. O bot joga (ou passa) na sequência, na mesma resposta. |
| `POST /games/domino/passar` `{ userId }` | Passa a vez — só funciona se você realmente não tiver peça jogável em nenhuma ponta. |

Termina quando alguém fica sem peças (bate) ou quando os dois passam seguido (travou) — nesse caso quem tiver menos pontos na mão vence; empate devolve o buy-in.

| `GET /games/poker/config` | Buy-in mín/máx, cegas (10/20) e os dois tamanhos de aposta fixos (20 pré-flop/flop, 40 turn/river). |
| `POST /games/poker/nova-mao` `{ userId, buyIn }` | Debita o buy-in (vira seu stack da mão), posta as cegas, distribui 2 cartas pra cada lado. Você é sempre o botão — age primeiro no pré-flop. |
| `POST /games/poker/agir` `{ userId, action }` | `action` é `desistir`, `passar`, `pagar` ou `aumentar` — só as legais pro momento (a resposta sempre traz `legalActions`). O bot age sozinho na sequência, inclusive levando o jogo até a rua seguinte quando a rodada de apostas fecha. |

Poker aqui é **heads-up limit hold'em** (você contra o bot, 1 mão de cada vez, aposta de tamanho fixo por rua ao invés de qualquer valor) — é uma variante de poker real e nomeada, não uma invenção; simplifica a interface sem descaracterizar o jogo. Sem side pots (heads-up só tem 2 jogadores). `npm run verify:poker-hands` confere o avaliador de mão (quem vence flush vs. full house, sequência do bebê A-2-3-4-5, empates) contra casos conhecidos.

| `GET /amigos?userId=` | Lista de amigos (pedidos aceitos) de alguém. |
| `GET /amigos/pendentes?userId=` | Pedidos pendentes recebidos e enviados. |
| `POST /amigos/pedir` `{ userId, targetUserId }` | Manda pedido de amizade. |
| `POST /amigos/:requestId/responder` `{ userId, accept }` | Aceita ou recusa um pedido recebido — `accept:false` remove o pedido. |

Amigos é pré-requisito pro convite de sala por "+" — sem saber quem é amigo de quem, não dá pra mostrar "convidar amigo" em lugar nenhum.

| `GET /torneios` | Os três torneios com a janela aberta agora (início e fim), os jogos que contam, o mínimo de rodadas e a tabela de prêmios. |
| `GET /torneios/:id/ranking?userId=` | O ranking da janela aberta, a linha de quem pediu (mesmo fora das 20 primeiras posições) e quantas rodadas faltam pra ele se classificar. |

## Torneios

Três torneios rodando sempre: **Corrida do Dia** (todos os jogos, zera à meia-noite), **Semana das Mesas** (só truco, dominó, poker e banca francesa) e **Grande Prêmio do Mês**.

### Como se ganha ponto — e por que é assim

Esta é a decisão de projeto mais importante do módulo. O caminho fácil seria pontuar pelo volume apostado, ou pelo saldo líquido em fichas. Os dois premiam quem aposta alto: no saldo líquido, quem aposta 5.000 por rodada oscila cem vezes mais que quem aposta 50, e o topo de um ranking é justamente a ponta de cima dessa oscilação. O ranking viraria uma lista de quem gastou mais, disfarçada de lista de quem jogou melhor.

Aqui a pontuação é **proporcional ao que voltou**, não ao tamanho da ficha:

```
pontos da rodada = (retorno − aposta) / aposta × 100
```

Dobrar a aposta vale +100 pontos, apostando 10 fichas ou 10.000. Perder tudo vale −100. Empate que devolve a ficha vale 0. Acertar os ases da banca francesa (62x) vale +6.100. A regra aparece escrita na própria tela de torneios do app, do mesmo jeito que o RTP aparece na tela de cada jogo.

Cada torneio exige um **mínimo de rodadas** pra entrar no ranking — sem isso, quem acertasse um 62x na primeira aposta e parasse de jogar seria imbatível. Empate em pontos desempata por quem jogou **menos** rodadas: chegar aos mesmos pontos em menos mãos é melhor resultado.

### Como as janelas e o pagamento funcionam

A janela nunca é guardada, é sempre calculada a partir do relógio (dia = meia-noite a meia-noite, semana = segunda a segunda, mês = dia 1 ao dia 1, tudo em UTC por enquanto). Assim ela nunca fica desalinhada e não precisa de ninguém rodando um cron pra virar o dia.

O pagamento é **preguiçoso e idempotente**: qualquer leitura de torneio confere se a janela anterior fechou sem ter sido paga e, se for o caso, credita os prêmios ali mesmo. A janela paga fica marcada e nunca é paga de novo — `npm run verify:torneios` prova isso lendo o ranking quatro vezes seguidas e conferindo que o saldo só subiu uma. Quando existir persistência de verdade, isso vira tarefa agendada; a regra de quem ganha o quê continua a mesma.

### Onde a rodada é contada

O torneio guarda a estatística esportiva (o que foi apostado e o que voltou); **quem manda em ficha continua sendo só o ledger da carteira**. Nenhum ponto de torneio move saldo, e todo prêmio de torneio é creditado pelo ledger como qualquer outro crédito — com o id do torneio no campo `origin`, pra pessoa conseguir olhar o extrato e entender de onde vieram aquelas fichas.

Esse mesmo campo `origin` passou a marcar toda aposta e todo prêmio com o id do jogo, o que deixa o extrato legível: "Aposta — Truco" em vez de só "Aposta".

## Mesa multiplayer (WebSocket)

São **dois formatos de mesa**, tecnicamente bem diferentes, e vale entender a diferença antes de mexer no gateway:

**Mesa compartilhada** (banca francesa): até 15 jogadores, cada um com uma cor de ficha (`src/modules/rooms/player-colors.ts`), igual cassino físico. Ninguém joga contra o outro — todo mundo aposta contra o mesmo resultado de dado. Como não existe informação escondida, o mesmo payload vai pra sala inteira de uma vez.

**Mesa 2x2** (truco e dominó): quatro jogadores, dois times. Aqui **não dá** pra transmitir o mesmo payload pra todo mundo, porque cada um só pode ver a própria mão. O gateway monta uma visão por jogador (`viewFor`) e emite socket a socket; dos outros vai só a contagem de cartas/peças. Assentos 0 e 2 são a dupla A, 1 e 3 a dupla B — o parceiro é sempre quem está de frente.

`npm run start:dev` já sobe o WebSocket na mesma porta 3000, sem configuração extra.

Eventos (cliente → servidor), todos aceitam callback de confirmação e todos (exceto `mesas-publicas`) também transmitem `banca-francesa:mesa-atualizada` pra sala inteira:

| Evento | Payload | O que faz |
|---|---|---|
| `identificar` | `{ userId }` | Associa esse socket a um usuário — manda assim que conectar, antes de mais nada (é o que permite mandar convite direto pra alguém online). |
| `banca-francesa:criar-mesa` | `{ userId, visibility: "publica"\|"privada" }` | Cria a mesa, te senta nela, gera um código de 6 caracteres. |
| `banca-francesa:mesas-publicas` | — | Lista mesas públicas com vaga. |
| `banca-francesa:entrar-por-codigo` | `{ userId, code }` | Senta na mesa daquele código, se tiver vaga. |
| `banca-francesa:entrar-por-id` | `{ userId, tableId }` | Igual, mas por ID (pra entrar direto de uma mesa pública listada). |
| `banca-francesa:convidar-amigo` | `{ userId, tableId, friendUserId }` | Só funciona se `friendUserId` já for seu amigo de verdade (checa contra o módulo `amigos`). Se a pessoa estiver com socket conectado, ela recebe `banca-francesa:convite-recebido` na hora. |
| `banca-francesa:completar-com-bot` | `{ userId, tableId }` | Só o anfitrião — senta um bot numa vaga livre. |
| `banca-francesa:apostar` | `{ userId, tableId, bets: [{ type, amount }] }` | Registra sua aposta da rodada (fica pendente até o anfitrião girar). `type` é `ases`\|`pequeno`\|`grande`\|`linha`. Recusa na hora se você não tiver ficha suficiente. |
| `banca-francesa:girar` | `{ userId, tableId }` | Só o anfitrião — lança os dados (relançando sozinho até sair um resultado decisivo) e resolve a aposta de todo mundo sentado contra o mesmo resultado. |
| `banca-francesa:sair` | `{ userId, tableId }` | Sai da mesa. Se for o anfitrião, o próximo assento humano vira anfitrião; se não sobrar ninguém, a mesa fecha (`banca-francesa:mesa-fechada` avisa quem ficou). |

Bot nunca mexe em carteira de verdade — só o lado do jogador real (real ou o amigo convidado) debita/credita fichas de verdade, igual no resto do projeto.

### Truco 2x2 e dominó 2x2

Mesmo desenho da banca francesa pra criar/entrar (mesa pública ou código de 6 caracteres, convite por amigo, bot completando vaga), com os eventos próprios de cada jogo. Todos devolvem a visão de quem chamou no ack e emitem `truco:mesa-atualizada` / `domino:mesa-atualizada` pra cada jogador, um por um.

| Evento | Payload | O que faz |
|---|---|---|
| `truco:criar-mesa` | `{ userId, visibility, variant?, style?, buyIn }` | Cria a mesa já com a variante e o estilo escolhidos. |
| `truco:mesas-publicas` | — | Lista mesas públicas com vaga. |
| `truco:entrar-por-codigo` / `truco:entrar-por-id` | `{ userId, code }` / `{ userId, tableId }` | Senta na próxima vaga — o assento define de quem você é parceiro. |
| `truco:completar-com-bot` | `{ userId, tableId }` | Só o anfitrião — senta um bot numa vaga livre. |
| `truco:comecar` | `{ userId, tableId }` | Só o anfitrião, com os 4 assentos ocupados — distribui a primeira mão. |
| `truco:jogar-carta` | `{ userId, tableId, card }` | Joga a carta, resolve a rodada e reparte a mão seguinte quando fecha. |
| `truco:pedir` | `{ userId, tableId }` | Sobe a mão um degrau. A dupla que acabou de pedir não pode pedir de novo. |
| `truco:responder` | `{ userId, tableId, response }` | `aceitar`, `correr` ou `aumentar`. |
| `truco:sinal` | `{ userId, tableId, signalId }` | A careta. Vai **só** pro socket do parceiro (`truco:sinal-recebido`) — se fosse pra sala, os adversários veriam e o sinal perderia o sentido. |
| `truco:sair` | `{ userId, tableId }` | Sai; sem ninguém, a mesa fecha (`truco:mesa-fechada`). |
| `domino:criar-mesa` | `{ userId, visibility, buyIn }` | Cria a mesa 2x2. |
| `domino:mesas-publicas` / `domino:entrar-por-codigo` / `domino:entrar-por-id` / `domino:completar-com-bot` / `domino:comecar` / `domino:sair` | igual ao truco | Mesmo fluxo de sala. |
| `domino:jogar-peca` | `{ userId, tableId, tile, end? }` | `end` (`esquerda`/`direita`) só é obrigatório depois da primeira peça. |
| `domino:passar` | `{ userId, tableId }` | Só funciona se você realmente não tiver peça jogável. |

Pontuação do dominó em dupla, do jeito que se joga no Brasil: batida simples 1 ponto, carroça (bater com dupla) 2, lá-e-lô (fechar as duas pontas) 3, cruzada (as duas coisas) 4. Vence a dupla que chegar a 6 pontos.

### Chat

O mesmo chat serve todas as mesas, com dois escopos.

| Evento | Payload | O que faz |
|---|---|---|
| `chat:enviar` | `{ userId, roomId, scope?, text }` | `scope` é `mesa` (padrão, vai pra sala inteira) ou `dupla` (vai só pro seu parceiro, socket a socket). Máximo 200 caracteres, no máximo 5 mensagens a cada 5 segundos. |
| `chat:historico` | `{ userId, roomId }` | As últimas 50 mensagens que **você** pode ler. Quem é seu parceiro é o servidor que decide, olhando o assento — se viesse do cliente, bastava mandar o userId de um adversário pra ler a conversa da outra dupla. |
| `chat:silenciar` | `{ actingUserId, targetUserId, seconds }` | Exige a permissão `silenciar_usuario` (moderador ou admin). Quem foi silenciado recebe `chat:silenciado`. |
| `chat:remover-silencio` | `{ actingUserId, targetUserId }` | Tira o silêncio. |

Escopo `dupla` em mesa que não é 2x2 é recusado na hora — melhor recusar do que guardar uma mensagem que ninguém leria.

**Poker ainda é só contra bot.** É o único que sobrou: multiplayer de verdade nele exige mesa de 2 a 9 lugares com side pot, que é bem mais trabalho que o 2x2 de assento fixo do truco e do dominó.

### Papéis e permissões

Não são só dois blocos fixos de poder — cada ação administrativa é uma permissão isolada (`server/src/modules/roles/roles.constants.ts`), e um papel é só um conjunto dessas permissões. Isso deixa fácil criar um terceiro papel no futuro (ex: "moderador sênior") sem tocar em nenhuma rota.

| Permissão | Jogador | Moderador | Admin |
|---|:---:|:---:|:---:|
| `silenciar_usuario` — silenciar em chat |  | ✓ | ✓ |
| `ver_denuncias` — ver denúncias reportadas |  | ✓ | ✓ |
| `ver_carteira_usuario` — ver saldo/histórico de alguém (investigar um caso de suporte) |  | ✓ | ✓ |
| `conceder_fichas_suporte` — dar fichas de compensação (moderador até 5.000/ação, admin sem teto) |  | ✓ | ✓ |
| `banir_usuario` — banir permanentemente |  |  | ✓ |
| `gerenciar_cupons` — criar/listar/desativar cupom |  |  | ✓ |
| `gerenciar_papeis` — promover/rebaixar entre jogador e moderador |  |  | ✓ |
| `ajustar_economia` — mexer em RTP, preço de pacote, curva de nível |  |  | ✓ |
| `ver_analytics` — dashboards |  | ✓ | ✓ |

`u1` (o "usuário logado" nesta v1) já nasce `admin`. `u2`, `u3` e `u4` nascem `jogador` — `u2` pra ter alguém pra promover, e os outros dois pra dar pra encher uma mesa 2x2 sem bot no teste:

```
curl -X POST http://localhost:3000/admin/papeis/atribuir -H "Content-Type: application/json" -d '{"actingUserId":"u1","targetUserId":"u2","role":"moderador"}'
curl "http://localhost:3000/admin/usuarios?actingUserId=u1"
```

Promover alguém a `admin` **não existe como rota** — de propósito, pra um moderador nunca conseguir se auto-promover nem promover outra pessoa a admin mesmo que a conta dele seja comprometida. Isso se faz direto na base de dados.

**Sobre o painel de admin:** as rotas acima são a base de um backoffice, mas o backoffice em si não deveria virar uma tela dentro do app do jogador — é assim que apps de cassino social de verdade fazem (Zynga, Playtika etc.): o app que vai pra loja não carrega nenhum código de gestão de usuário dentro do binário público, porque isso é superfície de ataque de graça pra quem decompilar o app. O caminho normal é uma ferramenta interna separada (um painel web, por exemplo) que só fala com essas rotas `/admin/*` — ainda não construída aqui.

Blackjack é sequencial — `apostar` sempre primeiro, depois qualquer número de `pedir-carta`, terminando em `parar` (ou automaticamente, se estourar ou sair um natural). Só existe uma mão em andamento por usuário por vez.

Teste rápido de ponta a ponta:

```
curl http://localhost:3000/wallet/u1/saldo
curl -X POST http://localhost:3000/store/comprar -H "Content-Type: application/json" -d '{"userId":"u1","packageId":"ouro"}'
curl http://localhost:3000/wallet/u1/saldo
```

O saldo depois da compra deve estar 40.000 fichas maior.

```
curl -X POST http://localhost:3000/games/slots/girar -H "Content-Type: application/json" -d '{"userId":"u1","bet":100}'
curl -X POST http://localhost:3000/games/roleta/girar -H "Content-Type: application/json" -d '{"userId":"u1","bet":{"type":"vermelho"},"amount":100}'
curl -X POST http://localhost:3000/games/blackjack/apostar -H "Content-Type: application/json" -d '{"userId":"u1","bet":100}'
curl -X POST http://localhost:3000/games/blackjack/pedir-carta -H "Content-Type: application/json" -d '{"userId":"u1"}'
curl -X POST http://localhost:3000/games/blackjack/parar -H "Content-Type: application/json" -d '{"userId":"u1"}'
curl -X POST http://localhost:3000/games/bacara/apostar -H "Content-Type: application/json" -d '{"userId":"u1","betType":"banca","amount":100}'
curl -X POST http://localhost:3000/games/banca-francesa/apostar -H "Content-Type: application/json" -d '{"userId":"u1","bets":[{"type":"pequeno","amount":100}]}'
curl -X POST http://localhost:3000/admin/cupons -H "Content-Type: application/json" -d '{"actingUserId":"u1","code":"BEMVINDO500","chips":500,"maxRedemptions":1000}'
curl -X POST http://localhost:3000/cupons/resgatar -H "Content-Type: application/json" -d '{"userId":"u1","code":"bemvindo500"}'
curl -X POST http://localhost:3000/games/truco/nova-partida -H "Content-Type: application/json" -d '{"userId":"u1","buyIn":200}'
curl -X POST http://localhost:3000/games/domino/nova-partida -H "Content-Type: application/json" -d '{"userId":"u1","buyIn":200}'
curl -X POST http://localhost:3000/games/poker/nova-mao -H "Content-Type: application/json" -d '{"userId":"u1","buyIn":1000}'
curl -X POST http://localhost:3000/games/bac-bo/apostar -H "Content-Type: application/json" -d '{"userId":"u1","bets":[{"type":"jogador","amount":100}]}'
curl -X POST http://localhost:3000/games/stock-market/apostar -H "Content-Type: application/json" -d '{"userId":"u1","direction":"alta","amount":100}'
curl http://localhost:3000/games/bacara/placar
curl http://localhost:3000/games/roleta/historico
```

## Verificação

Cada jogo tem um roteiro que **roda de verdade** e confere a matemática — não é comentário no código dizendo qual é o RTP, é o número saindo do próprio motor. `npm run verify:tudo` roda os oito de uma vez:

| Comando | O que confere |
|---|---|
| `npm run verify:rtp` | Slots: fórmula exata do RTP batendo com 500 mil giros simulados. |
| `npm run verify:banca-francesa` | Banca francesa: RTP condicionado às 63 combinações decisivas de 216 — as quatro apostas dão 98,413%. |
| `npm run verify:bac-bo` | Bac bo: três caminhos independentes (fórmula, enumeração das 1296 combinações e 1 milhão de rodadas) batendo com a referência pública. |
| `npm run verify:stock-market` | Stock market: prova a identidade `alta + baixa = 2` pra todo fechamento, o que fixa o RTP em 99% (a comissão) **independente** de como a cotação se move — testado inclusive com uma distribuição enviesada de propósito. |
| `npm run verify:bacara` | Bacará: RTP de jogador, banca e empate por simulação de 1 milhão de rodadas. |
| `npm run verify:blackjack` | Blackjack: simula uma estratégia simples só como referência de sanidade. |
| `npm run verify:poker-hands` | Poker: o avaliador de mão contra casos conhecidos (flush vs. full house, sequência do bebê A-2-3-4-5, empates). |
| `npm run verify:placar` | Placar de histórico: 14 casos montados à mão pras cinco estradas do bacará (empate virando contador, cauda do dragão, quando cada estrada derivada começa). |
| `npm run verify:torneios` | Torneios: 24 casos — a pontuação proporcional (aposta de 50 e de 10.000 dando o mesmo ponto), o mínimo de rodadas barrando uma sorte grande isolada, o filtro por jogo, o desempate, as janelas de dia/semana/mês (inclusive domingo e virada de ano) e o prêmio pago uma vez só. |

Blackjack não tem RTP fixo — depende da estratégia de quem joga. `npm run verify:blackjack` simula uma estratégia simples (pedir carta até 17) só como referência de que o jogo não está nem generoso nem apertado demais; com estratégia básica ótima de verdade, essas regras (dealer para em todos os 17, blackjack paga 3:2, baralho infinito) ficam perto de ~99,5%.

Bacará não tem decisão de jogador nenhuma, então o RTP de cada aposta é mesmo um número fixo — só complexo demais pra fórmula fechada por causa da tabela de compra da 3ª carta. `npm run verify:bacara` mede por simulação (1 milhão de rodadas) o RTP de jogador, banca e empate.

## O que falta para isto ser a Fase 0 de verdade

Nesta ordem:

1. **Persistência real** — trocar os arrays em memória por PostgreSQL (as tabelas já estão desenhadas no plano de produto: `users`, `ledger_entries`, `purchases`).
2. **Autenticação** — Firebase Auth com Google, Facebook, Apple e e-mail/senha; `GET /users/me` passa a ler o usuário do token, não um valor fixo.
3. **Compra real** — integrar RevenueCat: o app faz a compra na App Store/Play Store, a RevenueCat valida o recibo e chama um webhook aqui, que só então chama `walletService.credit(...)`. O endpoint `POST /store/comprar` atual serve pra testar o resto do fluxo enquanto isso não existe — ele não deve ir para produção como está, porque hoje qualquer um pode chamá-lo e "comprar" fichas de graça.
4. **Poker multiplayer** — o único jogo de mesa que continua só contra bot.

O módulo de **amigos** já existe e funciona (pedir/aceitar/recusar/listar); o que falta nele é só a persistência do item 1, junto com todo o resto.
