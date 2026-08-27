# Como ligar o login com Google, Apple e Facebook

O servidor já está pronto pra isso — ele confere o token com o Google e só cria conta
depois que a conferência passa. O que falta é a parte que só você pode fazer: criar o
projeto no Firebase e me dar as chaves.

Este documento é o passo a passo. Leva uns 20 minutos pro Google, e mais tempo pra Apple
e Facebook (as duas exigem conta de desenvolvedor paga).

---

## Antes de começar: entenda o desenho

Não é o servidor que conversa com o Google. É assim:

1. A pessoa toca em "Entrar com Google" **no app**.
2. O app abre a tela do Google, a pessoa escolhe a conta.
3. O Firebase devolve **pro app** um token que prova quem ela é.
4. O app manda esse token pro nosso servidor.
5. **O servidor confere esse token com o Google** e, só se passar, cria a conta e devolve
   a nossa sessão.

O passo 5 é o que já está construído. Ele é o que impede alguém inventar um token e
entrar como qualquer pessoa — sem essa conferência, o login social seria pior do que não
ter login nenhum.

---

## Parte 1 — Criar o projeto no Firebase (grátis)

1. Vá em **console.firebase.google.com** e entre com uma conta Google.
2. Clique em **Criar projeto**. Chame de `casino-inova` (ou o que preferir).
3. Ele pergunta se quer o Google Analytics. Pode desligar — não é necessário pra login.
4. Espere criar e clique em **Continuar**.

## Parte 2 — Ligar os métodos de login

Ainda no console, menu lateral: **Criação → Authentication → Começar**.

Na aba **Sign-in method**, ligue os que quiser:

- **Google** — é o mais fácil. Liga, escolhe um e-mail de suporte, salva. Pronto.
- **Apple** — exige conta no Apple Developer Program (US$ 99/ano). **É obrigatório** se o
  app tiver qualquer outro login social e for pra App Store — a Apple recusa o app sem
  "Entrar com Apple".
- **Facebook** — exige criar um app no developers.facebook.com e colar App ID e App
  Secret aqui.

Sugestão: comece só com o Google. Os outros dá pra acrescentar depois sem mexer no
servidor — ele já aceita os três.

## Parte 3 — Pegar a chave que o servidor precisa

Esta é a parte que me interessa.

1. No console, clique na **engrenagem** (canto superior esquerdo) → **Configurações do
   projeto**.
2. Aba **Contas de serviço**.
3. Botão **Gerar nova chave privada** → **Gerar chave**.
4. Ele baixa um arquivo `.json`. **Esse arquivo é a chave do cofre**: quem tiver ele tem
   acesso administrativo ao projeto inteiro, incluindo poder entrar como qualquer usuário.

**Nunca coloque esse arquivo no repositório.** Nem numa pasta do projeto "só por
enquanto" — é o jeito mais comum de vazar credencial, e o histórico do git não esquece.

## Parte 4 — Configurar o servidor

O conteúdo do arquivo vai numa variável de ambiente:

```
FIREBASE_SERVICE_ACCOUNT='<cole aqui o JSON inteiro, numa linha só>'
```

Em desenvolvimento, o jeito mais prático é um arquivo `.env` (que já está no
`.gitignore`) ou passar direto na linha de comando:

```
DATABASE_URL=postgres://postgres@localhost:5432/casino_inova \
  JWT_SECRET=troque-isto \
  FIREBASE_SERVICE_ACCOUNT="$(cat ~/Downloads/casino-inova-firebase-adminsdk.json)" \
  npm run start:dev
```

Em produção, isso vai no painel de variáveis de ambiente do serviço onde o servidor
estiver hospedado (Railway, Render, Fly, o que for) — nunca em arquivo.

**Como saber se funcionou:** o servidor escreve no log, ao subir:

```
[Firebase] Firebase Admin ligado no projeto casino-inova.
```

E a rota `GET /auth/provedores` passa a responder:

```json
{ "provedores": ["google", "apple", "facebook"] }
```

Enquanto não estiver configurado, ela responde `{"provedores": []}` — e é assim que a
tela de login sabe se mostra ou esconde os botões. Nada quebra por falta de
configuração; o login por e-mail e senha continua funcionando normalmente.

---

## Parte 5 — O que ainda falta no app

Esta parte eu **não construí**, e é proposital: ela depende de escolhas suas e de números
que só existem depois que o projeto Firebase existir.

O app precisa:

1. Do SDK do Firebase configurado com as chaves **públicas** do projeto (essas podem ir
   no repositório — são diferentes da chave de serviço).
2. Do fluxo de login de cada provedor, que devolve o token.
3. Mandar esse token pra `POST /auth/entrar-com-provedor` — que já existe e já funciona.

**Uma coisa importante antes de escolher:** login com Google **não funciona no Expo Go**
no iPhone. Ele exige um *development build* (`npx expo run:ios` ou EAS Build). Ou seja,
ligar o login social significa parar de testar pelo Expo Go e passar a gerar build — que
é um passo que você vai ter que dar de qualquer jeito antes de publicar, mas é bom saber
que ele chega junto com essa decisão, não depois.

Por isso sugiro a ordem: **teste primeiro o app com e-mail e senha pelo Expo Go**, veja se
está bonito e se joga bem. Login social é melhor deixar pro momento em que você for
gerar o primeiro build de verdade.

Quando chegar essa hora, me diga quais provedores você ligou no console e eu construo o
lado do app.

---

## Resumo do que fica sob sua responsabilidade

| Item | Onde | Custo |
|---|---|---|
| Projeto Firebase | console.firebase.google.com | grátis |
| Login Google | Authentication → Sign-in method | grátis |
| Login Apple | idem + Apple Developer Program | US$ 99/ano |
| Login Facebook | idem + app no developers.facebook.com | grátis |
| Chave de serviço | Configurações → Contas de serviço | grátis |

E a regra que vale pra tudo: **a chave de serviço nunca entra no repositório.**
