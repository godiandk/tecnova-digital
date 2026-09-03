# Testar o Casino Inova sem ter computador

Sim, dá. Você não precisa de computador nenhum pra ver o jogo funcionando no seu iPhone.

Mas os dois caminhos não são iguais, e vale saber a diferença antes de escolher:

| | Precisa de computador? | O que você abre |
|---|---|---|
| **Expo Go** (`docs/como-testar-no-iphone.md`) | **Sim, obrigatório** | O app nativo, rodando pelo servidor do computador |
| **Publicar no Render** (este guia) | **Não** | O mesmo app, no Safari, por um endereço da internet |

O Expo Go precisa de computador porque ele não baixa o app de lugar nenhum: ele se
conecta a um servidor de desenvolvimento que roda na sua máquina. Sem máquina ligada,
não há a que se conectar.

Publicar resolve isso invertendo a coisa: o app passa a morar num servidor na internet,
que fica no ar sozinho, e o iPhone só precisa abrir um link.

---

## O que você vai precisar

- O **iPhone** (só ele mesmo)
- A conta do **GitHub** que já tem o projeto (`godiandk/tecnova-digital`)
- Uma conta no **Render** — de graça, criada com o próprio GitHub
- Uns **15 minutos**, sendo 10 deles só de espera

Nada pra instalar. Tudo acontece no Safari.

---

## Passo 1 — Criar a conta no Render

No Safari do iPhone, abra **render.com** e toque em **Get Started** → **GitHub**.

Ele vai pedir permissão pra ver seus repositórios. Aceite. O plano gratuito serve pra
testar — não pede cartão.

> Se o site abrir na versão de celular e ficar apertado, toque no **ᴀA** na barra de
> endereço do Safari → **Solicitar Site para Computador**. O painel do Render foi feito
> pra tela grande, e assim ele fica utilizável no telefone.

## Passo 2 — Apontar pro projeto

O Render monta tudo sozinho a partir de um arquivo que já está no repositório
(`render.yaml`, na raiz). Você não precisa configurar servidor, banco nem senha — está
tudo escrito lá.

O botão pra isso **não fica** no "New +". Ele tem endereço próprio:

**dashboard.render.com/blueprints**

Abra esse endereço e toque em **New Blueprint Instance**. Depois:

1. Escolha o repositório **tecnova-digital**
2. Escolha a branch **`claude/mobile-casino-tournaments-jdtyzb`**
3. Toque em **Apply**

## Passo 3 — Esperar

De 5 a 15 minutos na primeira vez. Ele está fazendo três coisas demoradas: criando o
banco Postgres, construindo o app web (são mais de 300 imagens de arte pra empacotar) e
compilando o servidor.

Pode fechar o Safari e voltar depois — a construção acontece lá, não no seu telefone.
Quando terminar, o serviço `casino-inova` aparece como **Live**, em verde.

As tabelas do banco são criadas sozinhas quando o servidor sobe. Você não roda comando
nenhum.

## Passo 4 — Abrir o jogo

No topo da página do serviço tem o endereço, algo como:

```
https://casino-inova.onrender.com
```

Toque nele. O jogo abre no Safari.

## Passo 5 — Criar sua conta

Toque em **Criar conta** e use qualquer e-mail e senha (a senha precisa de 8 letras ou
mais). A conta nasce com **10.000 fichas** — o bastante pra jogar em todas as mesas de
Bronze e ver o saldo mexer de verdade.

## Passo 6 — Virar ícone na tela do iPhone

Isto vale a pena, porque é o que faz parecer aplicativo de verdade:

1. Com o jogo aberto no Safari, toque no botão de **compartilhar** (o quadrado com a
   seta pra cima)
2. Role e toque em **Adicionar à Tela de Início**
3. Confirme

Vira um ícone junto dos outros apps e abre **sem a barra do navegador** — tela cheia,
igual a um aplicativo instalado.

---

## O que é diferente nesse caminho

**A primeira visita depois de horas parado demora uns 30 segundos.** O plano gratuito do
Render desliga o serviço quando ninguém está usando. Não é travamento: é ele acordando.
A segunda visita é imediata.

**O banco gratuito expira em 90 dias.** Pra testar, sobra. Depois disso, ou o plano pago
do Render ou o [Neon](https://neon.tech) (também gratuito) resolvem — no Neon é só trocar
o valor de `DATABASE_URL`.

**Você pode mandar o link pra qualquer pessoa.** É a maior vantagem deste caminho sobre o
Expo Go: o endereço existe pra todo mundo. Seu amigo abre no Android, você abre no
iPhone, e vocês jogam na mesma mesa.

**É o app web, não o nativo.** É o mesmo código e as mesmas telas — o projeto é feito pra
rodar nos dois. O que muda são detalhes de sistema: vibração no toque e notificação
empurrada não funcionam no Safari. Nada disso atrapalha testar o jogo.

---

## Quando algo não funciona

**O serviço fica vermelho, "Deploy failed"**
Toque em **Logs** e role até a primeira linha em vermelho. Me mande um print dela — o
erro está sempre escrito ali, e sem ele eu só chutaria.

**Abre a tela mas fica branca**
Recarregue uma vez. Se continuar branca, é o app web que não foi construído — os Logs
dizem, procure por `expo export`.

**"Erro de conexão" ao criar a conta**
O servidor está acordando (aqueles 30 segundos). Espere e tente de novo.

**Não acho "New Blueprint Instance"**
Você está na página errada. Blueprint não fica na lista do "New +"; o endereço é
**dashboard.render.com/blueprints**.

---

## Depois de estar no ar

Anote o que estiver feio ou errado e me mande, com print. O acabamento visual é a única
coisa que eu não consigo conferir daqui — eu vejo o código e as medidas, mas não vejo a
tela do seu telefone.
