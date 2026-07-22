# TECNOVA Digital — Guia de configuração

Este pacote tem: o site (`index.html`), a área de login/registo do cliente
(`conta.html`), o teu painel administrativo (`admin.html`), e os ficheiros que
tornam o site instalável como app (`manifest.json`, `sw.js`, ícones).

Tudo isto precisa de **5 passos únicos** para começar a funcionar de verdade.
Depois de feito uma vez, fica pronto para sempre.

---

## Passo 1 — Criar o projeto Firebase (grátis)

1. Vai a **https://console.firebase.google.com/**
2. Clica em **"Adicionar projeto"**, dá o nome `tecnova-digital` e cria.
3. No menu da esquerda, entra em **Compilação (Build) → Authentication**
   → clica **"Começar"** → ativa o método **"Email/Palavra-passe"**.
4. Ainda no menu, entra em **Compilação → Firestore Database**
   → **"Criar base de dados"** → escolhe **modo de produção** → escolhe a
   região mais próxima (ex: `europe-west`).

## Passo 2 — Ligar o site ao teu Firebase

1. No Firebase, clica no ícone de engrenagem (canto superior esquerdo) →
   **Definições do projeto**.
2. Em baixo, em **"Os teus apps"**, clica no ícone **`</>`** (Web) e regista
   uma app com o nome `TECNOVA Digital`.
3. Vai aparecer um bloco de código chamado `firebaseConfig` — copia-o.
4. Abre o ficheiro **`firebase-config.js`** (dentro desta pasta) e cola os
   valores dentro das aspas, substituindo o que está escrito.
5. No mesmo ficheiro, troca `wesley@tecnovadigital.pt` pelo **teu email real**
   dentro de `ADMIN_EMAILS` — é esse email que vai ter acesso ao painel.

## Passo 3 — Criar a tua conta de administrador

1. Publica os ficheiros (ver Passo 4) ou abre `conta.html` no browser.
2. Cria uma conta normal com o **mesmo email** que puseste em `ADMIN_EMAILS`.
3. Depois disso, sempre que entrares com esse email, o `admin.html` vai
   reconhecer-te como administrador automaticamente.

## Passo 4 — Publicar o site

Podes usar qualquer serviço gratuito de hospedagem de sites estáticos:

- **GitHub Pages** (o que já usas na tua demonstração)
- **Netlify** ou **Vercel** (arrastar a pasta e publicar)

Importante: **envia a pasta toda junta** (`index.html`, `conta.html`,
`admin.html`, `manifest.json`, `sw.js`, `firebase-config.js`, os ícones)
para o mesmo sítio — todos os ficheiros trabalham em conjunto.

### Como publicar no GitHub Pages (passo a passo)

1. Vai a **https://github.com** e entra na tua conta (a mesma que usaste
   para o `godiandk.github.io`).
2. Clica no **"+"** no canto superior direito → **"New repository"**.
3. Dá um nome ao repositório, por exemplo `tecnova-digital`, marca como
   **Public**, e clica **"Create repository"**.
4. Dentro do repositório novo, clica em **"uploading an existing file"**
   (ou "Add file" → "Upload files").
5. Arrasta **todos os ficheiros** desta pasta `tecnova/` para essa janela
   (não arrastes a pasta em si — os ficheiros lá de dentro, todos juntos)
   e clica **"Commit changes"**.
6. Vai a **Settings** (dentro do repositório) → **Pages** (menu da
   esquerda) → em "Branch" escolhe **main** e pasta **/ (root)** → **Save**.
7. Espera 1 a 2 minutos. O GitHub mostra o endereço do teu site, algo como:
   `https://o-teu-utilizador.github.io/tecnova-digital/`
8. É esse o link que passas a usar no WhatsApp, no cartão, em todo o lado.

Sempre que quiseres atualizar o site (nova página, novo modelo, correção),
repete o passo 4 e 5 com os ficheiros novos — o GitHub substitui os antigos
automaticamente.

**Nota:** eu não tenho acesso à internet neste ambiente, por isso não
consigo publicar por ti diretamente — mas o processo acima demora uns
5 minutos e é exatamente o mesmo que já fizeste para o `godiandk.github.io`.
Se preferires, também posso preparar tudo para que outra pessoa (ou uma
ferramenta como o Claude para Chrome, se a tiveres disponível) faça o
upload por ti — é só avisares.

## Passo 5 — Proteger os dados (recomendado, 2 minutos)

Por padrão o Firestore em "modo de produção" já bloqueia tudo. Vai a
**Firestore Database → Regras** e cola isto:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /clientes/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
      allow read: if request.auth != null && request.auth.token.email in ['TEU_EMAIL_AQUI'];
    }
    match /vouchers/{code} {
      allow read: if request.auth != null &&
        (resource.data.clienteUid == request.auth.uid ||
         request.auth.token.email in ['TEU_EMAIL_AQUI']);
      allow write: if request.auth != null && request.auth.token.email in ['TEU_EMAIL_AQUI'];
    }
  }
}
```

Troca `TEU_EMAIL_AQUI` pelo teu email (o mesmo do `ADMIN_EMAILS`) e clica
**Publicar**.

---

## Como funciona no dia a dia

- **Cliente:** entra em `conta.html`, cria conta ou faz login, e vê os
  cupons que tu lhe deres.
- **Tu (admin):** entra em `admin.html` com o teu email de administrador.
  Vês a lista de todos os clientes registados, escolhes um, defines o
  desconto (% ou €) e geras um código único.
- **No momento da venda:** o cliente mostra-te o código (no telemóvel ou
  dito por WhatsApp), tu escreves no campo "Validar cupom" e clicas em
  verificar. Se for válido, o sistema marca-o logo como usado — **não pode
  ser usado uma segunda vez, por ninguém**.

## Sobre o "aplicativo"

O site já está preparado para funcionar como app instalável (PWA):
quando alguém visita o site pelo telemóvel (Android/Chrome), aparece a opção
**"Instalar app"** ou **"Adicionar ao ecrã principal"**. No iPhone, a pessoa
tem de tocar em Partilhar → "Adicionar ao ecrã de início" (o Safari não
mostra isto automaticamente, é uma limitação da Apple, não do nosso site).
Depois de instalado, abre em ecrã cheio, sem barra de endereço — exatamente
como uma app normal.

## Limitações importantes a saber

- Isto é uma solução **sem custos fixos** enquanto o número de clientes for
  pequeno/médio (o plano gratuito do Firebase cobre milhares de utilizadores
  por mês). Se o negócio crescer muito, pode passar a ter um custo mensal
  baixo — o Firebase avisa antes disso acontecer.
- As palavras-passe e o login são geridos pelo próprio Firebase (Google),
  que é o mesmo sistema usado por milhões de apps — é seguro para produção.
- Os ícones que criei são um ponto de partida simples com o "T" da marca;
  se quiseres um ícone mais elaborado (com o hexágono completo da logo),
  é só pedires que eu recrio com mais detalhe.
