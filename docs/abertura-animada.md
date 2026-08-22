# A abertura animada do site e da aplicação

## O QUE É

Um ecrã inteiro, cor da marca, com o monograma TECNOVA ao centro e um
traço dourado a girar à volta. Dura 7 segundos, incluindo a saída, e
depois desaparece. A página por baixo não recarrega nem muda de
endereço — o ecrã é só uma camada por cima.

## ONDE APARECE, E COM QUE REGRA

| | Ficheiro | Regra | Porquê |
|---|---|---|---|
| Site | `index.html` | `data-mode="session"` | Uma vez por sessão. Quem vai a «Pacotes» e volta não a vê outra vez. |
| Aplicação | `app.html` | `data-mode="always"` | Cada arranque. Quem abre a aplicação está a abri-la de propósito. |

Nas páginas internas não existe. Não é esquecimento: seria irritante.

## OS FICHEIROS

```
css/tecnova-splash.css        aparência, órbitas, brilho, responsividade
js/tecnova-splash.js          os 5 segundos, a sessão, a saída
img/splash/tecnova-mark.webp  o monograma, 512×512 com transparência
img/splash/icon-192.png       ícones da aplicação instalada
img/splash/icon-512.png
img/splash/icon-maskable-512.png
img/splash/apple-touch-icon.png
img/splash/ios/*.png          14 ecrãs estáticos do iOS
tools/test-splash.js          os quatro cenários, em Node
```

## O PRIMEIRO QUADRO NO TELEMÓVEL

O iPhone e o Android mostram um ecrã **estático** antes de existir HTML —
não há forma de o animar, e quem disser o contrário está a vender alguma
coisa. O que se pode fazer é que ele seja igual ao animado, para a
passagem de um para o outro não se ver:

- no Android, é o `background_color` do manifesto: passou a `#191411`,
  a mesma cor de fundo da animação;
- no iPhone, são os `apple-touch-startup-image` no `<head>` de
  `app.html` — 14 ficheiros, um por modelo. O Safari escolhe só o que
  bate certo com o aparelho, por isso não vão todos ao pré-cache do
  Service Worker: seriam 130 KB desperdiçados em cada instalação.

Foi por causa desta passagem que o logótipo teve de ficar no centro
exacto. Ver a secção seguinte.

## DUAS COISAS QUE FORAM CORRIGIDAS NO PACOTE

**O logótipo estava fora do centro.** O bloco tinha o palco, o nome e a
barra de progresso, e era o conjunto que ficava centrado — o logótipo
ficava 40px acima do meio. O ecrã estático do iPhone tem-no no centro
exacto, por isso ao passar de um para o outro via-se o salto. O nome e a
barra passaram a pendurar por baixo do palco, fora do fluxo, e o
logótipo ficou no centro.

**Empurrado 11px para a direita num telemóvel de 320px.** O bloco pedia
`min(92vw, 420px)` e o ecrã já tem 24px de margem de cada lado: pedia
294px numa área de 272 e a grelha, ao transbordar, empurrava-o. Passou a
`min(100%, 420px)`.

## SE ALGUMA COISA FALHAR

- **O JavaScript do splash não carrega:** há um temporizador no `<head>`
  que tira o ecrã aos 10,5 segundos — 3,5s depois do fim normal, para não
  ser ele a mandar embora uma abertura que estava a correr bem. Medido:
  liberta aos 10,5s.
- **JavaScript desligado:** o ecrã fica com `display:none` (só aparece
  com a classe `tecnova-js`, que o próprio JavaScript põe). O site abre
  normalmente.
- **«Reduzir movimento» ligado:** nada gira — e não deve mesmo girar. O
  que se vê é o cartaz parado, com o anel e o ponto a acender e a apagar.
  Acender não é movimento: é a única coisa que esta norma deixa fazer.
  Dura 2,6s em vez de 7. Medido: 2,8s.

  **Isto é a explicação para «apareceu e sumiu sem fazer a animação».**
  No iPhone: Definições → Acessibilidade → Movimento → Reduzir movimento.
  Com essa opção ligada, o site respeita-a — de propósito.

## AJUSTES

Tudo no atributo do `<div id="tecnova-splash">`:

- `data-duration="7000"` — a duração total, em milésimos de segundo;
- `data-fade="600"` — quanto tempo demora a desaparecer;
- `data-mode` — `session`, `always` ou `never` (para desligar).

## O QUE FOI PRECISO ANIMAR MAIS

O traço que gira tinha 2px e um quarto de volta de rasto. Medindo a
diferença entre dois fotogramas seguidos num ecrã de 390×844 davam 264
pontos: mexia-se, mas quase não se via. Ficou com 4px, meia volta de
rasto e o dobro do brilho; o ponto passou de 7px para 12px com halo a
sério; o monograma cresce de 0,86 para 1 no primeiro segundo; e há um
terceiro anel, por fora e mais lento, para dar profundidade.

A mesma medição depois: **566 e 608 pontos**, mais do dobro.

A órbita também abrandou — dava uma volta em 1,85s e agora leva 3,4s.
São duas voltas completas nos sete segundos, com tempo para as ver.

## O QUE FICOU POR DECIDIR

O ícone do separador do navegador (`icon-192.png` e
`apple-touch-icon.png` na raiz) continua a ser o «T» dentro do hexágono.
A aplicação instalada passou a usar o monograma ST, que é o que está nos
cartazes do carrossel e nesta abertura. São dois desenhos diferentes da
mesma marca. Trocar o da raiz muda o ícone em todas as páginas — fica à
espera de decisão.
