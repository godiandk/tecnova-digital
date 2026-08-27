# Casino Inova

Cassino social mobile — fichas compradas com dinheiro real, sem saque, torneios diários/semanais/mensais com ranking e prêmios virtuais. Ver o plano completo de produto e arquitetura publicado como artefato na conversa (economia, sistemas, roadmap de 4 fases).

Este é um **projeto novo e separado** do site institucional da tecnova-digital — vive na pasta `casino-inova/` só por conveniência de repositório, sem nenhuma dependência do código do site.

## O princípio que rege o projeto inteiro

**Nenhum jogo é viciado.** Todo jogo tem RTP real, calculado, verificável e divulgado dentro do próprio app — a pessoa vê o número antes de apostar. Cada motor de jogo tem um roteiro de verificação que roda de verdade (`npm run verify:tudo` no servidor) e prova que o RTP que o app mostra é o que o motor entrega, por fórmula fechada, por enumeração exaustiva ou por simulação de centenas de milhares de rodadas — normalmente pelos três.

Isso vale também pro placar de histórico: ele existe porque mesa de verdade tem, e porque a pessoa gosta de acompanhar. Mas cada painel diz, escrito, que **o histórico não muda a chance da próxima rodada**. A casa ganha pela margem divulgada e por mais nada.

## Os 10 jogos

Todos jogáveis de verdade contra a API — apostam, debitam e creditam fichas de verdade, e mostram o RTP ou a regra de aposta divulgada.

| Jogo | Formato | Margem da casa | Como está |
|---|---|---|---|
| Caça-Níqueis | contra a casa | RTP 88,89% (fórmula exata) | pronto |
| Roleta europeia | contra a casa | RTP 97,30% (36/37, fixo por regra) | pronto, com histórico de números |
| Blackjack | contra a casa | depende da estratégia (~99,5% com estratégia básica) | pronto |
| Bacará | contra a casa | jogador 98,76% / banca 98,94% / empate 85,7% | pronto, com as cinco estradas |
| Bac Bo | contra a casa | jogador e banca 98,87% / empate 95,52% | pronto, com as cinco estradas |
| Stock Market | contra a casa | 99% — só a comissão de 1% | pronto, com gráfico e histórico |
| Banca Francesa | mesa compartilhada até 15 | 98,413% nas quatro apostas | pronto, single e mesa online |
| Truco | mesa 2x2 | sem margem (jogo entre jogadores) | pronto: 1x1 contra bot e 2x2 online |
| Dominó | mesa 2x2 | sem margem (jogo entre jogadores) | pronto: 1x1 contra bot e 2x2 online |
| Poker | heads-up limit hold'em | sem margem (jogo entre jogadores) | jogável contra bot; **multiplayer ainda não** |

Truco tem as duas variantes — **paulista**, com a manilha saindo da vira, e **mineiro**, com as quatro manilhas fixas —, escolhidas no lobby antes de abrir a mesa. E tem os dois estilos, **sujo** (o sinal pro parceiro é parte do jogo) e **limpo** (sinal é proibido), escolhidos na hora de criar a mesa 2x2: no 1x1 não existe parceiro pra quem sinalizar, então lá a opção não aparece.

## O que tem em cada pasta

**`app/`** — o app mobile (Expo + React Native + TypeScript). Sistema de design próprio, navegação entre as 5 áreas (Lobby, Torneios, Loja, Amigos, Perfil), tela de cada jogo, tela de escolha de variante/modo pros jogos que têm mais de um jeito de jogar, chat de mesa em todas as mesas online (com aba separada pra falar só com o parceiro no truco e no dominó 2x2), painel de placar de histórico e tutorial "como jogar" por jogo escrito pra quem nunca jogou. As imagens já integradas vivem em `app/assets/images/` (235 arquivos, otimizados).

**`server/`** — o backend (NestJS + TypeScript): usuários, carteira de fichas com ledger append-only, loja, cupons, papéis e permissões, amigos, os 10 motores de jogo, o placar de histórico, o chat e o gateway WebSocket das mesas online. Todos os sorteios acontecem no servidor — o app nunca decide resultado. Ver `server/README.md` pra rota por rota, evento por evento e a matriz de permissões.

**`docs/`** — os pedidos de imagem escritos imagem por imagem pra gerar no ChatGPT, e `como-testar-no-iphone.md`, que explica passo a passo como abrir o app num iPhone de verdade pelo Expo Go.

## Rodando

Suba o servidor primeiro — as telas dos jogos falam com ele de verdade:

```
cd server
npm install
npm run start:dev   # http://localhost:3000
```

Em outro terminal:

```
cd app
npm install
npx expo install    # alinha as versões exatas de cada dependência com o SDK do Expo
npx expo start
```

O app **descobre o endereço do servidor sozinho** — em celular físico ele lê o IP da máquina que está rodando o Expo e monta a URL. Só precisa mexer se quiser apontar pra outro lugar, e aí é a variável `EXPO_PUBLIC_API_URL`. O passo a passo pra testar no iPhone está em `docs/como-testar-no-iphone.md`.

## O que ainda falta

Nada disto é esquecimento — é o que ficou de fora do escopo construído até aqui, em ordem de importância:

1. **Persistência.** Está tudo em memória: reiniciar o servidor apaga saldo, mesas, histórico e amizades. Trocar os arrays por PostgreSQL é o item número um antes de qualquer pessoa de verdade usar isso.
2. **Autenticação de verdade.** Hoje o `userId` viaja explícito em cada chamada e `GET /users/me` devolve um usuário fixo. Precisa de Firebase Auth (Google, Facebook, Apple, e-mail/senha).
3. **Compra de verdade.** `POST /store/comprar` credita fichas sem validar recibo nenhum — serve pra testar o resto do fluxo e **não pode ir pra produção assim**. O caminho é RevenueCat validando o recibo da App Store/Play Store e chamando um webhook.
4. **Torneios.** A tela existe, os dados são mockados. Falta o backend (`tournaments`, `tournament_entries`, `leaderboards`).
5. **Poker multiplayer.** O único jogo de mesa que continua só contra bot — mesa de 2 a 9 lugares com side pot é bem mais trabalho que o 2x2 de assento fixo.
6. **Planilha de economia** (curva de nível, preço dos pacotes) — documento de negócio, não código.

Duas regras de jogo continuam marcadas no código como **a confirmar com quem joga na região**, porque as fontes divergem entre si: o topo da escada do truco mineiro e o critério de desempate do dominó quando a mesa trava.

O app nunca foi aberto visualmente nesta máquina (não há Expo rodando aqui) — o código passa no `tsc` dos dois lados e a lógica foi testada com clientes de verdade contra o servidor, mas o acabamento visual de cada tela só dá pra julgar rodando no celular.
