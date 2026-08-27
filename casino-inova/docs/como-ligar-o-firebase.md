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

---

# Parte 6 — Depois que o projeto existe (atualizado)

O projeto `inova-casino` já está criado, e a configuração pública dele já está no app
(`app/src/firebase/config.ts`). O que falta:

## 6.1 — A chave de serviço (é o que o servidor precisa)

O trecho que o console entrega na tela "Adicionar app da Web" **não serve pro servidor**.
Aquilo é a metade pública. A chave de serviço é outra coisa:

**Engrenagem → Configurações do projeto → Contas de serviço → Gerar nova chave privada.**

Baixa um `.json`. O conteúdo dele vai em `FIREBASE_SERVICE_ACCOUNT`, e **nunca** no
repositório.

## 6.2 — Os ids de cliente OAuth (é o que o app precisa)

Também não vêm no trecho público. Depois de ligar o Google em **Authentication → Sign-in
method → Google**:

- **Web client ID**: na mesma tela, abra "Configuração do SDK da Web". Copie o
  *ID do cliente da Web*.
- **iOS client ID**: em Configurações do projeto → Seus apps → adicione um app iOS com o
  bundle `com.casinoinova.app`, baixe o `GoogleService-Info.plist` e pegue o
  `CLIENT_ID` de dentro dele.
- **Android client ID**: idem, com o pacote `com.casinoinova.app`.

Eles vão num `.env` na pasta `app/`:

```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=...apps.googleusercontent.com
```

Enquanto estiverem vazios, o botão do Google simplesmente não aparece na tela de login —
e o login por e-mail e senha continua funcionando.

## 6.3 — Trancar o que o projeto não usa

**Esta é a parte que mais gente esquece, e é a que dá problema.**

Nosso projeto usa o Firebase **só pra login**. Toda a informação de jogador, ficha e
partida está no nosso PostgreSQL, não no Firebase.

Só que o Firebase oferece Firestore, Realtime Database e Storage — e, se algum deles for
criado "em modo de teste", ele fica **aberto pra qualquer pessoa ler e escrever por 30
dias**. E a chave pública que está no app é tudo que alguém precisa pra achar o caminho.

Então:

- **Não crie** Firestore, Realtime Database nem Storage. Se não existirem, não há o que
  invadir.
- Se já criou algum, entre em **Regras** e troque por isto, que nega tudo:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Para o Storage, o mesmo:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

Negar tudo é o certo aqui: nada no nosso app lê ou escreve nesses serviços, então fechar
não quebra nada — e deixar aberto seria um banco de dados público com o endereço colado
dentro do aplicativo.

## 6.4 — Restringir a chave pública (opcional, mas recomendado)

A chave pública não autoriza nada sozinha, mas dá pra amarrar ela ao seu app pra ninguém
usar sua cota:

**console.cloud.google.com → APIs e serviços → Credenciais → a chave "Browser key" →
Restrições de aplicativo** → escolha Android/iOS e informe o pacote e o bundle.

## 6.5 — Um aviso sobre o Analytics

O trecho que o console entrega inclui `getAnalytics`. **Isso não funciona em React
Native** — o módulo `firebase/analytics` é só pra navegador. Por isso ele não está no
nosso código. Se quiser analytics no app, é outro pacote
(`@react-native-firebase/analytics`), e é uma decisão separada do login.


---

# Parte 7 — Revogar uma chave de serviço

Faça isto sempre que uma chave sair do lugar dela: colada num chat, mandada por e-mail,
commitada por engano, ou guardada em algum computador que não é mais seu.

**Não dá pra "despublicar" um segredo.** Uma vez que ele saiu, o único conserto é
trocar — quem já copiou continua com a cópia velha, e ela precisa parar de valer.

1. **console.cloud.google.com** → selecione o projeto `inova-casino`.
2. Menu → **IAM e administrador → Contas de serviço**.
3. Clique na conta `firebase-adminsdk-fbsvc@inova-casino.iam.gserviceaccount.com`.
4. Aba **Chaves**.
5. Você vai ver as chaves pelo id (`private_key_id` do arquivo JSON). **Primeiro crie a
   nova**: Adicionar chave → Criar nova chave → JSON.
