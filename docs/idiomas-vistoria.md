# Vistoria de traduções — o que está coberto e o que não está

## COMO SE FAZ A VISTORIA

Não chega olhar para o ecrã. O dicionário procura a **chave** que o
`i18n.js` lhe entrega, e essa chave nem sempre é o texto que se vê:

- Num `<p>` só com texto, a chave é o texto.
- Num `<p>` com `<b>` lá dentro, a chave é o **HTML do elemento**, com o
  `<b>` incluído. Se essa chave não existir, o sistema desiste da frase
  inteira e parte-a nos `<b>` — e nenhum pedaço solto está no
  dicionário. Era isto que deixava parágrafos das páginas legais em
  português com o título traduzido por cima.

Por isso a vistoria pergunta à própria página. O guião abre cada página
em inglês e em espanhol e lê `el.__i18n_pt` de cada elemento e nó de
texto — que é exactamente o que o `i18n.js` foi procurar — e reporta os
que não têm entrada no dicionário.

## O QUE ESTÁ COBERTO

As 15 páginas do site: início, serviços, pacotes, modelos, orçamento,
pagamento, renovação, sobre, contacto, conta, app, e as quatro legais
(privacidade, termos, cookies, reembolso).

Sobram 17 linhas iguais nas três línguas, todas legítimas:

- nomes dos negócios de demonstração — Barbearia Império, AutoCentro
  Norte, Clínica Bella Pele, Inova Beauty, Sabor & Tradição, Studio
  Performance;
- o nome e o email do Wesley;
- frases em que o espanhol calha ser igual ao português: «entrega
  rápida», «Corte + Barba», «Clínica de Estética», «Antes de decidir».

## O QUE NÃO ESTÁ, E DE PROPÓSITO

**As 35 páginas dos modelos ficam em português.** Decisão do cliente, e
bate certo com a forma como foram construídas: não carregam o `i18n.js`
nem têm seletor de idioma. São sites de demonstração de negócios
portugueses inventados — uma barbearia em Portugal com o site em
português é o que um cliente espera ver.

Se um dia isso mudar, são cerca de 1500 frases, e é preciso primeiro
pôr o `i18n.js` e o seletor nessas páginas.

**O folheto A4** também fica: é para imprimir e distribuir cá.

**O texto desenhado dentro dos cartazes do carrossel** não passa por
aqui — esse tem três jogos de imagens, um por idioma. Ver
`cartazes-por-idioma.md`.

## VOLTAR A CORRER A VISTORIA

Depois de mexer em textos, vale a pena repetir. O guião está em
`scripts/` — abre cada página nas três línguas e diz que chaves faltam.
