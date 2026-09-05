# Vida Financeira

Aplicação web para controlo de contas pessoais: lançar entradas e saídas, ver
o saldo de cada mês e perceber para onde está a ir o dinheiro.

Funciona sem internet, instala-se como app a partir do próprio navegador (PWA,
sem App Store, sem Play Store, sem APK) e **não pede dados do banco**.

## Estrutura

- `index.html` — página de entrada (o que é, o que faz, como começar)
- `app.html` — o painel: lançar movimentos, saldo do mês, repartição por categoria
- `conta.html` — entrar / criar conta (Firebase Authentication, opcional)
- `sobre.html` — como funciona, onde ficam os dados, o que não é
- `estilo.css` — estilo partilhado por todas as páginas
- `app-financas.css` / `app-financas.js` — o painel
- `site.js` — menu, animações, estado da conta e registo do service worker
- `firebase-config.js` — ligação ao Firebase (**opcional**, ver abaixo)
- `firestore.rules` — regras de segurança da base de dados
- `manifest.json` + `sw.js` + `icon-*.png` — tornam o site instalável como app

## Onde ficam os dados

Por omissão, os movimentos ficam **só no navegador do dispositivo**
(`localStorage`). Não passam por servidor nenhum e continuam a funcionar sem
internet.

Se a pessoa criar conta e iniciar sessão, os mesmos movimentos passam também a
ser gravados no Firestore, em `utilizadores/{uid}`, para poderem ser vistos
noutro dispositivo. As regras em `firestore.rules` garantem que **cada conta só
lê os seus próprios movimentos** — não existe administrador com acesso a tudo.

## Firebase (opcional)

Sem configurar nada, `index.html`, `app.html` e `sobre.html` funcionam por
completo; só `conta.html` mostra um aviso a dizer que a conta está indisponível.

Para activar a sincronização entre dispositivos, siga o `INSTRUÇÕES.md`. Em
resumo:

1. Criar um projeto grátis em https://console.firebase.google.com/
2. Activar **Authentication → Email/Palavra-passe**
3. Criar o **Firestore Database** (modo produção)
4. Registar uma app Web e copiar o `firebaseConfig`
5. Colar esses valores em `firebase-config.js`
6. Publicar as regras de `firestore.rules`

## Publicar

São ficheiros estáticos — serve qualquer hospedagem gratuita (GitHub Pages,
Netlify, Vercel). Envie a pasta toda junta: os ficheiros dependem uns dos
outros. O `INSTRUÇÕES.md` tem o passo a passo do GitHub Pages.

## Notas

- O lançamento dos movimentos é manual, de propósito: não há leitura de
  extractos nem ligação a bancos.
- O botão **Exportar para Excel (CSV)** existe porque limpar os dados do
  navegador apaga os movimentos guardados localmente — convém ter cópia.
- O "aplicativo" é apenas um PWA, instalável direto do navegador.
