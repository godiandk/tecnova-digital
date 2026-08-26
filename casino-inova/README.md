# Casino Inova

Cassino social mobile — fichas compradas com dinheiro real, sem saque, torneios diários/semanais/mensais com ranking e prêmios virtuais. Ver o plano completo de produto e arquitetura publicado como artefato na conversa (economia, sistemas, roadmap de 4 fases).

Este é um **projeto novo e separado** do site institucional da tecnova-digital — vive na pasta `casino-inova/` só por conveniência de repositório, sem nenhuma dependência do código do site.

## O que já existe nesta pasta

- `app/` — esqueleto do app mobile (Expo + React Native + TypeScript), com o sistema de design (cores, tipografia), navegação entre as 5 áreas principais (Lobby, Torneios, Loja, Amigos, Perfil), tutorial "como jogar" por jogo (`src/data/tutorials.ts` + `TutorialModal`) escrito em linguagem simples para quem nunca jogou, e uma tela de mesa genérica para os 6 jogos que ainda não têm motor. **Slots e Roleta já são jogáveis de verdade** (`SlotsScreen`, `RouletteScreen`): falam com a API do servidor, mostram o RTP divulgado, apostam, debitam/creditam fichas de verdade. Os outros 6 ainda usam dados mockados.
- `server/` — esqueleto do backend (NestJS + TypeScript) com os módulos de usuário, carteira de fichas (ledger append-only), loja e dois motores de jogo de verdade: **slots** (RTP calculado por fórmula exata, ver `slots.engine.ts` e `npm run verify:rtp`) e **roleta europeia** (RTP fixo de 36/37 ≈ 97,30% para qualquer tipo de aposta, por propriedade matemática da roleta, não por ajuste de peso). Tudo funcional em memória, testável com `curl`. Ver `server/README.md` para o que falta pra virar a Fase 0 de verdade (banco real, autenticação, validação de recibo).
- `docs/briefing-imagens-casino-inova.md` — o texto completo pra gerar (via ChatGPT ou outra ferramenta de imagem) todo o pacote de assets visuais: logo, telas de fundo, personagens de dealer por jogo, mesas, cartas, fichas, dados, ícones etc.

## O que ainda falta (por design — não é esquecimento)

Nenhum motor de jogo real (regras, RNG, multiplayer) foi implementado ainda. Antes disso, na ordem:

1. Planilha de economia (RTP por jogo, curva de nível, preço dos pacotes de fichas) — documento de negócio, não código.
2. Fechar a Fase 0 de verdade no backend: banco PostgreSQL, autenticação (Firebase Auth), validação de recibo via RevenueCat — ver a lista detalhada em `server/README.md`.
3. Motor de jogos server-authoritative, começando pelos jogos mais simples (slots, roleta, blackjack) antes dos multiplayer (truco, dominó, pôquer).

## Rodando o app

O Lobby funciona sozinho, mas a tela de Slots fala de verdade com o servidor — suba o servidor primeiro:

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
