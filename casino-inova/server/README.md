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
| `GET /games/banca-francesa/config` | Aposta mín/máx, quantos números dá pra apostar na mesma rodada, multiplicador por quantidade de dados que bateram e o RTP (199/216 ≈ 92,13%, o mesmo do "Chuck-a-Luck" internacional). |
| `POST /games/banca-francesa/apostar` `{ userId, bets: [{ number, amount }] }` | Rola 3 dados pra toda a mesa numa tacada só e resolve cada número apostado contra o mesmo resultado — pode apostar em vários números na mesma rodada. |
| `GET /admin/papeis/permissoes` | A matriz de permissões inteira — o que cada papel pode fazer. |
| `GET /admin/usuarios?actingUserId=` | Lista todo mundo com o papel atual — exige `gerenciar_papeis`. |
| `POST /admin/papeis/atribuir` `{ actingUserId, targetUserId, role }` | Promove/rebaixa entre `jogador` e `moderador` — exige `gerenciar_papeis`. Nunca promove a `admin` por aqui (ver seção de papéis abaixo). |
| `POST /admin/suporte/conceder-fichas` `{ actingUserId, targetUserId, chips, reason? }` | Credita fichas de suporte na carteira de alguém — exige `conceder_fichas_suporte`. Moderador tem teto de 5.000 fichas por ação, admin não tem teto. |
| `POST /admin/cupons` `{ actingUserId, code, chips, maxRedemptions }` | Cria um cupom — exige `gerenciar_cupons` (só admin, por padrão). |
| `GET /admin/cupons?actingUserId=` | Lista cupons com quantos resgates cada um já teve — exige `gerenciar_cupons`. |
| `POST /admin/cupons/:code/desativar` `{ actingUserId }` | Desativa um cupom sem apagar o histórico de quem já resgatou. |
| `POST /cupons/resgatar` `{ userId, code }` | Qualquer jogador resgata um cupom ativo — uma vez por pessoa, até o limite de resgates do cupom. Sem permissão nenhuma exigida, é uma ação de jogador normal. |
| `GET /games/truco/config` | Buy-in mín/máx, pontos pra vencer a partida (12) e o valor da mão depois de pedir truco (3). |
| `POST /games/truco/nova-partida` `{ userId, buyIn }` | Debita o buy-in e começa uma partida nova contra o bot (placar 0 a 0), já distribuindo a primeira mão. |
| `POST /games/truco/jogar-carta` `{ userId, card: { rank, suit } }` | Joga uma carta da sua mão; o bot responde na hora. Resolve a rodada e, se a mão terminar, já reparte a próxima automaticamente (ou fecha a partida, se alguém chegou a 12). |
| `POST /games/truco/pedir-truco` `{ userId }` | Pede truco (só uma vez por mão, sem escalar pra 6/9/12 nesta versão). O bot decide aceitar ou correr na hora. |
| `POST /games/truco/responder-truco` `{ userId, accept }` | Responde quando é o bot que pede truco (`pendingTruco: "bot"` na resposta de `jogar-carta` avisa que isso está esperando). |

Truco é **contra bot, não multiplayer de verdade ainda** — truco/dominó/pôquer com outros jogadores de verdade exigem sala + WebSocket (o plano de produto aponta Colyseus), que não existe neste esqueleto. As regras (manilha, força de carta, desempate de mão) são reais; o "adversário" por enquanto é sempre a máquina.

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

`u1` (o "usuário logado" nesta v1) já nasce `admin`. `u2` nasce `jogador`, só pra ter alguém pra promover:

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
curl -X POST http://localhost:3000/games/banca-francesa/apostar -H "Content-Type: application/json" -d '{"userId":"u1","bets":[{"number":4,"amount":100}]}'
curl -X POST http://localhost:3000/admin/cupons -H "Content-Type: application/json" -d '{"actingUserId":"u1","code":"BEMVINDO500","chips":500,"maxRedemptions":1000}'
curl -X POST http://localhost:3000/cupons/resgatar -H "Content-Type: application/json" -d '{"userId":"u1","code":"bemvindo500"}'
curl -X POST http://localhost:3000/games/truco/nova-partida -H "Content-Type: application/json" -d '{"userId":"u1","buyIn":200}'
```

Para conferir que o RTP configurado em `slots.config.ts` é realmente o que o motor entrega (fórmula exata batendo com simulação de 500 mil giros):

```
npm run verify:rtp
```

Blackjack não tem RTP fixo — depende da estratégia de quem joga. `npm run verify:blackjack` simula uma estratégia simples (pedir carta até 17) só como referência de que o jogo não está nem generoso nem apertado demais; com estratégia básica ótima de verdade, essas regras (dealer para em todos os 17, blackjack paga 3:2, baralho infinito) ficam perto de ~99,5%.

Bacará não tem decisão de jogador nenhuma, então o RTP de cada aposta é mesmo um número fixo — só complexo demais pra fórmula fechada por causa da tabela de compra da 3ª carta. `npm run verify:bacara` mede por simulação (1 milhão de rodadas) o RTP de jogador, banca e empate.

## O que falta para isto ser a Fase 0 de verdade

Nesta ordem:

1. **Persistência real** — trocar os arrays em memória por PostgreSQL (as tabelas já estão desenhadas no plano de produto: `users`, `ledger_entries`, `purchases`).
2. **Autenticação** — Firebase Auth com Google, Facebook, Apple e e-mail/senha; `GET /users/me` passa a ler o usuário do token, não um valor fixo.
3. **Compra real** — integrar RevenueCat: o app faz a compra na App Store/Play Store, a RevenueCat valida o recibo e chama um webhook aqui, que só então chama `walletService.credit(...)`. O endpoint `POST /store/comprar` atual serve pra testar o resto do fluxo enquanto isso não existe — ele não deve ir para produção como está, porque hoje qualquer um pode chamá-lo e "comprar" fichas de graça.
4. **Amigos** — tabela `friendships` e endpoints de convite/aceite.
5. **Torneios e ranking** — tabelas `tournaments`, `tournament_entries`, `leaderboards` do plano de produto.
