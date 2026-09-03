# A mesa é a interface — Blackjack, Bacará, Poker, Truco

> "O jogo é jogado com opções de texto e caixas, e usa a mesa apenas como fundo de
> tela." — correto, e é isso que este documento resolve para os quatro jogos de carta.

## 0. Como este documento foi feito, e a regra que não muda

**Método**: nenhum APK foi descompilado, nenhum bundle foi extraído, nenhuma arte ou
código de terceiro foi copiado. O que foi estudado é conhecimento público de dois tipos:

1. **Convenção de mesa de cassino** — a ordem de distribuição, a tabela de compra da
   3ª carta do bacará, a regra de 17 do dealer, a posição do botão no heads-up — regras
   de jogo publicadas (manuais de cassino, regulamentos, literatura de matemática de
   jogos) e já citadas no próprio repositório (ver `truco.config.ts`, que cita
   `blog.copag.com.br`).
2. **Princípio de game feel e animação** — os 12 princípios de animação da Disney
   (Thomas & Johnson, *The Illusion of Life*), o livro *Game Feel* de Steve Swink, e o
   artigo já citado em `docs/mesa-de-verdade.md`
   ([dev.to/auroratide](https://dev.to/auroratide/a-more-realistic-card-flip-animation-3k9m))
   sobre por que uma carta se LEVANTA para virar.

O que é medido (as posições) vem de **varredura de pixel na própria arte do Casino
Inova**, com o método descrito na seção 1. O que é comportamento (a coreografia) é
**desenhado em cima** dessas posições medidas, seguindo convenção de mesa real — não
existe cópia de tela de concorrente em lugar nenhum deste documento.

**A regra de ouro, repetida porque ela organiza tudo o resto**: o servidor decide o
resultado da rodada inteiro ANTES de a animação começar. Isso já é verdade no código
atual — `BacBoMesaScreen.tsx` comenta *"O resultado inteiro já chegou. A espera abaixo é
só o tempo dos dados assentarem"* — e cada coreografia abaixo foi desenhada em cima
dessa mesma garantia: a animação **revela em ordem** algo que já está decidido, nunca
decide nada ela mesma. A seção 6 lista técnicas manipulativas comuns do setor e a
alternativa honesta escolhida para cada uma.

---

## 1. Metodologia de medição — reproduzível

As quatro artes (`app/assets/images/tampos-16x9/computador/{blackjack,bacara,poker,truco}.webp`)
são 1920×1080. O método:

1. **Carregar com PIL/numpy** e isolar os pixels "dourado/champanhe" — a cor de toda
   linha de regra impressa no feltro (círculos de aposta, molduras de carta, textos).
   O tom foi calibrado amostrando um pixel dentro da palavra "BLACKJACK PAGA 3 POR 2"
   (`(217, 201, 143)` no ponto mais claro) e afrouxando a faixa até cobrir também os
   tons mais escuros da mesma cor nas bordas anti-serrilhadas:

   ```python
   from PIL import Image
   import numpy as np

   im = Image.open('blackjack.webp').convert('RGB')
   arr = np.array(im).astype(int)
   R, G, B = arr[..., 0], arr[..., 1], arr[..., 2]
   mask = (R > 90) & (G > 70) & (R - B > 35) & (G - B > 15) & (R >= G) & (G >= B - 5)
   ```

2. **Componentes conectados (4-vizinhança)** sobre a máscara, sem depender de `scipy`
   (não está instalado neste ambiente) — um flood-fill simples com pilha, guardando
   bbox e centróide de cada mancha:

   ```python
   def connected_components(mask: np.ndarray):
       h, w = mask.shape
       visited = np.zeros((h, w), dtype=bool)
       comps = []
       ys, xs = np.nonzero(mask)
       for y0, x0 in zip(ys.tolist(), xs.tolist()):
           if visited[y0, x0]:
               continue
           stack, pixels = [(y0, x0)], []
           visited[y0, x0] = True
           while stack:
               y, x = stack.pop()
               pixels.append((y, x))
               for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
                   ny, nx = y+dy, x+dx
                   if 0<=ny<h and 0<=nx<w and mask[ny,nx] and not visited[ny,nx]:
                       visited[ny,nx] = True
                       stack.append((ny,nx))
           ys_p=[p[0] for p in pixels]; xs_p=[p[1] for p in pixels]
           comps.append({'size': len(pixels), 'ymin': min(ys_p), 'ymax': max(ys_p),
                         'xmin': min(xs_p), 'xmax': max(xs_p),
                         'cy': sum(ys_p)/len(pixels), 'cx': sum(xs_p)/len(pixels)})
       return comps
   ```

   Isto encontra de imediato formas fechadas e grossas: os sete círculos de aposta do
   blackjack, os retângulos NORTE/SUL/LESTE/OESTE do truco, a moldura da "vaza".

3. **Projeção em linha/coluna** para contornos finos que o anti-serrilhado quebra em
   fragmentos (os 4 slots de carta do bacará, os 5 slots comunitários do poker, os
   divisores JOGADOR|EMPATE|BANCA): soma a máscara ao longo de um eixo dentro de uma
   sub-região, e agrupa índices consecutivos onde a contagem passa de um limiar —
   equivalente a achar as bordas verticais/horizontais de um retângulo mesmo quando o
   traço não fecha como uma mancha única.

4. **Conferência visual**: cada zona medida foi recortada (`Image.crop`) e olhada antes
   de entrar neste documento — nenhum número abaixo é só saída de script sem checagem.

5. **Fração = pixel medido ÷ (1920, 1080)**, no mesmo formato de
   `AreaDaMesa.caixa: [esquerda, topo, direita, base]` de `mapaDosTampos.ts`. Isso é
   exatamente o que o comentário do arquivo já explica: fração vale em qualquer
   resolução porque `TampoDaMesa` calcula o retângulo real do `contain` e multiplica —
   não é pixel de screenshot copiado, é medida convertida.

Qualquer um dos quatro mapas abaixo pode ser refeito rodando os dois scripts acima
contra o `.webp` correspondente.

---

## 2. Blackjack

### 2.1 O mapa medido

A arte tem: sete casas de aposta em arco, um retângulo "DESCARTE" no canto superior
esquerdo, um shoe (sapata) dourado no canto superior direito, e uma faixa livre entre a
borda de couro e o arco de casas onde o dealer distribui (com o brasão "CI" e o texto de
regra impressos — texto que a mesa real também cobre com as cartas quando a mão está em
jogo).

```ts
// app/src/data/mapaDosTampos.ts — adição

/**
 * Blackjack. Sete casas em arco — a do centro é a mais funda (mais perto da câmera), as
 * duas das pontas são as mais altas, espelhando a curvatura real da mesa semicircular.
 * Medidas por varredura de cor dourada nos siete anéis impressos (ver seção 1 do
 * documento de lógica das mesas); a casa central (4) é onde o jogador único se senta.
 */
export const MAPA_BLACKJACK = {
  apostas: {
    casa1: { caixa: [0.183, 0.455, 0.251, 0.550], rotulo: 'Casa 1' },
    casa2: { caixa: [0.271, 0.535, 0.340, 0.663], rotulo: 'Casa 2' },
    casa3: { caixa: [0.361, 0.583, 0.431, 0.718], rotulo: 'Casa 3' },
    casa4: { caixa: [0.465, 0.599, 0.534, 0.736], rotulo: 'Sua casa' },
    casa5: { caixa: [0.568, 0.583, 0.643, 0.718], rotulo: 'Casa 5' },
    casa6: { caixa: [0.659, 0.535, 0.734, 0.663], rotulo: 'Casa 6' },
    casa7: { caixa: [0.747, 0.455, 0.816, 0.545], rotulo: 'Casa 7' },
  } satisfies Record<string, AreaDaMesa>,

  /** Retângulo "DESCARTE", canto superior esquerdo. */
  descarte: { caixa: [0.091, 0.271, 0.171, 0.380], rotulo: 'Monte de descarte' } as AreaDaMesa,

  /**
   * Boca do shoe (sapata) — o canto frontal-inferior-esquerdo do corpo dourado, que é
   * de onde a carta sai fisicamente numa sapata de verdade. O corpo inteiro do shoe
   * (incluindo a tampa inclinada) mede x:0.738–0.913, y:0.126–0.374; a boca é um ponto
   * dentro dessa caixa, não o centro dela.
   */
  shoe: { x: 0.760, y: 0.356 } as PontoDaMesa,

  /**
   * Faixa livre entre a borda interna do carrinho de couro (y=0.252) e o topo do arco
   * de casas (y=0.455) — onde o dealer distribui. Não há slot de carta impresso aqui:
   * na mesa de verdade o dealer também não tem um retângulo desenhado, só espaço.
   */
  faixaDoDealer: { topo: 0.252, base: 0.455 } as { topo: number; base: number },
} satisfies Record<string, unknown>;

/**
 * Onde a 1ª e a 2ª carta do dealer pousam, DENTRO de `faixaDoDealer`. Não está impresso
 * na arte (mesa de blackjack de verdade não tem "slot do dealer" desenhado — só espaço
 * livre acima do arco); estes dois pontos são a escolha de layout, ancorada nos limites
 * MEDIDOS da faixa, não em pixel chutado.
 */
export const CARTAS_DO_DEALER_BLACKJACK: PontoDaMesa[] = [
  { x: 0.478, y: 0.335 },
  { x: 0.522, y: 0.335 },
];

/**
 * Onde a mão do jogador pousa, uma casa acima de cada círculo de aposta — mesma
 * coluna X do centro da casa, deslocada 0,031 pra cima do topo medido do círculo (a
 * folga mínima pra a carta não tocar o anel impresso). Dividindo a mão (split), as
 * mãos extras usam as casas VIZINHAS (3 e 5, depois 2 e 6) em vez de inventar posição
 * nova — é o mesmo truque que terminais de blackjack single-player usam.
 */
export const CARTA_DO_JOGADOR_ACIMA_DA_CASA: Record<keyof typeof MAPA_BLACKJACK.apostas, PontoDaMesa> = {
  casa1: { x: 0.217, y: 0.424 },
  casa2: { x: 0.305, y: 0.504 },
  casa3: { x: 0.396, y: 0.552 },
  casa4: { x: 0.499, y: 0.568 },
  casa5: { x: 0.606, y: 0.552 },
  casa6: { x: 0.696, y: 0.504 },
  casa7: { x: 0.782, y: 0.424 },
};
```

**Como cada número foi obtido**: os sete círculos vieram de componentes conectados na
máscara dourada (a casa central tem bbox `(892,647)-(1025,795)` em pixel, por exemplo —
`958.5/1920=0.499` em x). O shoe e o descarte vieram da mesma máscara, restrita à
sub-região do canto (ver crops em `bj_discard_crop.png`/`bj_shoe_crop.png` gerados
durante a medição). A faixa do dealer é a distância entre a segunda linha da borda de
couro (`y=272px`) e o topo do círculo mais alto do arco (`y=491px`) — ambos medidos,
não estimados.

### 2.2 A coreografia, em cima do mapa

O servidor já entrega a mão inteira em uma resposta (`startBlackjackHand`): duas cartas
do jogador, a carta aberta do dealer, e a carta fechada do dealer é `null` até a mão
terminar. A ORDEM de saque já está fixada no motor —
`blackjack.service.ts` comenta: *"Na mesa as cartas saem alternadas: jogador, dealer,
jogador, dealer"* — então a coreografia só precisa **replicar essa ordem na tela**, ela
não inventa ordem nenhuma.

| t (ms) | evento | de → para | duração | curva |
|---:|---|---|---:|---|
| 0 | toque em "Distribuir" | — | `TEMPO.toque`=120ms de feedback no botão | `CURVA.saida` |
| 120 | carta 1 do jogador sai do shoe | shoe (0.760, 0.356) → casa4 (0.499, 0.568) | 620ms (`VOO_EM_MS` de `Carta.tsx`) | `Easing.linear` no voo (já é assim em `Carta.tsx`, a curva perceptível vem do atrito em `fisica.ts`, não do `Easing`) |
| 270 | carta 1 do dealer sai do shoe, ABERTA | shoe → dealer slot 1 (0.478, 0.335) | 620ms | idem |
| 420 | carta 2 do jogador | shoe → casa4 | 620ms | idem, `ATRASO_ENTRE_CARTAS`=150ms já embutido em `Carta.indice` |
| 570 | carta 2 do dealer, **de costas** (verso) | shoe → dealer slot 2 (0.522, 0.335) | 620ms | idem |
| ~1190 | 4ª carta pousa | — | — | fim da distribuição |
| 1190 | total do jogador aparece no selo | fade | `TEMPO.base`=260ms | `CURVA.suave` |
| 1190 | **se dealer mostra Ás**: pausa aqui, botões "Fazer seguro"/"Não quero" aparecem | — | `TEMPO.entrada`=420ms de entrada dos botões | `CURVA.entrada` |
| — | jogador decide (Pedir/Parar/Dobrar/Dividir) | cada carta nova usa o MESMO voo (shoe → casa4, ou casa vizinha se houve split) | 620ms por carta | idem |
| ao parar | carta fechada do dealer VIRA | `viragem` do `Carta.tsx` — sobe, estreita até de perfil, troca de face, desce | `TEMPO.entrada`=420ms | `CURVA.suave` |
| +100 | dealer compra até 17 (se precisar), uma carta de cada vez | shoe → dealer slot 3, 4… (deslocadas 0.03 em X a cada carta extra, "em leque" curto) | 620ms cada, 150ms de atraso entre elas | idem |
| +260 após a última carta do dealer | resultado anunciado: borda dourada/verde na casa vencedora (reaproveita `escolhida`/`vencedora` de `CasaDeAposta`) | — | `TEMPO.base` | `CURVA.suave` |
| +900 | saldo conta pra cima (`useContagem`, já existe em `ChipStack`) | — | `TEMPO.contagem`=900ms | — |

Nenhum destes tempos foi inventado do zero: `TEMPO`/`CURVA` são os tokens que já existem
em `app/src/animation/movimento.ts`, e `VOO_EM_MS`/`ATRASO_ENTRE_CARTAS` já existem em
`Carta.tsx`. A única coisa nova é o PONTO de origem e destino de cada voo, que passa a
vir do mapa medido em vez do deslocamento genérico fixo (`largura*2.4, -altura*1.1`) que
`Carta.tsx` usa hoje.

### 2.3 A lógica por trás de cada convenção

- **Por que jogador-dealer-jogador-dealer, e não jogador-jogador-dealer-dealer?** Numa
  mesa de verdade o dealer segura UMA carta por vez na mão — ele não consegue distribuir
  duas de uma vez. Alternar também é o que deixa todo mundo acompanhar o MESMO ritmo:
  ninguém vê a própria mão completa antes dos outros, o que importa em mesa
  multiplayer (mesmo esta versão sendo solo, a convenção existe por causa disso, e
  manter ela é o que faz a mesa "ler" como mesa e não como distribuição em lote). Fonte:
  é a ordem física do dealer, documentada em qualquer manual de operação de mesa (ex.:
  Kilby, Fox & Lucas, *Casino Operations Management*) e já replicada literalmente no
  comentário do motor deste repositório.

- **Por que a segunda carta do dealer é escondida até o fim?** É a mecânica central do
  blackjack: o jogador decide pedir/parar SEM saber se o dealer já tem 21. Esconder cria
  a decisão real (é risco genuíno, não teatro) — bem diferente de esconder informação só
  pra criar suspense artificial (ver seção 6). A carta escondida É jogo; a única
  diferença pra manipulação é que aqui a incerteza é **real e simétrica**: nem o
  jogador nem a interface sabem o valor até a hora certa, porque o servidor não manda
  esse valor pro cliente enquanto a mão está aberta — `cartasDoDealer` já vem `null` na
  segunda posição em `BlackjackHandResponse` (ver `app/src/api/blackjack.ts`). Não tem
  como a interface "trapacear mostrando cedo" porque o dado nem chega no cliente.

- **Por que a carta se levanta pra virar, em vez de girar rente ao pano?** Já documentado
  em `docs/mesa-de-verdade.md`, citando
  [dev.to/auroratide](https://dev.to/auroratide/a-more-realistic-card-flip-animation-3k9m):
  girando colada na mesa, a carta "atravessa" o feltro visualmente porque não há
  profundidade nenhuma acontecendo — o olho lê "textura mudando", não "objeto virando".

- **Por que o jogador sempre senta na casa 4 (centro), e as mãos de split usam as
  vizinhas?** A mesa impressa tem sete casas porque uma mesa FÍSICA de blackjack senta
  até sete pessoas. Este app é um contra o dealer, sozinho — sentar sempre no centro é a
  posição que, na mesa física, o jogador de fato escolhe quando pode escolher (mais
  visão da mesa, mais perto do dealer). Usar as casas vizinhas pro split, em vez de
  inventar uma posição fora do mapa, é literalmente o que terminais eletrônicos de
  blackjack single-player (as máquinas "Vegas Star"/"Blackjack Switch" de salão) fazem:
  a segunda mão nasce numa casa vizinha vazia, nunca sobrepõe a primeira.

- **Por que o seguro aparece só quando o dealer mostra Ás, e por que o texto já avisa que
  é ruim?** Isso já está certo no código (`blackjack.config.ts`: *"o seguro é a PIOR
  aposta da mesa"*) — é o modelo a seguir pros side bets do bacará (seção 3.3) e do
  próprio blackjack (Par Perfeito, 21+3), que hoje estão impressos na arte mas SEM
  motor nenhum por trás (ver seção 6.4).

### 2.4 O que muda no código

**Arquivo novo — `app/src/data/mapaDosTampos.ts`**: adicionar `MAPA_BLACKJACK`,
`CARTAS_DO_DEALER_BLACKJACK` e `CARTA_DO_JOGADOR_ACIMA_DA_CASA` (bloco 2.1 acima).

**Arquivo novo — `app/src/screens/games/BlackjackMesaScreen.tsx`**, no molde exato de
`BacBoMesaScreen.tsx`: `TampoDaMesa` com `TAMPOS_16X9.blackjack`, sete `<CasaDeAposta>`
(uma delas, `casa4`, sempre `escolhida`), e as cartas via um componente novo
`CartaNaMesa` (abaixo).

**Extensão necessária em `app/src/components/Carta.tsx`**: hoje o `deX`/`deY` do voo é
fixo (`largura*2.4, -altura*1.1` — sempre "de cima e da direita", não importa onde a
carta vai pousar). Para a carta sair de fato do shoe medido, o componente precisa
aceitar uma origem explícita, opcional, sem quebrar quem já usa `Carta` sem ela
(`BlackjackScreen`, `BaccaratScreen`, `TrucoScreen` antigos continuam funcionando
idênticos):

```tsx
// Carta.tsx — trecho alterado
interface CartaProps {
  carta: string | null;
  indice?: number;
  largura?: number;
  truco?: boolean;
  /** De onde a carta vem, em pixel relativo ao ponto de descanso. Default: o
   *  deslocamento genérico de sempre (de cima e da direita) — quem não passar isso
   *  continua vendo exatamente a mesma animação de hoje. */
  deX?: number;
  deY?: number;
}

export function Carta({ carta, indice = 0, largura = 62, truco = false, deX, deY }: CartaProps) {
  const altura = Math.round(largura * PROPORCAO);
  // ...
  const caminho = useMemo(
    () =>
      lancar({
        deX: deX ?? largura * 2.4,
        deY: deY ?? -altura * 1.1,
        giros: 0.75,
        passoDoGiro: 360,
        quantosQuiques: 1,
        alturaInicial: 0.55,
      }),
    [largura, altura, deX, deY],
  );
  // resto sem mudança
}
```

**Componente novo — `app/src/components/CartaNaMesa.tsx`**, no molde exato de
`DadoNoAgitador` (dentro de `BacBoMesaScreen.tsx`): converte um ponto do mapa (fração)
e um ponto de origem (fração) em pixel via `usePalco()`, e passa o delta pro `Carta`:

```tsx
import { PontoDaMesa } from '../data/mapaDosTampos';
import { usePalco } from './TampoDaMesa';
import { Carta } from './Carta';

interface CartaNaMesaProps {
  carta: string | null;
  pouso: PontoDaMesa;   // onde a carta fica, em fração do tampo
  origem: PontoDaMesa;  // de onde ela sai, em fração do tampo (ex.: MAPA_BLACKJACK.shoe)
  indice?: number;
  largura?: number;
  truco?: boolean;
}

export function CartaNaMesa({ carta, pouso, origem, indice, largura = 61, truco }: CartaNaMesaProps) {
  const palco = usePalco();
  if (!palco) return null;

  const pousoPx = { x: palco.esquerda + pouso.x * palco.largura, y: palco.topo + pouso.y * palco.altura };
  const origemPx = { x: palco.esquerda + origem.x * palco.largura, y: palco.topo + origem.y * palco.altura };

  return (
    <View style={{ position: 'absolute', left: pousoPx.x - largura / 2, top: pousoPx.y - (largura * 1.5) / 2 }}>
      <Carta
        carta={carta}
        indice={indice}
        largura={largura}
        truco={truco}
        deX={origemPx.x - pousoPx.x}
        deY={origemPx.y - pousoPx.y}
      />
    </View>
  );
}
```

Isso é o que faz a carta 1 (que pousa na casa 1, perto do shoe) voar uma distância
curta e quase reta, e a carta que pousa na casa 7 (do outro lado da mesa) voar bem mais
longe e mais de lado — geometricamente correto porque vem da posição REAL do shoe,
coisa que a versão genérica de hoje não tem como fazer (ela não sabe onde a carta vai
pousar).

**RTP em falta**: `BlackjackScreen.tsx` hoje não mostra RTP nenhum — diferente de
`BacBoScreen`, `SlotsScreen`, `RouletteScreen` e `BancaFrancesaScreen`, que já exibem
`RTP divulgado: …%`. Isso quebra a regra de ouro deste próprio projeto. O blackjack não
tem RTP fixo (depende de como o jogador joga — comentário exato em
`blackjack/verify-strategy.ts`), mas o motor já PROVA por simulação que a estratégia
básica fica entre 99,50% e 99,57% (vantagem da casa 0,43%–0,50%), número que também bate
com a literatura pública de matemática de jogos (ex.: Wizard of Odds, calculadora de
vantagem de blackjack, e Griffin, *The Theory of Blackjack*). A tela nova precisa expor
isso:

```ts
// blackjack.service.ts — getConfig()
return {
  minBet: MIN_BET, maxBet: MAX_BET, /* … campos já existentes … */,
  rtpComEstrategiaBasica: { min: 0.9950, max: 0.9957 },
};
```

```tsx
// BlackjackMesaScreen.tsx
<Text style={styles.rtpLabel}>
  RTP divulgado: 99,50%–99,57% com estratégia básica (vantagem da casa 0,43%–0,50%)
</Text>
```

---

## 3. Bacará

### 3.1 O mapa medido

A arte é a mais explícita das quatro: quatro retângulos de carta no topo (dois pro
JOGADOR, dois pra BANCA, com um vão entre eles), uma faixa comprida dividida em
JOGADOR|EMPATE|BANCA, duas caixas menores de side bet ("PAR DO JOGADOR", "PAR DA
BANCA") e o shoe no canto superior direito.

```ts
// app/src/data/mapaDosTampos.ts — adição

/**
 * Bacará. Quatro slots de carta em linha — os dois da esquerda são o JOGADOR, os dois
 * da direita a BANCA; o vão de 0,047 entre o slot 2 e o 3 é o mesmo vão medido na arte
 * (x:915–1005px), centrado no eixo da mesa (x=0,500). Medido por projeção de coluna
 * dentro da faixa y:396–459px — ver seção 1.
 */
export const MAPA_BACARA = {
  cartasJogador: [
    { x: 0.415, y: 0.396 },
    { x: 0.460, y: 0.396 },
  ] as PontoDaMesa[],
  cartasBanca: [
    { x: 0.540, y: 0.396 },
    { x: 0.583, y: 0.396 },
  ] as PontoDaMesa[],

  apostas: {
    jogador: { caixa: [0.230, 0.434, 0.422, 0.540], rotulo: 'Apostar no Jogador' },
    empate: { caixa: [0.422, 0.434, 0.578, 0.540], rotulo: 'Apostar no Empate' },
    banca: { caixa: [0.578, 0.434, 0.770, 0.540], rotulo: 'Apostar na Banca' },
  } satisfies Record<string, AreaDaMesa>,

  /**
   * Side bets impressas no feltro, SEM motor no servidor ainda (ver seção 6.4) — por
   * isso o mapa já as marca, mas a tela deve deixá-las visualmente presentes e
   * explicitamente inativas até o engine existir, nunca fingir uma jogada.
   */
  sideBets: {
    parJogador: { caixa: [0.264, 0.561, 0.416, 0.612], rotulo: 'Par do Jogador (em breve)' },
    parBanca: { caixa: [0.582, 0.550, 0.737, 0.613], rotulo: 'Par da Banca (em breve)' },
  } satisfies Record<string, AreaDaMesa>,

  /** Boca do shoe — canto frontal-inferior do corpo dourado, medido igual ao do blackjack. */
  shoe: { x: 0.786, y: 0.384 } as PontoDaMesa,
};
```

**Como cada número foi obtido**: os quatro slots vieram de uma projeção de coluna na
faixa `y:380–465px` (as bordas verticais dos quatro quadrados, em grupos de contagem
`>25` por coluna); a simetria bateu (`sq2.centro=882.5`, `sq3.centro=1037.5`,
distâncias ao centro da mesa quase idênticas: 77,5 e 77,5px). O trio JOGADOR|EMPATE|
BANCA veio da manancha grande da máscara (bbox `(442,469)-(1479,583)`) mais os dois
divisores internos, achados como colunas de contagem alta (`>20`) em `x≈810` e
`x≈1110`.

### 3.2 A coreografia

O servidor devolve a rodada **inteira pronta**: `playerCards`, `bankerCards` já com a
3ª carta (se houve), `winner`. `baccarat.engine.ts` documenta a ordem exata de saque —
*"Na mesa as cartas saem alternadas: jogador, banca, jogador, banca"* — e a tabela fixa
de quem compra a 3ª carta. A coreografia só replica essa ordem:

| t (ms) | evento | de → para | duração |
|---:|---|---|---:|
| 0 | toque em "Apostar" | — | 120ms |
| 120 | carta 1 do JOGADOR | shoe (0.786,0.384) → slot P1 (0.415,0.396) | 620ms |
| 270 | carta 1 da BANCA | shoe → slot B1 (0.540,0.396) | 620ms |
| 420 | carta 2 do JOGADOR | shoe → slot P2 (0.460,0.396) | 620ms |
| 570 | carta 2 da BANCA | shoe → slot B2 (0.583,0.396) | 620ms |
| ~1190 | totais de 2 cartas aparecem sob cada par (`handTotal`, já calculado no servidor) | fade | 260ms |
| **se houve 3ª carta** (regra fixa, sem decisão) — 1450 | 3ª carta do JOGADOR, se `playerTotal ≤ 5` | shoe → um **quinto ponto**, `{x:0.437, y:0.478}` (deslocado 0,08 abaixo da linha dos dois primeiros — é onde o crupiê de verdade desliza a 3ª carta, de lado e mais perto de si) | 620ms |
| +150 | 3ª carta da BANCA, se a tabela mandar | shoe → `{x:0.560, y:0.478}` | 620ms |
| +900 | resultado: a casa vencedora (`jogador`/`banca`/`empate`) acende com `vencedora` | borda dourada→verde | 260ms |
| +900 | roadmap (`RoadmapPanel`, já existe) recebe a nova célula do Bead Plate/Big Road | — | — |
| +1160 | saldo conta | — | 900ms |

A regra da 3ª carta (tabela do Punto Banco) já está 100% implementada e testada em
`baccarat.engine.ts`/`verify-regras.ts` — a coreografia não reimplementa nada disso, só
decide ONDE cada carta pousa e QUANDO ela aparece na tela, porque o servidor já mandou
o array completo (`playerCards.length` diz se houve 3ª carta ou não).

### 3.3 A lógica por trás

- **Por que jogador-banca-jogador-banca, igual ao blackjack?** Mesma razão física: um
  crupiê, uma carta de cada vez. No Punto Banco de verdade a convenção é ainda mais
  forte porque muitas mesas fazem o PRÓPRIO JOGADOR (quem apostou mais) pegar as cartas
  do "monte" e entregar pro crupiê — um ritual só possível porque a ordem é sempre
  fixa e alternada.

- **Por que a 3ª carta pousa deslocada, numa posição diferente das duas primeiras?**
  Numa mesa física a 3ª carta é onde o crupiê literalmente não tem mais "coluna"
  organizada — ele desliza ela de lado, meio virada, perto de onde está. Reproduzir
  isso (um quinto ponto, não uma terceira posição na mesma linha) é o detalhe que
  separa "mais uma carta na fileira" de "a exceção da regra automática" — que é
  exatamente o que a 3ª carta É: uma exceção controlada por tabela fixa, não uma
  escolha.

- **Por que EMPATE nunca recebe carta?** Porque EMPATE não é uma "mão" — é uma
  APOSTA sobre a relação entre as outras duas mãos. A arte já reflete isso (nenhum slot
  de carta sob o rótulo EMPATE), e o app não deve inventar um.

- **Por que o placar (roadmap) é a última coisa a atualizar, não a primeira?** As
  "estradas" (Bead Plate, Big Road, Big Eye Boy, Small Road, Cockroach Pig — as cinco já
  implementadas em `roadmap.service.ts`) existem pra ajudar quem quer acompanhar
  padrão histórico, e só fazem sentido depois que o resultado da rodada atual está
  fechado — atualizar antes seria mostrar uma célula "fantasma" antes do resultado
  estar anunciado.

### 3.4 O que muda no código

**Arquivo novo — `app/src/screens/games/BaccaratMesaScreen.tsx`**: `TampoDaMesa` com
`TAMPOS_16X9.bacara`, três `<CasaDeAposta>` (jogador/empate/banca — reaproveitando o
componente do Bac Bo sem alteração nenhuma, ele já é genérico), quatro a seis
`<CartaNaMesa>` (seção 2.4), `RoadmapPanel` reaproveitado como está.

```ts
// mapaDosTampos.ts — MAPA_BACARA (bloco 3.1)
```

**RTP em falta, igual ao blackjack**: `baccarat.service.ts::getConfig()` hoje devolve
só `{ minBet, maxBet }`. O motor já sabe o RTP de cada aposta — está documentado em
`verify-rtp.ts` e bate com a literatura pública (ex.: Wizard of Odds, apêndice de
bacará de 8 baralhos: banca ~98,94%, jogador ~98,76%, empate ~85,64%):

```ts
// baccarat.config.ts — acrescentar
/** Simulados em verify-rtp.ts com 1.000.000 de rodadas, sapata de 8 baralhos real. */
export const THEORETICAL_RTP: Record<BaccaratBetType, number> = {
  jogador: 0.9876,
  banca: 0.9894,
  empate: 0.8564,
};
```

```ts
// baccarat.service.ts
getConfig() {
  return { minBet: MIN_BET, maxBet: MAX_BET, theoreticalRtpByType: THEORETICAL_RTP };
}
```

```tsx
// BaccaratMesaScreen.tsx
<Text style={styles.rtpLabel}>
  RTP divulgado: Jogador {(config.theoreticalRtpByType.jogador * 100).toFixed(2)}% ·
  Banca {(config.theoreticalRtpByType.banca * 100).toFixed(2)}% ·
  Empate {(config.theoreticalRtpByType.empate * 100).toFixed(2)}%
</Text>
```

---

## 4. Poker — Texas Hold'em

### 4.1 O mapa medido

A arte tem: cinco slots comunitários no centro, um "POT" abaixo deles, e nove marcações
de carta-na-mão ao redor do perímetro oval — três retas no alto, duas diagonais nos
cantos de cima, duas retas nos lados, duas diagonais nos cantos de baixo. Não há shoe
desenhado, e isso está correto: Hold'em de verdade é distribuído à mão, de um baralho
único, não de sapata.

```ts
// app/src/data/mapaDosTampos.ts — adição

/**
 * Poker Texas Hold'em. Nove marcações de carta ao redor do perímetro — a arte é uma
 * mesa cheia de 9 lugares. Este app é heads-up (você contra o bot, ver
 * poker.config.ts), então só DUAS são usadas: `assentos[2]` (o de cima, centralizado —
 * "topcenter" na medição) pro bot, e um décimo ponto NÃO impresso, embaixo, pro
 * jogador — a câmera desta arte já está posicionada onde o crupiê/você estaria, então
 * não existe cadeira desenhada bem na sua frente, igual não existe foto do seu próprio
 * rosto quando você olha pra uma mesa de verdade.
 */
export const MAPA_POKER = {
  comunitarias: [
    { x: 0.379, y: 0.426 },
    { x: 0.439, y: 0.425 },
    { x: 0.498, y: 0.425 },
    { x: 0.557, y: 0.425 },
    { x: 0.616, y: 0.425 },
  ] as PontoDaMesa[],

  pote: { caixa: [0.352, 0.511, 0.644, 0.608], rotulo: 'Pote' } as AreaDaMesa,

  /** Os nove lugares da arte, na ordem impressa (sentido horário a partir do topo-esquerda). */
  assentos: [
    { x: 0.197, y: 0.311 }, // canto superior-esquerdo (diagonal)
    { x: 0.351, y: 0.267 }, // superior-1
    { x: 0.497, y: 0.269 }, // superior-centro — usado pelo bot
    { x: 0.649, y: 0.267 }, // superior-2
    { x: 0.794, y: 0.311 }, // canto superior-direito (diagonal)
    { x: 0.875, y: 0.482 }, // lado direito
    { x: 0.822, y: 0.677 }, // canto inferior-direito (diagonal)
    { x: 0.186, y: 0.675 }, // canto inferior-esquerdo (diagonal)
    { x: 0.122, y: 0.477 }, // lado esquerdo
  ] as PontoDaMesa[],

  /**
   * NÃO impresso na arte — é o vão entre os dois cantos inferiores, onde a câmera (e
   * portanto você) está. Derivado, não medido: ponto médio horizontal da mesa, logo
   * acima da borda de couro inferior (y da faixa livre entre o "POT" e o brasão "CI").
   */
  suaMao: { x: 0.500, y: 0.780 } as PontoDaMesa,
};
```

**Como cada número foi obtido**: os cinco slots comunitários vieram de projeção de
coluna (bordas em `x≈676,778,794,892,908,1006,1021,1119,1134,1230`, formando cinco
retângulos de ~98px de largura, y uniforme `413–505px`); os nove assentos vieram de
componentes conectados dentro de nove caixas-guia centradas visualmente e depois
confirmadas por simetria (ex.: assento superior-esquerdo `cx=378,1` e superior-direito
`cx=1523,7` — média `950,9`, a 7px do centro medido da mesa).

### 4.2 A coreografia

O servidor entrega o estado inteiro a cada ação (`PokerHandState`): `playerHole` e
`botHole` só vêm preenchidos quando `finished` (showdown) — durante a mão, o app nunca
recebe a mão do bot, então não tem como "vazar" ela nem por engano. `board` cresce por
rua: 0 cartas no pré-flop, 3 no flop (`match.board.push(...deck.splice(0,3))` — um push
só, as três chegam juntas), +1 no turn, +1 no river. A coreografia replica isso:

| momento | evento | de → para | duração |
|---|---|---|---:|
| nova mão | 2 cartas suas, viradas pra baixo | dealer point (0.500,0.780, o mesmo `suaMao` — na prática "de baixo da mesa") → hole 1 e hole 2, levemente abertas em leque (±6° cada) | 620ms, 150ms entre elas |
| nova mão | 2 cartas do bot, de costas | dealer point → `assentos[2]` (topo-centro) | 620ms, 150ms entre elas |
| pré-flop | *(sem cartas comunitárias ainda — pote mostra só os blinds)* | — | — |
| flop | 3 cartas comunitárias **juntas** | `suaMao`-equivalente (ponto do meio da mesa, y=0.780, x=0.5) → `comunitarias[0..2]` | 620ms cada, 150ms de atraso entre elas (nunca simultâneas — mesmo saindo "juntas" na resposta, a mesa de verdade também não consegue baixar 3 cartas ao mesmo tempo com uma mão só) |
| turn | 1 carta | mesmo ponto → `comunitarias[3]` | 620ms |
| river | 1 carta | mesmo ponto → `comunitarias[4]` | 620ms |
| showdown | suas hole cards viram (já estavam viradas pra você seria melhor — ver nota abaixo) | `viragem` do `Carta.tsx` | 420ms |
| showdown +150 | hole cards do bot viram | idem | 420ms |
| showdown +570 | rótulo da mão (`playerHandLabel`/`botHandLabel`, já vem do servidor) aparece sob cada par | fade | 260ms |
| showdown +830 | pote inteiro anima até o vencedor (`potWon`) — pilha de fichas desliza do centro pro lado vencedor | 500ms | `CURVA.elastica` |
| +1330 | saldo conta | — | 900ms |

**Nota importante sobre visibilidade**: diferente do bot, a SUA mão precisa estar
sempre visível pra você (nunca de costas) — isso não é escolha de coreografia, é
regra: o servidor já manda `playerHole` desde o início da mão (`PokerHandState.
playerHole` não é opcional), então a Carta do jogador nasce **já mostrando a frente**,
sem viragem — só a do bot nasce de costas e vira no showdown.

### 4.3 A lógica por trás

- **Por que não existe shoe na arte, e por que isso está certo?** Hold'em de cassino é
  distribuído à mão, de um baralho único embaralhado a cada mão — shoe é ferramenta de
  jogos multi-baralho (blackjack, bacará), não de pôquer. A arte respeitar essa
  diferença é o tipo de detalhe que separa "reaproveitar template genérico de mesa" de
  "entender o jogo": um pôquer com shoe desenhado estaria copiando convenção errada.

- **Por que "quem age primeiro" muda entre pré-flop e pós-flop?** É regra oficial de
  heads-up: no pré-flop o botão (posição do dealer) age primeiro; a partir do flop, o
  botão age por ÚLTIMO. O motor já implementa isso corretamente —
  `poker.service.ts` comenta *"no heads-up, o botão (você) age primeiro no pré-flop"* e
  *"pós-flop, quem não é o botão (o bot) age primeiro"*. É regra publicada de heads-up
  limit hold'em (qualquer livro de regras de torneio, ex. Tournament Directors
  Association), não invenção — a UI só precisa deixar claro DE QUEM é a vez, com o
  destaque visual já usado no Bac Bo (`travada`/turno).

- **Por que o flop chega em bloco de 3, mas turn e river um de cada vez?** Não é
  estética — é a regra: flop é UMA queimada + TRÊS cartas reveladas juntas; turn e
  river são cada um UMA queimada + UMA carta. A coreografia respeita isso porque o
  motor já respeita (`board.push(...deck.splice(0,3))` uma vez só no flop). Cada rua
  também é separada por uma rodada de apostas — dar as 5 cartas comunitárias de uma vez
  destruiria a única coisa que faz Hold'em ser Hold'em: a informação chegando em doses,
  com decisão entre cada dose.

- **Por que o pote desliza pro vencedor em vez de simplesmente "current balance"
  mudar?** No pôquer, ao contrário do blackjack/bacará, não existe "prêmio calculado" —
  existe um monte físico de fichas no centro que alguém leva. Uma animação que trata o
  pote como objeto (ele existe, ele se move, ele chega no lado de quem ganhou) é o que
  faz o jogador sentir que ganhou aquele dinheiro específico, não que um contador
  incrementou.

### 4.4 O que muda no código

**Conversão de carta**: `PokerCard` usa `{ rank: number (2–14), suit }`, mas
`CARD_IMAGES`/`Carta` esperam a chave string `"naipe-valor"` (`"copas-A"`, igual ao
blackjack). É preciso um adaptador pequeno, sem tocar no motor:

```ts
// app/src/data/gameAssets.ts — ou um novo app/src/data/pokerCartas.ts
const ROTULO_DO_RANK: Record<number, string> = {
  11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};
export function chaveDaCartaDePoker(card: PokerCard): string {
  const valor = ROTULO_DO_RANK[card.rank] ?? String(card.rank);
  return `${card.suit}-${valor}`;
}
```

**Arquivo novo — `app/src/screens/games/PokerMesaScreen.tsx`**: `TampoDaMesa` com
`TAMPOS_16X9.poker`; cinco `<CartaNaMesa>` para o board (reveladas conforme
`street`); duas para `playerHole` (sempre frente-para-cima); duas para `botHole`
(verso até `finished`); um indicador de vez (reutilizando o padrão `travada` de
`CasaDeAposta`, aplicado como um contorno em `assentos[2]` quando `toAct==='bot'`, e em
`suaMao` quando `toAct==='jogador'`).

**RTP**: pôquer heads-up não tem RTP no sentido de slot/mesa de banca — não existe
"vantagem programada da casa", o resultado depende só da força relativa das mãos e da
estratégia do bot (`decideBotAction`, uma heurística determinística dado o baralho
embaralhado de forma justa). A divulgação honesta aqui não é uma porcentagem, é a
ausência de rake:

```tsx
<Text style={styles.rtpLabel}>
  Sem rake: o pote inteiro (menos o que cada um apostou) vai pra quem ganha a mão.
  Você joga contra a estratégia do bot, não contra uma vantagem programada da casa.
</Text>
```

Isso fecha a mesma lacuna do blackjack/bacará: hoje `PokerScreen.tsx` não tem NENHUM
texto sobre isso, e devia ter — pela mesma regra de ouro.

---

## 5. Truco

### 5.1 O mapa medido

A arte tem quatro placas de assento — NORTE (topo), SUL (base, "Sul/Você" segundo
`docs/guia-das-mesas.md`), LESTE (direita), OESTE (esquerda) — e um retângulo central
arredondado, a "vaza", onde as quatro cartas jogadas na rodada se encontram.

```ts
// app/src/data/mapaDosTampos.ts — adição

/**
 * Truco. Quatro placas fixas — SUL é sempre "você": é convenção de jogo de mesa (ver
 * seção 5.3) que o assento mais perto da câmera/jogador seja sempre o seu, e os
 * `TrucoSeatView.seatIndex` do servidor precisam ser ROTACIONADOS na tela pra que
 * `isYou` caia sempre em `sul`, não no índice fixo.
 */
export const MAPA_TRUCO = {
  assentos: {
    norte: { caixa: [0.430, 0.231, 0.575, 0.276], rotulo: 'Norte' },
    sul: { caixa: [0.405, 0.687, 0.595, 0.762], rotulo: 'Sul — você' },
    leste: { caixa: [0.736, 0.392, 0.826, 0.536], rotulo: 'Leste' },
    oeste: { caixa: [0.174, 0.392, 0.265, 0.536], rotulo: 'Oeste' },
  } satisfies Record<string, AreaDaMesa>,

  /** A "vaza" — retângulo arredondado central onde as 4 cartas da rodada convergem. */
  vaza: { caixa: [0.244, 0.293, 0.755, 0.675], rotulo: 'Vaza' } as AreaDaMesa,

  /**
   * Onde a carta de CADA assento pousa dentro da vaza — não impresso (a arte só marca
   * o retângulo inteiro), derivado a 25%/75% da caixa medida acima: cada jogador joga
   * a carta pro lado da vaza mais perto de si, como numa mesa de verdade.
   */
  pousoNaVaza: {
    norte: { x: 0.499, y: 0.388 },
    sul: { x: 0.499, y: 0.579 },
    leste: { x: 0.628, y: 0.484 },
    oeste: { x: 0.372, y: 0.484 },
  } satisfies Record<string, PontoDaMesa>,
};

/**
 * O monte (baralho na mão) e a vira NÃO têm posição fixa impressa — porque no truco o
 * dealer RODA a cada mão (ao contrário do blackjack/bacará, onde o dealer é sempre a
 * casa). Este ponto é uma FUNÇÃO do assento de quem está distribuindo agora, não uma
 * fração fixa: 35% do caminho entre a placa do dealer e o centro da mesa (0.5, 0.5).
 */
export function pontoDoMonte(dealerSeat: 'norte' | 'sul' | 'leste' | 'oeste'): PontoDaMesa {
  const placa = centroDe(MAPA_TRUCO.assentos[dealerSeat]);
  const t = 0.35;
  return { x: placa.x + (0.5 - placa.x) * t, y: placa.y + (0.5 - placa.y) * t };
}
```

**Como cada número foi obtido**: as quatro placas vieram de componentes conectados
diretos na máscara dourada — cada uma é um retângulo fechado bem isolado (ex. OESTE:
bbox `(334,423)-(509,579)`, LESTE: `(1413,423)-(1585,579)`, simétricas ao centro da mesa
com erro menor que 1px). A vaza veio da maior mancha conectada da imagem inteira (bbox
`(469,316)-(1450,729)`, 4037 pixels dourados).

### 5.2 A coreografia

O truco é o único dos quatro jogos que já roda multiplayer de verdade via socket
(`TrucoMesaScreen.tsx`/`trucoMesa.ts`), então a coreografia precisa reagir a EVENTOS
(`truco:mesa-atualizada`), não a uma resposta única de HTTP.

| evento do servidor | o que a mesa mostra | de → para | duração |
|---|---|---|---:|
| `truco:comecar` | vira (se `variant==='paulista'`) sai do monte do dealer | `pontoDoMonte(dealerSeat)` → um ponto fixo ao lado do monte, virada pra cima | 620ms |
| `truco:comecar` | 3 cartas por jogador, uma rodada por vez (jogador 1 recebe sua 1ª, jogador 2 recebe sua 1ª… depois a 2ª de todos, depois a 3ª — nunca as 3 de um antes da 1ª do próximo) | `pontoDoMonte` → mão de cada assento (leque, 3 posições fixas por assento, viradas pra baixo exceto em `sul`, que é sempre você) | 620ms cada, 150ms entre elas |
| `truco:jogar-carta` | a carta jogada sai da mão daquele assento e pousa na vaza | mão do assento → `pousoNaVaza[assento]` | 620ms |
| `truco:jogar-carta` (mesa completa, 4 cartas na vaza) | pausa de leitura — as 4 cartas ficam visíveis | — | 700ms fixo, sempre igual (nunca "esticado" pra mãos mais valiosas — ver seção 6.3) |
| resolução da vaza | as 4 cartas da vaza deslizam pro canto de quem venceu a vaza (não somem — ficam visíveis, viradas, num monte pequeno perto da placa vencedora, contável) | vaza → placa da dupla vencedora | 420ms |
| `truco:pedir` / `truco:responder` | placar de aposta (1→3→6→9→12) atualiza com destaque | fade + escala | 260ms, `CURVA.elastica` |
| fim da mão | placar de pontos da dupla incrementa | contagem | 900ms |

### 5.3 A lógica por trás

- **Por que SUL é sempre você, e os outros assentos rotacionam?** É a convenção mais
  antiga de jogo de cartas em mesa: cada jogador vê o TABULEIRO a partir da própria
  posição, nunca de uma posição fixa de "norte é sempre o assento 0". Sem essa rotação,
  um jogador que se conecta como `seatIndex=2` veria sua própria mão desenhada do lado
  ERRADO da tela (em pé, de cabeça pra baixo, ou simplesmente numa placa que diz
  "Leste" enquanto ele pensa em si mesmo como "eu"). A regra prática:
  `assentoNaTela = (seatIndex - meuSeatIndex + 4) % 4`, mapeado pra
  `['sul','oeste','norte','leste']` (sentido anti-horário a partir de você, que é como
  as pessoas ao redor de uma mesa quadrada realmente se enxergam). Isso é convenção de
  jogo de tabuleiro/cartas em geral (xadrez online, UNO online, todo jogo de mesa com
  "assento" faz essa rotação) — não é nada específico de nenhum produto.

- **Por que o monte/vira segue o dealer, e não fica num ponto fixo da mesa?** Porque no
  truco (ao contrário do blackjack/bacará, onde a "banca" é sempre a casa, sempre no
  mesmo lugar) **quem embaralha e distribui muda a cada mão**, rotacionando entre os
  quatro jogadores — é regra do jogo, não escolha de mesa. Um shoe fixo, como o do
  blackjack, mentiria sobre quem está de mão. Ancorar o monte na placa de quem está
  distribuindo é a mesa contando visualmente uma informação de regra (de quem é a vez
  de dar), sem precisar de texto adicional.

- **Por que as cartas da vaza resolvida vão pro canto da dupla, em vez de sumir?** Numa
  mesa física as vazas ganhas ficam viradas, empilhadas, do lado de quem venceu — é
  assim que qualquer jogador pode CONFERIR quantas vazas cada dupla já fechou, sem
  precisar perguntar ou olhar um placar textual. Fazer a carta sumir seria esconder
  informação que uma mesa de verdade deixa à vista.

- **Por que a pausa de leitura da vaza completa é sempre 700ms, nunca mais em mão de
  manilha?** Ver seção 6.3 — esticar o tempo justamente nos momentos "emocionantes"
  é uma das técnicas manipulativas mais comuns do setor, e a alternativa honesta é
  tempo fixo, sempre.

### 5.4 O que muda no código

**Arquivo novo — `app/src/screens/games/TrucoMesaScreen2.tsx`** (ou substituindo o
socket-handling de `TrucoMesaScreen.tsx` por uma versão que usa `TampoDaMesa`): a
diferença central pro resto do app é que aqui a "mesa" já existe como estado
(`TrucoTableView.seats`), então o componente de rotação de assento é a peça nova:

```ts
// app/src/data/mapaDosTampos.ts ou um util novo app/src/data/rotacaoDeAssento.ts
const ORDEM_A_PARTIR_DE_VOCE = ['sul', 'oeste', 'norte', 'leste'] as const;

export function assentoNaTela(seatIndex: number, meuSeatIndex: number, totalSeats = 4) {
  const relativo = (seatIndex - meuSeatIndex + totalSeats) % totalSeats;
  return ORDEM_A_PARTIR_DE_VOCE[relativo];
}
```

```tsx
// TrucoMesaScreen — cada seat.seatIndex vira uma placa fixa via assentoNaTela()
{table.seats.map((seat) => {
  const posicao = assentoNaTela(seat.seatIndex, me?.seatIndex ?? 0);
  const area = MAPA_TRUCO.assentos[posicao];
  return <PlacaDeAssento key={seat.userId} area={area} seat={seat} />;
})}
```

**RTP**: truco é buy-in winner-takes-all contra o bot (ou contra outra dupla humana),
sem comissão nenhuma — `MATCH_WIN_TOTAL_MULTIPLIER = 2` em `truco.config.ts` devolve o
buy-in dobrado pra quem ganha, e mais nada é retido. A divulgação honesta, na mesma
linha do pôquer:

```tsx
<Text style={styles.rtpLabel}>
  Sem rake: quem ganha a partida leva o dobro do buy-in. A casa não fica com nada do
  que está em jogo entre você e o adversário.
</Text>
```

---

## 6. O que evitamos, e por quê — auditoria de manipulação

O pedido foi explícito: apontar qualquer técnica manipulativa comum do setor e propor a
alternativa honesta. Quatro entraram no design acima; aqui está o motivo de cada uma,
citando a literatura que documenta o problema.

### 6.1 "Quase ganhou" fabricado

**A técnica**: reforçar visualmente resultados que "quase" foram uma vitória — dado
que quase caiu no número certo, rolo de slot que para um símbolo acima do prêmio,
carta que "quase" formou uma sequência — porque efeitos de quase-vitória mantêm o
jogador engajado mais do que uma derrota clara. Documentado como *near-miss effect* na
literatura de psicologia do jogo (Harrigan & Dixon, sobre estrutura de PAR sheets em
slots; a Comissão de Jogos do Reino Unido trata "losses disguised as wins" e efeitos de
quase-vitória como prática a ser regulada).

**Onde entraria aqui**: no bacará, dar destaque extra (câmera lenta, zoom, som mais
alto) só quando o `playerTotal` e o `bankerTotal` ficam a 1 ponto de diferença; no
poker, "hesitar" a revelação do river só quando ele quase teria mudado o resultado.

**A alternativa escolhida**: toda coreografia acima usa tempo FIXO por evento
(620ms de voo, 150ms de atraso entre cartas, 260ms de fade de resultado),
**independente da margem do resultado**. Uma vitória por 9×0 no bacará e uma vitória
por 9×8 recebem exatamente a mesma cadência.

### 6.2 Som de vitória numa perda (losses disguised as wins)

**A técnica**: tocar som/animação de "vitória" quando o retorno é menor que a aposta
(comum em slots que celebram "você ganhou 20 fichas!" sobre uma aposta de 100 — perda
disfarçada de ganho). Documentado por Dixon et al. em estudos de fisiologia de
jogadores de slot (resposta de excitação idêntica entre ganhos reais e LDWs).

**A alternativa já existe no código, e foi só levada adiante**:
`BacBoMesaScreen.tsx` já distingue os três casos corretamente —
*"você recebeu"* (retorno > aposta, ganho real), *"voltou"* (retorno = aposta, push,
tom neutro) e *"não foi dessa vez"* (perda). Toda coreografia de blackjack/bacará/poker/
truco acima segue a MESMA distinção de três estados: comemoração (confete, som de
vitória, `CURVA.elastica`) só quando `totalReturn > totalStake` de verdade; tom neutro
em empate/push; nenhum efeito de vitória em derrota, mesmo que o jogador tenha
"acertado a aposta paralela e perdido a principal" (ex.: seguro pago mas mão perdida).

### 6.3 Suspense esticado de propósito

**A técnica**: alongar a animação especificamente nos momentos de maior tensão — segurar
o rolo girando um pouco mais quando ele vai parar perto (mas não em cima) do símbolo de
prêmio, ou demorar mais pra revelar a carta decisiva quando ela é boa. Isso é
diferente de "criar ritmo": ritmo fixo é design; ritmo que MUDA conforme o resultado
já sabido é manipulação, porque usa informação que só o servidor tem pra desenhar uma
experiência calibrada de suspense em cima de quem está jogando.

**A alternativa escolhida**: cada tabela de tempo nas seções 2–5 usa duração fixa por
tipo de evento. A pausa de leitura da vaza no truco é **sempre** 700ms, seja a vaza
mais банal ou a que decide a mão com as duas manilhas mais fortes na mesa. O river do
poker sempre leva 620ms pra pousar, ganhando ou perdendo o jogador. Isso é auditável:
qualquer pessoa pode cronometrar duas rodadas com resultados opostos e ver os mesmos
números.

### 6.4 Informação escondida pra pressionar

**A técnica**: esconder odds, RTP, ou o estado real de uma aposta até depois que o
jogador já se comprometeu — ou, no caso mais concreto encontrado NESTE código, imprimir
uma área de aposta no feltro ("Par Perfeito", "21+3", "Par do Jogador", "Par da Banca")
sem NENHUM motor por trás dela no servidor (confirmado por busca no repositório — ver
seção 6.4.1). Tornar essas áreas tocáveis sem um motor de verdade seria pior que a tela
antiga de texto: seria uma casa de aposta que aceita o toque e não faz nada de real, ou
pior, que calcula um "prêmio" só no cliente — violando a regra de ouro na cara.

**A alternativa escolhida**: os mapas de blackjack e bacará acima JÁ marcam essas áreas
(`sideBets` na seção 3.1), mas a recomendação explícita é: renderizá-las com o mesmo
rótulo dourado impresso na arte, e um estado visual "em breve" / desabilitado — nunca
fingir a jogada. Isso é o MESMO padrão que o seguro do blackjack já usa
(`esperandoSeguro`, com aviso explícito de que é a pior aposta da mesa) — a extensão
natural é aplicar esse padrão de honestidade também às side bets impressas que ainda
não têm motor, em vez de escondê-las (voltando a ser "papel de parede" nessa área
específica) ou fingi-las.

#### 6.4.1 Lacuna encontrada durante esta auditoria

Busca em `server/src` e `app/src` por `"par perfeito"`, `"21+3"`, `"par do jogador"`,
`"par da banca"` não retornou nenhum resultado — confirmando que a arte imprime quatro
apostas paralelas (Blackjack: Par Perfeito + 21+3, duas vezes cada, uma de cada lado da
mesa; Bacará: Par do Jogador + Par da Banca) que **não existem no motor**. Isso não é um
bug desta tarefa, mas é relevante pra ela: a conversão pra "mesa é a interface" é o
momento exato em que essa lacuna vira visível (porque agora a mesa É a interface, e
uma área impressa e nunca ligada chama mais atenção do que um botão que nunca existiu).
Recomendação: implementar os dois motores (ambos são side bets padrão de mercado, com
tabela de pagamento pública — 21+3 é uma combinação de blackjack + poker de 3 cartas,
Par Perfeito paga por par/par-do-mesmo-naipe nas duas primeiras cartas do jogador,
Par do Jogador/Banca paga se as duas primeiras cartas daquele lado formam par) antes de
tornar essas áreas tocáveis; até lá, mantê-las visíveis e claramente inativas.

### 6.5 O que já está certo, e deve continuar

Vale registrar o que o código já faz bem, porque a auditoria não é só lista de
problemas: o aviso explícito de que o seguro é "a pior aposta da mesa"
(`blackjack.config.ts`), a distinção de três tons em resultado do Bac Bo, e o RTP
divulgado em `BacBoScreen`/`SlotsScreen`/`RouletteScreen`/`BancaFrancesaScreen` são
exatamente o padrão a replicar — não a reinventar — nos quatro jogos deste documento.

---

## 7. Resumo do que muda, por arquivo

| arquivo | mudança |
|---|---|
| `app/src/data/mapaDosTampos.ts` | + `MAPA_BLACKJACK`, `CARTAS_DO_DEALER_BLACKJACK`, `CARTA_DO_JOGADOR_ACIMA_DA_CASA`, `MAPA_BACARA`, `MAPA_POKER`, `MAPA_TRUCO`, `pontoDoMonte()` |
| `app/src/components/Carta.tsx` | + props opcionais `deX`/`deY` (default = comportamento atual, sem quebra) |
| `app/src/components/CartaNaMesa.tsx` | **novo** — converte fração→pixel e liga origem/pouso medidos ao `Carta` |
| `app/src/data/rotacaoDeAssento.ts` | **novo** — `assentoNaTela()` pro truco |
| `app/src/data/pokerCartas.ts` | **novo** — `chaveDaCartaDePoker()` |
| `app/src/screens/games/BlackjackMesaScreen.tsx` | **novo**, molde de `BacBoMesaScreen.tsx` |
| `app/src/screens/games/BaccaratMesaScreen.tsx` | **novo**, idem |
| `app/src/screens/games/PokerMesaScreen.tsx` | **novo**, idem |
| `app/src/screens/games/TrucoMesaScreen.tsx` | reescrito pra usar `TampoDaMesa` + `assentoNaTela()` no lugar da lista de placares atual |
| `server/src/modules/games/blackjack/blackjack.service.ts` | `getConfig()` ganha `rtpComEstrategiaBasica` |
| `server/src/modules/games/baccarat/baccarat.config.ts` | + `THEORETICAL_RTP` |
| `server/src/modules/games/baccarat/baccarat.service.ts` | `getConfig()` ganha `theoreticalRtpByType` |

---

## 8. Fontes

- Ordem de distribuição, regra do 17, tabela de compra da 3ª carta: já implementadas e
  comentadas em `blackjack.engine.ts`/`blackjack.config.ts` e
  `baccarat.engine.ts`/`baccarat.config.ts` deste repositório; conferem com literatura
  padrão de regras de cassino (ex.: Kilby, Fox & Lucas, *Casino Operations Management*).
- RTP de blackjack com estratégia básica (99,50%–99,57%): `verify-strategy.ts` deste
  repositório; ordem de grandeza pública em Wizard of Odds (calculadora de vantagem de
  blackjack) e Griffin, *The Theory of Blackjack*.
- RTP de bacará de 8 baralhos (jogador ~98,76%, banca ~98,94%, empate ~85,64%):
  `verify-rtp.ts` deste repositório, simulado sobre a sapata real; ordem de grandeza
  pública no apêndice de bacará de Wizard of Odds.
- Regra posicional de heads-up (botão age primeiro pré-flop, por último pós-flop):
  regra publicada de limit hold'em heads-up (ex.: regras de torneio da Tournament
  Directors Association); já implementada em `poker.service.ts` deste repositório.
- Manilha/vira do truco paulista, truco mineiro: já citado em `truco.config.ts` deste
  repositório — `blog.copag.com.br`, `blog.megajogos.com.br`, `jogosdorei.com.br`
  (agosto/2026).
- Carta precisa se levantar da mesa pra virar, sem fundir com o pano: já citado em
  `docs/mesa-de-verdade.md` —
  [dev.to/auroratide, "A (more) realistic card flip animation"](https://dev.to/auroratide/a-more-realistic-card-flip-animation-3k9m).
- 12 princípios de animação (antecipação, follow-through, atrito): Thomas, Frank &
  Johnston, Ollie. *The Illusion of Life: Disney Animation* (1981).
- Game feel e resposta a input: Swink, Steve. *Game Feel: A Game Designer's Guide to
  Virtual Sensation* (2009).
- Efeito de quase-vitória (*near-miss*) e "perdas disfarçadas de vitória" (*losses
  disguised as wins*) como técnicas a evitar: Harrigan, K. & Dixon, M., trabalhos sobre
  estrutura de PAR sheets e reforço intermitente em slots; Dixon, M.J. et al., estudos
  de resposta fisiológica a LDWs em apostadores de slot; UK Gambling Commission,
  discussões públicas sobre design de jogo e "losses disguised as wins".
