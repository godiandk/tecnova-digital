# Fazer o jogo parecer mesa, e não tela

Anotação do que mudou quando o pedido passou a ser "que pareça jogo de verdade, as
cartas em cima da mesa, os dados rolando".

## Primeiro, o que eu não consigo fazer

**Não assisto vídeo.** Não abro YouTube nem vejo imagem em movimento. Então a parte do
pedido que era "veja vídeos de cada jogo em 3D" eu não cumpro, e prefiro dizer isso a
fingir que vi. O que dá pra fazer é ler sobre como essas mesas são montadas, e aplicar o
que já se sabe de convenção de mesa de cassino.

## A decisão que importa: 3D de verdade ou mesa que se comporta?

Existem dois caminhos, e eles custam coisas muito diferentes.

**3D de verdade** (three.js dentro do app, via expo-gl): a mesa vira geometria, com
câmera em perspectiva, luz e sombra calculadas. Dá pra girar a câmera. O preço: cada uma
das dez telas é reconstruída como cena 3D, precisa de modelo e textura pra tudo, e o
desempenho em celular médio vira problema — ainda por cima com toda a interface (aposta,
chat, placar) tendo que ficar por cima, em 2D.

**Mesa que se comporta** (o caminho escolhido): a arte já É renderizada em 3D — as fotos
de mesa foram feitas de cima, em ângulo, com profundidade. O que faltava não era
geometria, era **comportamento**: os objetos apareciam no lugar em vez de chegarem nele.

A escolha foi a segunda, e o motivo é concreto: a arte que já existe é melhor do que
qualquer geometria em tempo real renderizaria num celular. Trocar por 3D de verdade seria
jogar fora a parte bonita pra ganhar uma câmera que ninguém pede pra girar. É também o
que os aplicativos grandes do ramo fazem — arte renderizada em ângulo, com objetos
animados por cima.

## O que faz o olho ler "mesa"

### 1. Objeto lançado tem trajetória, não posição
Dado e carta agora saem de fora do quadro e chegam ao lugar: atrito desacelerando,
giro que perde força, e o pouso exato no ponto de descanso. Está em
`app/src/animation/fisica.ts` — a curva é calculada uma vez em JavaScript e amostrada,
então a animação só interpola, sem cálculo por quadro.

### 2. Sombra é o que dá altura
Sem sombra, um objeto que sobe lê como "cresceu". A sombra fica no pano, não sobe junto,
e encolhe e clareia conforme o objeto se afasta. É o detalhe mais barato e o que mais
convence.

### 3. Quique decrescente, e cada vez mais junto
Quique de verdade não é só mais baixo a cada vez — é também mais rápido. A curva usa
`|sen|` com o tempo elevado a menos de 1, que aperta os últimos saltos.

### 4. Carta se levanta pra virar
Este veio da pesquisa e vale citar: *"pra virar uma carta de verdade você levanta ela da
mesa primeiro, senão ela se funde com o pano"*
([dev.to](https://dev.to/auroratide/a-more-realistic-card-flip-animation-3k9m)). A
viragem antiga girava colada na mesa. Agora a carta sobe, estreita até sumir de perfil,
troca de face nesse instante e desce.

### 5. Dado e carta param diferente
Dado pode parar em qualquer múltiplo de 90° — sempre sobra uma face pra cima. Carta tem
que fechar volta inteira. Isso não era parâmetro no começo, e a carta parava deitada de
lado uma vez a cada duas.

## O que continua valendo

A animação **não decide nada**. O resultado já veio do servidor antes de o objeto começar
a desacelerar; o movimento só conta o que já aconteceu. Nenhum dado é guiado pra uma face
e nenhum rolo para perto do prêmio de propósito — a taxa de retorno é a publicada.

## O que ainda falta pra fechar a sensação

- **Mão em leque.** As cartas do jogador ficam numa fileira reta. Mesa de verdade tem a
  mão aberta em leque, inclinada pra quem joga. É o maior sinal que ainda falta.
- **Fichas na mesa.** A aposta é um número. Devia ser pilha de ficha empurrada pro pano —
  a arte das quinze cores já está na pasta.
- **Cartas encostando uma na outra.** Carta dada nunca fica perfeitamente alinhada; um
  desencontro de poucos graus entre elas já muda muito.

## Fontes
- [A (more) realistic card flip animation](https://dev.to/auroratide/a-more-realistic-card-flip-animation-3k9m)
- [Building Interactive 3D Cards with Three.js](https://tympanus.net/codrops/2025/05/31/building-interactive-3d-cards-in-webflow-with-three-js/)
- [Three.js — 3D on the web (MDN)](https://developer.mozilla.org/en-US/docs/Games/Techniques/3D_on_the_web/Building_up_a_basic_demo_with_Three.js)
