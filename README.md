# TECNOVA Digital

Site institucional da TECNOVA Digital — Wesley Vianna, Fundador & CEO.
Site de vendas de criação de sites/apps para negócios locais, com área de
cliente e painel administrativo de cupões.

## Estrutura

- `index.html`, `servicos.html`, `pacotes.html`, `renovacao.html`, `sobre.html` — páginas institucionais (páginas reais, sem navegação por âncora)
- `modelos.html` + `modelo-*.html` — galeria de 6 modelos de site por tipo de negócio (Barbearia, Estética, Restaurante, Ginásio, Oficina, Salão)
- `conta.html` — login/registo de cliente (Firebase Authentication)
- `admin.html` — painel administrativo: lista de clientes, geração de cupões (por cliente, uso único) e validação de cupão
- `firebase-config.js` — configuração do Firebase (**precisa ser preenchida**, ver abaixo)
- `manifest.json` + `sw.js` — tornam o site instalável como PWA (sem loja de aplicativos, sem APK)
- `estilo.css` — estilo partilhado entre as páginas institucionais
- `img/wesley-vianna.jpg` — foto do fundador (usada em `sobre.html`)

## Pendente antes de usar o painel de clientes/cupões

1. Criar um projeto gratuito em https://console.firebase.google.com/
2. Ativar **Authentication → Email/Palavra-passe**
3. Criar o **Firestore Database** (modo produção)
4. Registar uma app Web no Firebase e copiar o `firebaseConfig`
5. Colar esses valores em `firebase-config.js`, e trocar o email de exemplo em `ADMIN_EMAILS` pelo e-mail real que vai administrar o painel
6. Aplicar as regras de segurança do Firestore (ver `INSTRUÇÕES.md`)

Sem isso, `index.html` e todas as páginas institucionais funcionam normalmente
— só `conta.html` e `admin.html` dependem do Firebase.

## Notas

- O "aplicativo" é apenas um PWA (instalável direto do navegador, sem App Store/Play Store/APK), por decisão explícita do projeto.
- Cada cupão gerado é vinculado a um único cliente e só pode ser validado uma única vez (a validação usa uma transação atômica no Firestore para evitar uso duplicado).