6. Atualize `FIREBASE_SERVICE_ACCOUNT` com o conteúdo da chave nova, onde o servidor
   estiver rodando.
7. Confira que subiu: o log tem que dizer `Firebase Admin ligado no projeto
   inova-casino`. Ou rode `npm run verify:firebase`.
8. **Só então apague a chave antiga**, pelo id, na mesma tela.

Nessa ordem: cria a nova, troca, confirma, apaga a velha. Apagar antes de trocar derruba
o login social até você terminar.

## Como evitar que aconteça de novo

- A chave nunca precisa sair do lugar onde o servidor roda. Em produção ela vive no
  painel de variáveis de ambiente do serviço de hospedagem, e mais nada.
- Em desenvolvimento, num `.env` — que o `.gitignore` deste projeto já cobre, junto com
  os nomes de arquivo que o Firebase usa (`*firebase-adminsdk*.json`).
- Se precisar mandar pra alguém, use um cofre de senha, não chat nem e-mail.
- Nunca comite. E se comitar: **trocar a chave é obrigatório**, porque apagar o arquivo
  num commit seguinte não tira ele do histórico.


---

# Parte 8 — Situação real do projeto `inova-casino`

Estado em que o console está, e o que fazer com cada item.

## Ligados e funcionando

| Provedor | Situação |
|---|---|
| **E-mail/senha** | Ligado. É o que o app usa hoje, e funciona inteiro. |
| **Google** | Ligado no console. Falta pegar os ids de cliente OAuth pro app (Parte 6.2). |

Com esses dois, o app está completo pra testar e pra publicar no Android.

## Travados por conta paga (e a conta é obrigatória por outro motivo)

| Provedor | O que pede | Custo real |
|---|---|---|
| **Apple** | Services ID | Apple Developer Program, US$ 99/ano |
| **Game Center** | ligado, mas só funciona em app assinado | mesma conta da Apple |
| **Facebook** | App ID + Secret | **grátis** — só criar um app em developers.facebook.com |

**O ponto que muda o planejamento:** os US$ 99/ano da Apple não são pelo "Entrar com
Apple". São para **publicar qualquer aplicativo na App Store**. Sem essa conta:

- não dá pra colocar o app na App Store, com ou sem login social;
- dá pra publicar no Android (Google Play cobra US$ 25, uma vez só, pra sempre);
- dá pra testar no seu próprio iPhone pelo Expo Go.

Ou seja: se o plano é iPhone, a conta da Apple entra em algum momento — e aí o "Entrar
com Apple" vem junto de graça. Se o plano é começar pelo Android, nada disso trava nada.

**Facebook não custa nada.** Se quiser esse login, é só criar o app em
developers.facebook.com e colar App ID e Secret. Fica aqui como opção, não como
pendência.

## O que fazer com o Game Center

Ele está ligado no console, mas o app não usa e não vai usar por enquanto: Game Center é
só iOS e exige app assinado com conta Apple. Pode deixar ligado (não faz mal) ou
desligar. Se um dia for usado, o servidor precisa aceitar `gc.apple.com` na lista de
provedores — hoje ele recusa, que é o comportamento certo pra algo que não foi
construído.

## Configuração do servidor pra esta situação

```
FIREBASE_PROVIDERS=google
```

O padrão já é esse. Quando ligar mais algum, é só acrescentar:
`FIREBASE_PROVIDERS=google,facebook`.

O app só mostra o botão de um provedor quando o servidor diz que aceita **e** o app tem
o id de cliente dele. As duas pontas precisam concordar.

## ⚠️ O Firestore foi criado — trancar

O console mostra o Cloud Firestore criado (vazio, com "Iniciar coleção"). Nosso app não
usa Firestore: jogador, ficha, partida e ranking estão todos no nosso PostgreSQL.

Um Firestore em modo de teste fica **aberto pra qualquer pessoa ler e escrever por 30
dias**, e a chave pública do Firebase está dentro do aplicativo — o endereço não é
segredo pra ninguém.

As regras que negam tudo estão em `docs/firestore-regras-trancar.txt`. Cole na aba
**Regras** e publique. Como nada no app usa o Firestore, fechar não quebra coisa alguma.
