# Como pôr o Casino Inova no ar pra testar

Objetivo: um endereço na internet que abre no seu celular, no do seu amigo e no
computador. Depois disso, testar é mandar o link.

## Por que precisa publicar

Até agora o jogo só rodava na máquina onde o servidor estava ligado. Um endereço
`localhost` só existe dentro daquele computador — o celular não alcança. Publicado, o
endereço passa a existir pra todo mundo, e é ele também que a RevenueCat precisa pra
avisar de uma compra.

## O jeito mais curto: Render, um serviço só

O app e o servidor viram **um processo só**: o servidor Node entrega o site e responde a
API na mesma porta. Não tem dois serviços pra ligar um no outro nem CORS pra configurar.

### 1. Suba o código pro GitHub
Já está: branch `claude/mobile-casino-tournaments-jdtyzb` do repositório.

### 2. Crie a conta
[render.com](https://render.com) → entre com o GitHub. O plano gratuito serve pra testar.

### 3. Aponte pro repositório
No painel: **New → Blueprint**, escolha o repositório e a branch.

O Render lê o `casino-inova/render.yaml`, que já está no projeto, e monta sozinho:

- **o banco Postgres** (`casino-inova-db`), plano gratuito;
- **o serviço web** (`casino-inova`), a partir do `casino-inova/Dockerfile`;
- **`DATABASE_URL`**, ligada ao banco automaticamente;
- **`JWT_SECRET`**, sorteado pelo próprio Render.

Nenhuma senha fica escrita no projeto — os dois valores nascem lá dentro.

### 4. Espere a primeira construção
Uns 5 a 10 minutos na primeira vez: ele instala tudo, constrói o app web e compila o
servidor. As tabelas do banco são criadas sozinhas quando o servidor sobe.

### 5. Abra o endereço
Sai algo como `https://casino-inova.onrender.com`. Abra no celular. Crie uma conta —
ela já nasce com 10.000 fichas — e jogue.

**No iPhone, pra virar ícone na tela:** abra no Safari → botão de compartilhar →
"Adicionar à Tela de Início". Vira um ícone e abre sem a barra do navegador, igual a um
aplicativo. No Android é o mesmo caminho no Chrome, em "Instalar aplicativo".

## Depois que estiver no ar

**Avise a RevenueCat.** No painel dela, o endereço do webhook passa a ser
`https://SEU-ENDERECO/store/webhook`. Sem isso a compra é cobrada e as fichas não
entram. O segredo que você configurar lá tem que ser o mesmo da variável
`PURCHASE_WEBHOOK_SECRET` no Render.

**Se quiser domínio próprio.** No Render, em Settings → Custom Domain. Ele cuida do
certificado. O app não precisa de mudança nenhuma: ele usa a origem da própria página.

## Coisas que vão acontecer e não são defeito

- **A primeira visita depois de horas parado demora uns 30 segundos.** O plano gratuito
  do Render desliga o serviço quando ninguém usa. A segunda visita é normal.
- **O banco gratuito do Render expira depois de 90 dias.** Pra testar serve; pra valer,
  o plano pago ou o [Neon](https://neon.tech) resolvem — no Neon, basta trocar a
  `DATABASE_URL`.
- **Partida contra a casa em andamento se perde se o servidor reiniciar.** Saldo,
  extrato, torneios e amizades ficam no banco e sobrevivem. Só a mão de blackjack (ou
  rodada equivalente) que estiver aberta na hora do reinício se perde, junto com a
  aposta dela. Está anotado pra resolver.

## Rodando na sua máquina, sem publicar

Se preferir testar no computador antes:

```bash
# 1. o banco
createdb casino_inova

# 2. o servidor (numa aba)
cd casino-inova/server
npm install
DATABASE_URL=postgres://SEU_USUARIO@localhost:5432/casino_inova \
JWT_SECRET=qualquer-coisa-comprida-aqui \
npm start

# 3. o app (noutra aba)
cd casino-inova/app
npm install
npx expo start --web
```

O app abre em `http://localhost:8081` e acha o servidor sozinho.

**Pra abrir no seu celular pela mesma rede wi-fi:** rode `npx expo start` (sem `--web`),
instale o **Expo Go** no celular e aponte a câmera pro QR Code. O app descobre o IP do
computador sozinho — é pra isso que serve o `hostUri` em `app/src/api/client.ts`.
