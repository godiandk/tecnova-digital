# Como abrir o Casino Inova no seu iPhone

Você **não precisa de Mac, nem de conta de desenvolvedor Apple, nem pagar nada** pra
isso. O app roda dentro do **Expo Go**, um aplicativo gratuito da App Store feito
justamente pra testar apps em desenvolvimento.

## Antes de começar: você precisa de um computador

Não dá pra fazer isso só pelo celular. O computador é quem roda o servidor e serve o app
pro seu iPhone. Pode ser Windows, Mac ou Linux — qualquer um serve.

O que você vai precisar:

- Um **computador** com Node.js instalado (o passo 1 explica)
- Seu **iPhone e o computador na mesma rede Wi-Fi** — isso é obrigatório
- O app **Expo Go**, grátis na App Store
- Uns **20 minutos** na primeira vez

O código **não está no seu computador**: ele está no GitHub. O passo 2 baixa.

---

## Passo 1 — Node.js no computador

Baixe em **nodejs.org** e pegue a versão marcada como **LTS**. Instale normalmente,
avançando.

Pra conferir, abra o terminal (Windows: procure por "PowerShell"; Mac: "Terminal") e
digite:

```
node --version
```

Tem que aparecer algo como `v20.11.0`. Se der erro, o Node não instalou.

## Passo 2 — Baixar o projeto

No mesmo terminal:

```
git clone https://github.com/godiandk/tecnova-digital.git
cd tecnova-digital
git checkout claude/mobile-casino-tournaments-jdtyzb
```

> Se `git` der erro, instale em **git-scm.com** e repita.

## Passo 3 — Um banco de dados (5 minutos, de graça)

O servidor guarda saldo, contas e ranking num PostgreSQL. Você **não precisa instalar
banco nenhum** — dá pra usar um gratuito na internet, que também vai servir quando o
servidor for publicado de verdade.

1. Vá em **neon.tech** e crie conta (dá pra entrar com o Google).
2. Crie um projeto. Pode chamar de `casino-inova`.
3. Ele mostra uma **connection string**, parecida com:
   `postgresql://usuario:senha@ep-algo.neon.tech/neondb?sslmode=require`
4. **Copie ela inteira.** É o que vai em `DATABASE_URL`.

> Se preferir instalar o Postgres no seu computador, funciona igual — a connection
> string fica `postgres://postgres@localhost:5432/casino_inova`, e você precisa criar o
> banco com `createdb casino_inova`.

## Passo 4 — Ligar o servidor

O servidor é o cérebro do jogo: sorteia os dados, embaralha as cartas, controla as
fichas. Sem ele no ar, o app abre mas não deixa jogar.

Abra um terminal, entre na pasta do servidor e ligue — **trocando a connection string
pela sua**:

**No Mac ou Linux:**
```
cd casino-inova/server
npm install
DATABASE_URL="cole-sua-connection-string-aqui" \
JWT_SECRET="qualquer-frase-longa-que-voce-inventar" \
PERMITIR_COMPRA_DE_TESTE=true \
npm run start:dev
```

**No Windows (PowerShell):**
```
cd casino-inova\server
npm install
$env:DATABASE_URL="cole-sua-connection-string-aqui"
$env:JWT_SECRET="qualquer-frase-longa-que-voce-inventar"
$env:PERMITIR_COMPRA_DE_TESTE="true"
npm run start:dev
```

A primeira vez demora (está baixando dependências). Quando terminar, aparece:

```
Casino Inova API rodando em http://localhost:3000
Na rede local (é este que o celular usa): http://192.168.x.x:3000
```

**Deixe esse terminal aberto.** Se fechar, o servidor desliga.

> O `JWT_SECRET` pode ser qualquer coisa pra testar — `minha-frase-secreta-123` serve.
> Em produção precisa ser longo e aleatório de verdade.

## Passo 5 — Ligar o app

Abra **outro** terminal (o primeiro tem que continuar rodando o servidor):

```
cd tecnova-digital/casino-inova/app
npm install
npx expo start
```

Vai aparecer um **QR Code grande** no terminal.

## Passo 6 — Abrir no iPhone

1. Instale o **Expo Go** pela App Store, se ainda não tiver.
2. Abra a **câmera** do iPhone e aponte pro QR Code.
3. Toque no aviso que aparece — abre no Expo Go.

A primeira abertura demora um pouco (está montando o app). Depois fica rápido.

## Passo 7 — Entrar

A tela de login aparece. Use uma conta de teste:

| E-mail | Senha | Quem é |
|---|---|---|
| `u1@teste.local` | `casino123` | Admin, começa com 12.500 fichas |
| `u2@teste.local` | `casino123` | Jogador comum, começa zerado |
| `u3@teste.local` | `casino123` | Jogador comum |
| `u4@teste.local` | `casino123` | Jogador comum |

Ou toque em **"Criar conta"** e faça a sua — mas ela começa com zero fichas.

> **Sem fichas não dá pra jogar.** Entre com o `u1`, ou use a Loja pra "comprar" um
> pacote (com `PERMITIR_COMPRA_DE_TESTE=true` ligado, ela credita de graça).

---

## Quando algo não funciona

**"Network request failed" ou o app abre mas não carrega nada**
O celular não está achando o servidor. Confira:
- O terminal do servidor ainda está aberto e rodando?
- O iPhone está na **mesma rede Wi-Fi** do computador? (dados móveis não funcionam)
- Rede de empresa, hotel ou faculdade costuma bloquear — se for o caso, use o Wi-Fi de
  casa ou o roteador do celular.

**O QR Code não abre nada**
Abra o Expo Go primeiro e use "Scan QR code" de dentro dele.

**O servidor não sobe e fala de `DATABASE_URL`**
A connection string não chegou. Confira se copiou inteira, com as aspas.

**O servidor não sobe e fala de `JWT_SECRET`**
Faltou essa variável. Ele recusa subir sem ela de propósito — sem segredo, não existe
token confiável.

**Erro de conexão com o banco**
Se for o Neon: confira se a connection string tem `?sslmode=require` no fim.

---

## O que olhar quando estiver rodando

Esta é a primeira vez que alguém vê o app funcionando. Vale olhar com atenção:

- O **lobby** — os cartazes cabem bem na tela? O nome do jogo está legível?
- A **barra de nível e o contador de fichas** no topo — o número está no lugar certo
  dentro do desenho?
- Entre em **um jogo** — dá pra apostar? O saldo muda?
- O **truco**: escolha Paulista, depois Mineiro. As cartas aparecem?
- A tela de **Torneios** — o ranking carrega?

Anote o que estiver feio ou errado e me mande — inclusive print. Acabamento visual é a
única coisa que eu não consigo conferir daqui.
