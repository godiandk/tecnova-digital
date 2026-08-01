# Vida Financeira — Guia de configuração

Este pacote tem: a página de entrada (`index.html`), o painel de contas
(`app.html`), a área de conta (`conta.html`), a página explicativa
(`sobre.html`) e os ficheiros que tornam o site instalável como app
(`manifest.json`, `sw.js`, ícones).

**Boa notícia:** para usar não é preciso configurar nada. Publique os ficheiros
e já funciona — os movimentos ficam guardados no próprio telemóvel.

O Firebase (Passos 1 a 3) só é preciso se quiser ver os mesmos movimentos no
telemóvel **e** no computador.

---

## Passo 0 — Experimentar já (sem configurar nada)

Abra o `index.html` no navegador. Vá a **"O meu mês"**, lance uma entrada e uma
saída, e veja o saldo a mudar. É assim que a aplicação vai funcionar para quem
não criar conta.

> Nota: aberto directamente do disco (`file://`), a instalação como app não
> funciona — isso só acontece depois de publicado (Passo 4).

---

## Passo 1 — Criar o projeto Firebase (grátis, opcional)

1. Vá a **https://console.firebase.google.com/**
2. Clique em **"Adicionar projeto"**, dê o nome `vida-financeira` e crie.
3. No menu da esquerda, entre em **Compilação (Build) → Authentication**
   → clique **"Começar"** → active o método **"Email/Palavra-passe"**.
4. Ainda no menu, entre em **Compilação → Firestore Database**
   → **"Criar base de dados"** → escolha **modo de produção** → escolha a
   região mais próxima (ex: `europe-west`).

## Passo 2 — Ligar o site ao seu Firebase

1. No Firebase, clique no ícone de engrenagem (canto superior esquerdo) →
   **Definições do projeto**.
2. Em baixo, em **"Os teus apps"**, clique no ícone **`</>`** (Web) e registe
   uma app com o nome `Vida Financeira`.
3. Vai aparecer um bloco de código chamado `firebaseConfig` — copie-o.
4. Abra o ficheiro **`firebase-config.js`** e cole os valores dentro das aspas,
   substituindo os `"COLE-AQUI"`.

Enquanto estiver `COLE-AQUI`, o site nem sequer tenta ligar-se ao Firebase —
funciona na mesma, só sem sincronização.

## Passo 3 — Publicar as regras de segurança

Isto é **obrigatório** se fez os passos 1 e 2. Sem isto, ou a base de dados
fica aberta a toda a gente, ou fechada a toda a gente.

1. No Firebase, vá a **Compilação → Firestore Database → separador "Regras"**.
2. Apague o que lá está e cole **todo o conteúdo** do ficheiro
   `firestore.rules` desta pasta.
3. Clique em **Publicar**.

As regras dizem uma coisa só: cada pessoa lê e escreve apenas o documento
`utilizadores/{a sua conta}`. Ninguém vê o dinheiro de outra pessoa — nem o
dono do site.

## Passo 4 — Publicar o site

Serve qualquer serviço gratuito de hospedagem de sites estáticos:

- **GitHub Pages**
- **Netlify** ou **Vercel** (arrastar a pasta e publicar)

Importante: **envie a pasta toda junta** (`index.html`, `app.html`,
`conta.html`, `sobre.html`, os `.css`, os `.js`, `manifest.json`, `sw.js` e os
ícones) para o mesmo sítio — todos os ficheiros trabalham em conjunto.

### Como publicar no GitHub Pages (passo a passo)

1. Vá a **https://github.com** e entre na sua conta.
2. Abra o repositório `vida-financeira`.
3. Clique em **Settings** (Definições) → no menu da esquerda, **Pages**.
4. Em **Source**, escolha **Deploy from a branch**.
5. Em **Branch**, escolha `main` e a pasta `/ (root)`. Clique **Save**.
6. Espere um ou dois minutos e recarregue a página. Vai aparecer o endereço,
   normalmente `https://<o-seu-utilizador>.github.io/vida-financeira/`.

### Se usou Firebase: autorizar o domínio

Depois de publicado, volte ao Firebase → **Authentication → Definições →
Domínios autorizados** e acrescente o domínio do site (por exemplo
`godiandk.github.io`). Sem isto, o "Entrar" dá erro no site publicado, mesmo
funcionando em local.

## Passo 5 — Instalar como app

Abra o endereço publicado no telemóvel:

- **Android (Chrome):** menu **⋮** → **Instalar aplicação**
- **iPhone (Safari):** botão **Partilhar** → **Adicionar ao ecrã principal**

Fica com um ícone no ecrã inicial e abre em ecrã inteiro, sem barra do
navegador. Não passa pela App Store nem pela Play Store.

---

## Perguntas que aparecem sempre

**Se limpar o histórico, perco tudo?**
Perde os movimentos guardados localmente, sim. Por isso há o botão **Exportar
para Excel (CSV)** no fundo do painel — e a opção de criar conta, que mantém
uma cópia na nuvem.

**Posso mudar as categorias?**
Sim. Estão no início do ficheiro `app-financas.js`, na lista `CATEGORIAS`. Cada
uma tem um `id`, um `nome` e um `emoji`. Não mude o `id` de categorias já
usadas, senão os movimentos antigos deixam de as encontrar.

**Posso mudar a moeda?**
Sim, no próprio painel, no fundo do formulário. A escolha fica guardada.

**Dá para várias pessoas na mesma conta?**
Não nesta versão. Cada conta tem o seu próprio conjunto de movimentos.
