# Como testar o Casino Inova no iPhone

Você **não precisa de Mac nem de conta de desenvolvedor Apple** pra isso. O app roda dentro do **Expo Go**, um aplicativo gratuito da App Store que serve justamente pra testar apps em desenvolvimento.

O que você precisa:
- Um computador (Windows, Mac ou Linux) com **Node.js 18 ou mais novo** instalado
- Seu iPhone e o computador **na mesma rede Wi-Fi** (esse ponto é obrigatório)
- O app **Expo Go** instalado no iPhone

---

## Passo 1 — Instalar o Node.js no computador

Se ainda não tem, baixe em https://nodejs.org (pegue a versão "LTS"). Pra conferir se deu certo, abra o terminal (no Windows: Prompt de Comando ou PowerShell) e digite:

```
node --version
```

Tem que aparecer algo como `v20.11.0`. Se aparecer erro, o Node não foi instalado.

## Passo 2 — Baixar o projeto

No terminal, rode:

```
git clone https://github.com/godiandk/tecnova-digital.git
cd tecnova-digital
git checkout claude/mobile-casino-tournaments-jdtyzb
```

## Passo 3 — Ligar o servidor

O servidor é o cérebro do jogo: é ele que sorteia os dados, embaralha as cartas e controla as fichas. Sem ele no ar, o app abre mas não deixa jogar.

Abra um terminal e rode:

```
cd casino-inova/server
npm install
npm run start:dev
```

A primeira vez demora um pouco (está baixando as dependências). Quando terminar, vai aparecer:

```
Casino Inova API rodando em http://localhost:3000
Na rede local (é este que o celular usa): http://192.168.0.15:3000
```

**Deixe esse terminal aberto.** Se fechar, o servidor desliga.

> Anote o número que aparece na segunda linha (no exemplo, `192.168.0.15`). Você não vai precisar dele normalmente — o app descobre sozinho — mas ele ajuda se algo der errado.

## Passo 4 — Ligar o app

Abra um **segundo terminal** (deixe o do servidor rodando) e rode:

```
cd casino-inova/app
npm install
npx expo start
```

Vai aparecer um **QR Code** grande no terminal.

## Passo 5 — Abrir no iPhone

1. Instale o **Expo Go** pela App Store (é gratuito).
2. Abra a **câmera** do iPhone e aponte pro QR Code que está no terminal.
3. Toque na notificação que aparece — ela abre o Expo Go.
4. Espere carregar (a primeira vez demora uns 30 segundos).

Pronto, o jogo abre no seu iPhone.

---

## Se der errado

**"Network request failed" ou o jogo abre mas diz que não conseguiu falar com o servidor**

Quase sempre é uma destas três coisas:

1. **O servidor não está rodando.** Volte no primeiro terminal e confira se ainda está aberto com a mensagem "API rodando".
2. **Celular e computador em redes diferentes.** É o caso mais comum: o celular está no 4G/5G em vez do Wi-Fi, ou o Wi-Fi da casa tem duas redes (uma de 2.4GHz e outra de 5GHz) e cada aparelho está numa. Coloque os dois na mesma.
3. **O firewall do computador está bloqueando.** No Windows, quando você roda o servidor pela primeira vez costuma aparecer um aviso do Firewall — precisa clicar em "Permitir acesso" e marcar "Redes privadas".

Pra testar se o celular enxerga o servidor: abra o **Safari no iPhone** e digite o endereço da rede local que apareceu no Passo 3, com `/games/bac-bo/config` no final. Por exemplo:

```
http://192.168.0.15:3000/games/bac-bo/config
```

Se aparecer um monte de texto em formato de código, está tudo certo e o problema é outro. Se não carregar nada, é rede ou firewall.

**O QR Code não abre nada quando aponto a câmera**

Abra o Expo Go direto e use a opção "Scan QR Code" de dentro dele.

**Quero rodar sem estar na mesma rede**

No terminal do app, rode `npx expo start --tunnel` em vez de `npx expo start`. Fica mais lento, mas funciona por qualquer rede, inclusive 4G. Nesse caso você precisa apontar o app pro servidor manualmente — me avise que eu te explico como.

---

## O que dá pra testar agora

Funcionando de ponta a ponta:
- Caça-níqueis, roleta, blackjack, bacará, banca francesa, truco, dominó, poker
- Bac Bo e Stock Market (os dois jogos novos)
- Banca Francesa multiplayer com chat (dá pra criar mesa e entrar por código)
- Loja de fichas, cupons, amigos, perfil

Ainda **sem as imagens novas** (mesas, baralho, peças, sinais, placar) — as telas usam as imagens antigas até você gerar o lote novo. Então o visual ainda não é o final.

## Quando quiser publicar de verdade na App Store

Aí sim vai precisar de conta de desenvolvedor Apple (US$ 99/ano) e de um build de produção. Mas isso é bem depois — pra desenvolver e mostrar pros outros, o Expo Go resolve. Dá até pra mandar o link pra outra pessoa testar no celular dela, desde que esteja na mesma rede.
