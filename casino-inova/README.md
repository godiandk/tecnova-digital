# Casino Inova

Cassino social mobile — fichas compradas com dinheiro real, sem saque, torneios diários/semanais/mensais com ranking e prêmios virtuais. Ver o plano completo de produto e arquitetura publicado como artefato na conversa (economia, sistemas, roadmap de 4 fases).

Este é um **projeto novo e separado** do site institucional da tecnova-digital — vive na pasta `casino-inova/` só por conveniência de repositório, sem nenhuma dependência do código do site.

## O que já existe nesta pasta

- `app/` — esqueleto do app mobile (Expo + React Native + TypeScript), com o sistema de design (cores, tipografia), navegação entre as 5 áreas principais (Lobby, Torneios, Loja, Amigos, Perfil) e tutorial "como jogar" por jogo (`src/data/tutorials.ts` + `TutorialModal`) escrito em linguagem simples para quem nunca jogou. **Os 8 jogos são jogáveis de verdade** — Slots, Roleta, Blackjack, Bacará, Banca Francesa, Truco, Dominó e Poker falam com a API do servidor, mostram o RTP ou as regras de aposta divulgadas, apostam, debitam/creditam fichas de verdade. Truco, Dominó e Poker são contra bot, ainda sem multiplayer de verdade (ver "Próximo marco" abaixo). Perfil tem um campo de resgatar cupom, e **Amigos agora fala com uma lista de amigos de verdade** (pedir, aceitar, recusar). As **38 imagens do briefing já estão integradas** (`app/assets/images/`, otimizadas de 128MB pra 55MB): fundo do Lobby, mesa de cada jogo como pano de fundo real, e o retrato do crupiê ao lado do título nas mesas com dealer — a Banca Francesa mostra os 3 personagens da equipe (banqueiro, tirador, apontador).
- `server/` — esqueleto do backend (NestJS + TypeScript) com os módulos de usuário, carteira de fichas (ledger append-only), loja, **cupons** (admin cria, jogador resgata por código), **papéis/permissões** (admin e moderador — moderador nunca pode banir nem criar outro moderador; matriz completa em `server/README.md`), **amigos** (pedir/aceitar/recusar/listar — pré-requisito pro convite de sala) e os **8 motores de jogo**: **slots** (RTP por fórmula exata, `npm run verify:rtp`), **roleta europeia** (RTP fixo de 36/37 ≈ 97,30%), **blackjack** (mão com estado, blackjack paga 3:2, `npm run verify:blackjack`), **bacará** (regras reais de compra da 3ª carta do Punto Banco, `npm run verify:bacara`), **banca francesa** (3 dados, RTP fixo de 199/216 ≈ 92,13%, `npm run verify:banca-francesa`), **truco** (manilha, força de carta, desempate de mão, pedir truco), **dominó** (pontas, travamento) e **poker** (heads-up limit hold'em — avaliador de mão de verdade com todas as categorias, `npm run verify:poker-hands`). Truco/dominó/poker são contra bot — multiplayer de verdade com outro jogador ainda exige sala + WebSocket, que não existe neste esqueleto. Tudo funcional em memória, testável com `curl`. Ver `server/README.md` para o que falta pra virar a Fase 0 de verdade (banco real, autenticação, validação de recibo).
- `docs/briefing-imagens-casino-inova.md` — o texto completo pra gerar (via ChatGPT ou outra ferramenta de imagem) todo o pacote de assets visuais: logo, telas de fundo, personagens de dealer por jogo, mesas, cartas, fichas, dados, ícones etc.

## Próximo marco: salas multiplayer

Confirmado que multiplayer de verdade é o alvo pros jogos de mesa (truco, dominó, poker) — bot continua útil pra completar mesa quando faltar gente, não é substituto. **Escopo decidido:** só esses 3 (não os 5 jogos contra a casa, que teriam mesa compartilhada de um jeito tecnicamente diferente — todo mundo aposta contra a casa, não um contra o outro). O sistema de amigos (acima) já está pronto — é a base que faltava pro convite por "+". O pedido específico:

- Criar mesa/sala em qualquer modo de jogo.
- Sala privada gera um código pra mandar pro amigo.
- Amigo entra colando o código num campo específico, ou recebe um convite (botão "+") que aparece pra ele dentro do app.
- Bot preenche vaga vazia quando ninguém mais entra.

Isso é a peça de infraestrutura que falta (sala + WebSocket, servidor de jogo em tempo real — Colyseus é a escolha apontada no plano de produto) — ainda não construída. Ainda não decidido: se entra por todos os 8 jogos de uma vez ou começa pelos 3 que já são contra bot (truco/dominó/poker, onde já existe motor de regras pra reaproveitar); e como o convite chega pro amigo (notificação push, uma aba de convites pendentes, ou os dois).

## O que ainda falta (por design — não é esquecimento)

1. Planilha de economia (RTP por jogo, curva de nível, preço dos pacotes de fichas) — documento de negócio, não código.
2. Fechar a Fase 0 de verdade no backend: banco PostgreSQL, autenticação (Firebase Auth), validação de recibo via RevenueCat — ver a lista detalhada em `server/README.md`.
3. Salas multiplayer de verdade (ver acima) — é o que falta pra truco, dominó e poker deixarem de ser só contra bot.

## Rodando o app

O Lobby funciona sozinho, mas as telas dos 8 jogos falam de verdade com o servidor — suba o servidor primeiro:

```
cd server
npm install
npm run start:dev   # http://localhost:3000
```

Em outro terminal:

```
cd app
npm install
npx expo install   # alinha as versões exatas de cada dependência com o SDK do Expo instalado
npx expo start
```

Testando no emulador Android ou num celular físico, troque `API_BASE_URL` em `app/src/api/client.ts` — "localhost" só funciona no simulador iOS (o arquivo já comenta as duas outras opções).

As dependências em `app/package.json` foram escritas à mão nesta sessão (sem acesso a `npm install` real pra travar versões) — rode `npx expo install` antes de tudo pra corrigir qualquer divergência de versão com o SDK do Expo.

## Onde entram as imagens geradas

`app/assets/images/README.md` mapeia a estrutura de pastas esperada — ela é exatamente a mesma estrutura de saída pedida no briefing de imagens em `docs/`. É só descompactar o zip do ChatGPT dentro de `app/assets/images/`.
