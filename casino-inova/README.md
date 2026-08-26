# Casino Inova

Cassino social mobile — fichas compradas com dinheiro real, sem saque, torneios diários/semanais/mensais com ranking e prêmios virtuais. Ver o plano completo de produto e arquitetura publicado como artefato na conversa (economia, sistemas, roadmap de 4 fases).

Este é um **projeto novo e separado** do site institucional da tecnova-digital — vive na pasta `casino-inova/` só por conveniência de repositório, sem nenhuma dependência do código do site.

## O que já existe nesta pasta

- `app/` — esqueleto do app mobile (Expo + React Native + TypeScript), com o sistema de design (cores, tipografia), navegação entre as 5 áreas principais (Lobby, Torneios, Loja, Amigos, Perfil) e uma tela de mesa genérica para os 8 jogos, todos usando dados mockados.
- `docs/briefing-imagens-casino-inova.md` — o texto completo pra gerar (via ChatGPT ou outra ferramenta de imagem) todo o pacote de assets visuais: logo, telas de fundo, personagens de dealer por jogo, mesas, cartas, fichas, dados, ícones etc.

## O que ainda falta (por design — não é esquecimento)

Nada de lógica de jogo, backend ou multiplayer real foi implementado ainda. Antes disso, na ordem:

1. Planilha de economia (RTP por jogo, curva de nível, preço dos pacotes de fichas) — documento de negócio, não código.
2. Backend da Fase 0: conta (login Google/Facebook/Apple/e-mail), carteira de fichas (ledger), loja com validação de recibo via RevenueCat.
3. Motor de jogos server-authoritative, começando pelos jogos mais simples (slots, roleta, blackjack) antes dos multiplayer (truco, dominó, pôquer).

## Rodando o app

```
cd app
npm install
npx expo install   # alinha as versões exatas de cada dependência com o SDK do Expo instalado
npx expo start
```

As dependências em `app/package.json` foram escritas à mão nesta sessão (sem acesso a `npm install` real pra travar versões) — rode `npx expo install` antes de tudo pra corrigir qualquer divergência de versão com o SDK do Expo.

## Onde entram as imagens geradas

`app/assets/images/README.md` mapeia a estrutura de pastas esperada — ela é exatamente a mesma estrutura de saída pedida no briefing de imagens em `docs/`. É só descompactar o zip do ChatGPT dentro de `app/assets/images/`.
