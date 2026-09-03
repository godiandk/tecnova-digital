# A lógica da roda, dos rolos e dos dados

> Roleta Europeia · Caça-Níqueis (5 rolos) · Banca Francesa (3 dados) · Stock Market · Dominó

## Por que este documento existe

O dono do produto olhou o app e disse a verdade: "o jogo é jogado com opções de texto e
caixas, e usa a mesa apenas como fundo de tela". Na Roleta de hoje ninguém toca na roda —
toca num chip escrito "Vermelho · ×2". Numa mesa de verdade a ficha vai **no pano**: no
número, na linha entre dois números, no canto de quatro. A mesa é a interface, não o
cenário atrás dela.

Já existe um jogo nosso feito assim — Bac Bo. Os três arquivos abaixo são o padrão e o
ponto de partida de tudo que vem a seguir:

- `app/src/screens/games/BacBoMesaScreen.tsx`
- `app/src/components/CasaDeAposta.tsx`
- `app/src/data/mapaDosTampos.ts`

O método deles: posição é **fração do tampo** (0 a 1 em x e y), medida na arte
1920×1080 por varredura de cor com Python/PIL, e `TampoDaMesa`
(`app/src/components/TampoDaMesa.tsx`) converte fração em pixel a partir do retângulo
que o `resizeMode="contain"` produziu. Este documento faz o mesmo trabalho de medição
para os outros cinco jogos, explica a coreografia de cada rodada em milissegundos, e
explica **por que** cada tempo e cada convenção existem — não só o número, a razão do
número — porque é essa compreensão que separa inovar de copiar.

**A regra de ouro, que não muda:** o servidor decide o resultado *antes* de qualquer
animação começar. Em todos os cinco jogos abaixo o padrão é o mesmo que o Bac Bo já
usa — `await` na chamada da API, resultado inteiro na mão, *então* a animação começa. A
animação nunca sorteia nada; ela conta o que já aconteceu. Onde a pesquisa de mercado
encontrou uma técnica desenhada para manipular a percepção de quem joga, este documento
aponta a técnica e recusa ela explicitamente — ver a seção 7.

**O que eu não fiz:** não abri nenhum APK, não descompilei nada, não copiei código nem
arte de nenhum cassino. O que segue vem de três lugares — a arte que já é nossa (medida
com Python/PIL), o código que já é nosso (lido neste repositório) e conhecimento público
sobre convenção de mesa de cassino, física de animação e pesquisa de psicologia do jogo,
com fonte citada em cada afirmação factual (seção 8).

---

## 1. Método de medição

Cada tampo é `app/assets/images/tampos-16x9/computador/<jogo>.webp`, 1920×1080. O método,
igual nas cinco mesas:

1. **Varredura de cor** com `PIL` + `numpy`: cada elemento pintado no feltro (pocket
   vermelho/preto da roleta, losango de aposta, moldura dourada de uma casa) tem uma cor
   sólida que contrasta com o verde do feltro. Uma máscara booleana (`R>x & G>y & …`)
   isola essa cor; `scipy.ndimage.label` agrupa os pixels contíguos em blobs; o
   centróide de cada blob é a posição medida.
2. **Recorte com régua de pixel sobreposta** (marcas a cada 20px, com destaque a cada
   100px) para os casos em que a cor sozinha não separa o elemento do fundo — por
   exemplo, o pocket verde do zero da roleta é só um pouco mais claro que o próprio
   feltro (`RGB≈(7,98,27)` contra `RGB≈(5,86,24)`), então a leitura visual da régua bate
   com o centróide do algarismo branco por cima, que tem cor bem definida
   (`RGB≈(220-240,200-210,165-180)`).
3. **Checagem cruzada**: todo ponto medido por régua foi conferido contra pelo menos um
   ponto medido por cor (ou vice-versa) antes de entrar neste documento. Onde os dois
   métodos discordam por mais de ~1% da largura do tampo, o documento diz isso
   explicitamente em vez de escolher um número e seguir em frente.
4. **Fração, nunca pixel absoluto**: todo resultado vira `x/1920, y/1080`. É esse número
   que entra no código, do mesmo jeito que `mapaDosTampos.ts` já faz — funciona em
   qualquer tela porque `TampoDaMesa` já resolve o retângulo do `contain`.

A roleta pediu uma quinta técnica, porque o pano 0-36 é fotografado **em perspectiva**
(a arte é uma renderização 3D "de cima, em ângulo", não uma foto ortográfica de cima):
uma grade uniforme (`origem + coluna×passoX + linha×passoY`) erra várias dezenas de
pixels porque a grade real na tela é um **trapézio**, mais estreita no fundo (perto do
zero) que na frente (perto da fileira 34-35-36). A correção — interpolação bilinear dos
quatro cantos medidos — está detalhada na seção 2.1.

---

## 2. Roleta Europeia

### 2.1 O mapa medido

**A roda.** É uma elipse na tela (perspectiva, não um círculo ortográfico) — medida pela
caixa delimitadora do aro que gira (o aro com os números e os pockets, não a base de
madeira estática por baixo):

| | fração x | fração y |
|---|---|---|
| canto esquerdo do aro giratório | 0,0755 | — |
| canto direito | 0,3594 | — |
| canto de cima | — | 0,0880 |
| canto de baixo | — | 0,2037 |
| **centro** | **0,2175** | **0,1458** |
| raio horizontal | 0,1419 | |
| raio vertical | 0,0579 | |

A proporção `raioY/raioX ≈ 0,41` é o achatamento da elipse — é o número que diz o quanto
"espremer" verticalmente (`scaleY`) uma roda desenhada de frente (círculo) pra ela bater
com a perspectiva em que a mesa foi fotografada. A base de madeira (os aros estáticos por
baixo, sem número) ocupa uma caixa maior, `(0,0104 ; 0,0139)` a `(0,4323 ; 0,3981)` —
útil só como referência visual, não é onde a animação acontece.

**O zero.** Medido pelo algarismo branco "0" dentro do pocket verde (o pocket sozinho
tem baixíssimo contraste contra o feltro — ver seção 1): **(0,6005 ; 0,2130)**.

**A grade 0-36 — a fórmula, não 37 coordenadas soltas.** Медi os quatro cantos da grade
por varredura de cor (os quatro são pockets vermelhos: 1, 3, 34 e 36 — conferido contra
`roulette.config.ts`, que já teve a cor de cada número mapeada):

```
"1"  (linha 0,  coluna 0): x=1021,6  y=266,8  → fração (0,5321 ; 0,2470)
"3"  (linha 0,  coluna 2): x=1224,0  y=294,8  → fração (0,6375 ; 0,2730)
"34" (linha 11, coluna 0): x=669,7   y=718,9  → fração (0,3488 ; 0,6657)
"36" (linha 11, coluna 2): x=961,1   y=778,2  → fração (0,5006 ; 0,7206)
```

Uma grade "reta" (`origem + coluna × passoX + linha × passoY`) já erra visivelmente aqui
— a câmera está em ângulo, então a grade na tela é um trapézio, não um retângulo. A
correção certa para um plano fotografado em perspectiva é **interpolação bilinear entre
os quatro cantos** (equivalente, no limite de pouca distorção, a uma transformação
projetiva completa — testei as duas: a bilinear erra até ~3% da largura do tampo nos
pontos internos verificados, a projetiva completa erra ~0,3% em três dos quatro pontos
de checagem e pior em um — plausível ruído da minha própria régua de medição, não da
matemática. Fico com a bilinear no código por ser mais simples de ler e o erro residual
already cabe dentro do preenchimento (`padding`) que toda `CasaDeAposta` já tem).

A fórmula (`origem` = canto "1"; o vetor-coluna e o vetor-linha saem dos outros três
cantos; 3 colunas, 12 linhas):

```ts
export interface GradeBilinear {
  origem: PontoDaMesa;      // canto do número 1 — linha 0, coluna 0
  colFinal: PontoDaMesa;    // canto do número 3 — linha 0, coluna 2
  linhaFinal: PontoDaMesa;  // canto do número 34 — linha 11, coluna 0
  oposto: PontoDaMesa;      // canto do número 36 — linha 11, coluna 2 (fecha o trapézio)
  colunas: number;
  linhas: number;
}

/**
 * (linha, coluna) da grade 0-36 → fração do tampo, com a correção de perspectiva.
 *
 * Por que bilinear e não "origem + passo": a arte é uma renderização 3D em ângulo, não
 * uma foto de cima — a grade na TELA é um trapézio (mais estreita perto do zero, mais
 * larga perto da fileira 34-35-36), então um passo constante em x e y erra dezenas de
 * pixels. A bilinear interpola entre os quatro cantos medidos e absorve o trapézio.
 */
export function casaDaRoleta(grade: GradeBilinear, linha: number, coluna: number): PontoDaMesa {
  const u = coluna / (grade.colunas - 1);
  const v = linha / (grade.linhas - 1);
  const topoX = grade.origem.x + (grade.colFinal.x - grade.origem.x) * u;
  const topoY = grade.origem.y + (grade.colFinal.y - grade.origem.y) * u;
  const baseX = grade.linhaFinal.x + (grade.oposto.x - grade.linhaFinal.x) * u;
  const baseY = grade.linhaFinal.y + (grade.oposto.y - grade.linhaFinal.y) * u;
  return { x: topoX + (baseX - topoX) * v, y: topoY + (baseY - topoY) * v };
}

/** número (1-36) → {linha, coluna}, no leiaute padrão europeu (linha 0 = 1,2,3 … linha 11 = 34,35,36). */
export function linhaColunaDoNumero(numero: number): { linha: number; coluna: number } {
  const indice = numero - 1;
  return { linha: Math.floor(indice / 3), coluna: indice % 3 };
}
```

**As áreas externas — medidas, não redesenhadas.** Nossa configuração do servidor
(`roulette.config.ts`) tem nove apostas "de fora": `vermelho, preto, par, impar, baixo,
alto, duzia1, duzia2, duzia3`. A arte tem uma fileira de dúzias logo abaixo da grade e
uma segunda fileira com as demais — só que a segunda fileira tem **oito** células
impressas, não seis:

```
1-18 │ PAR │ ♦ vermelho │ ♦ preto │ VERMELHO │ PRETO │ ÍMPAR │ 19-36
```

Achado da medição, não invenção: a arte imprimiu **duas** células pra vermelho e **duas**
pra preto — um losango colorido (sem texto) e, mais adiante na mesma fileira, a palavra
escrita. Isso é redundância de uma peça de arte gerada, não uma convenção real de mesa —
e como as duas células de vermelho não são vizinhas (o losango preto fica *entre* elas),
não dá pra fundir as duas numa caixa só sem invadir a área do preto. A solução que
escolhi: cada uma das quatro células (losango vermelho, losango preto, palavra VERMELHO,
palavra PRETO) vira sua própria `CasaDeAposta`, e as duas do vermelho compartilham o
mesmo `onPress`/`escolhida` (o mesmo lance lógico) — o jogador pode tocar tanto o ícone
quanto a palavra, exatamente como uma mesa real às vezes tem mais de um jeito de indicar
a mesma aposta.

| aposta | centro medido (fração) | rótulo impresso |
|---|---|---|
| `baixo` | (0,1641 ; 0,7639) | "1-18" |
| `par` | (0,2354 ; 0,7630) | "PAR" |
| `vermelho` (losango) | (0,2984 ; 0,7880) | ♦ vermelho, sem texto |
| `preto` (losango) | (0,3813 ; 0,8250) | ♦ preto, sem texto |
| `vermelho` (texto) | (0,4568 ; 0,8491) | "VERMELHO" |
| `preto` (texto) | (0,5271 ; 0,8657) | "PRETO" |
| `impar` | (0,6052 ; 0,8843) | "ÍMPAR" |
| `alto` | (0,6849 ; 0,9046) | "19-36" |
| `duzia1` | (0,3125 ; 0,7546) | "1ª DOZENA" |
| `duzia2` | (0,4375 ; 0,7685) | "2ª DOZENA" |
| `duzia3` | (0,5521 ; 0,7824) | "3ª DOZENA" |

O tamanho de cada caixa saiu do espaçamento entre os centros vizinhos (a distância média
entre duas casas consecutivas da fileira externa é 143px ⇒ meia-largura ≈ 70px ⇒ fração
0,0365; a fileira de dúzias tem casas maiores, meia-largura ≈ 115px ⇒ fração 0,0599),
com meia-altura de 45px (0,0417) e 35px (0,0324) respectivamente — suficiente pra um alvo
de toque confortável sem invadir a casa vizinha.

### 2.2 A coreografia, em milissegundos

O jogo hoje é solo-instantâneo (sem cronômetro de mesa compartilhado — ver
`RouletteScreen.tsx`): a pessoa monta a aposta sem pressa, aperta um botão, e SÓ ENTÃO o
servidor decide. A coreografia é o que acontece entre o toque no botão e o número
acender no pano.

```
t=0ms       toque em "Girar" — todas as CasaDeAposta travam (prop `travada`),
            a roda e a bola JÁ começam o giro de espera (looping, sem destino)
t≈0-300ms   requisição em voo — a duração real da rede varia; a roda continua
            girando o tempo todo, então a espera de rede não trava o jogo visualmente
t=chegada   resposta do servidor chega com `pocket` (0-36) já sorteado — a
            ANIMAÇÃO AINDA NÃO SABE disso visualmente até este instante
t=chegada+0ms    calcula quantas voltas faltam a partir do ângulo ATUAL da roda
                 (sem salto — ela continua de onde estava, só acrescenta as
                 voltas que faltam) e inicia a desaceleração
t=chegada..+3800ms   roda desacelera (Easing.out(poly(4)) — já testado no
                 código atual) até a casa sorteada parar sob o marcador das 12h;
                 a bola desacelera JUNTO, terminando alinhada com a roda
t=chegada+3800ms    a bola dá um micro-quique final (NOVO — ver abaixo) e assenta
t=chegada+3850ms    o NÚMERO no pano (a casa medida em 2.1) acende dourado —
                 reaproveita `CasaDeAposta.vencedora`, o mesmo estilo que o Bac Bo
                 já usa pra casa vencedora
t=chegada+3850ms    um marcador (a "dolly" — ver 2.3) aparece sobre o número
                 vencedor, no pano, não só na roda
t=chegada+3900-4700ms   ChipStack conta o saldo novo subindo (TEMPO.contagem = 900ms,
                 já existe em `animation/movimento.ts`) e o texto de resultado aparece
```

**Números que eu mudo em relação ao componente atual** (`RodaDaRoleta.tsx` já existe e é
bom — a mudança é de posição e de um detalhe de física, não de reescrever do zero):

- `DURACAO_DA_PARADA` sobe de 3200ms pra **3800ms**. A razão está na seção 2.3.
- A bola ganha um **quique residual** no instante em que assenta — hoje ela só desacelera
  até zero e para seca. Isso é reaproveitar `app/src/animation/fisica.ts`: a mesma função
  `quiques()` que já dá ao dado do Bac Bo o salto decrescente serve pra um quique angular
  pequeno da bola (2-3 graus, decrescente, ~200ms) no fim do trajeto — é o mesmo princípio
  físico (objeto perdendo energia contra uma superfície com atrito), só que angular em vez
  de linear.

### 2.3 A lógica por trás — não só "gira 3800ms", mas por quê

**Por que existe uma janela de giro, se o resultado já está decidido?** Esta é a pergunta
que mais importa neste documento inteiro, porque a resposta errada leva a cortar a
animação (já que "não decide nada mesmo") e a resposta certa é o oposto.

Numa mesa física, o giro da roda **é** o mecanismo de justiça: ele é a fonte da
aleatoriedade, e por isso convenções como a exigência de **no mínimo 3 voltas completas**
da bola antes de valer o giro (senão o crupiê declara "no spin" e repete) existem — é
regra operacional documentada em manuais de procedimento de mesa para impedir que um
crupiê controle o resultado com um giro curto e calculado. Uma volta completa demora
tipicamente 8 a 15 segundos do lançamento da bola até ela cair, com a bola dando de 7 a
12 voltas na pista antes de cair e a roda em si girando por volta de 1,5 volta por
segundo — o crupiê solta a bola quando faltam 5 segundos pro fechamento das apostas
[fonte 1].

No nosso jogo o giro **não é** o mecanismo de justiça — o `Math.floor(random()*37)` já
rodou no servidor. Então por que manter os 3800ms em vez de revelar o número na hora?
Duas razões, e são diferentes uma da outra:

1. **Calibração de confiança.** Quem já viu uma roleta de verdade (em vídeo, em filme, ao
   vivo) tem uma expectativa treinada de quanto tempo um giro "honesto" leva. Pular direto
   pro número não economiza nada de real (o número já estava decidido do mesmo jeito) mas
   
   *parece* suspeito — perde a legibilidade do ritual sem ganhar nada em troca. Isto é
   puramente sobre leitura visual, não sobre mecanismo: o giro é teatro de um processo que
   já aconteceu, e o teatro precisa ser crível.
2. **A espera é o próprio jogo.** A literatura de design de jogos chama isso de
   "anticipation" — é um dos princípios centrais da animação clássica (Disney's 12
   Principles) e é citado explicitamente como técnica de "juice" (dar vida e resposta a
   cada ação) na palestra de referência da área, *Juice It or Lose It*, de Martin Jonasson
   e Petri Purho (GDC Europe 2012) [fonte 2]. Não é enganar ninguém — é dar ao instante
   entre apostar e saber um peso proporcional ao que está em jogo. Um giro de roleta que
   resolve em 200ms não é "mais eficiente", é um jogo pior: tira exatamente a parte que
   as pessoas pagam pra sentir.

Dado isso, por que **3800ms** e não os 8-15 segundos reais? Porque as duas razões acima
pedem coisas diferentes: a calibração de confiança quer "parece real", não "é do mesmo
tamanho que o real" — e a Roleta aqui é uma entre cinco jogos dentro de um saguão, jogada
em rajadas curtas num celular, não uma transmissão ao vivo de um crupiê. 3800ms é
compressão deliberada da física real pro ritmo de um app: perto o bastante do que a
memória de "como uma roleta de verdade se sente" reconhece, curto o bastante pra não
cansar quem quer jogar dez rodadas seguidas. (O valor anterior no código, 3200ms, já
estava nessa faixa — a mudança pra 3800ms é só alongar um pouco a desaceleração final,
que é a parte mais lida pelo olho, sem alongar o giro de espera em si.)

**Por que a bola e a roda giram em sentidos opostos?** Não é estética gratuita — é como
uma roda física funciona: o crupiê lança a bola na pista externa fixa contra o sentido em
que o rotor (com os números) gira, porque uma bola lançada no mesmo sentido do rotor não
perde velocidade relativa rápido o bastante pra cair de forma legível; o atrito entre a
bola e a pista, mais a inclinação da pista, é o que desacelera e derruba a bola pros
defletores e daí pros pockets [fonte 5]. O componente atual já acerta isso (sentidos
opostos, velocidades diferentes) — mantenho.

**Por que o marcador (a "dolly") pousa no número do PANO, não só na roda?** Numa mesa
real, depois que a bola assenta o crupiê **coloca um marcador de dinheiro** (chamado
"dolly") em cima do número vencedor **na própria grade impressa**, não na roda — é o
sinal visual que todo mundo na mesa lê pra saber quem ganhou e pra parar de apostar
antes das fichas serem recolhidas. Uma tela que só mostra o número na roda (que é pequena
e gira demais pra ler em celular — problema que a `RouletteScreen` atual já tenta
remendar com um "selo" avulso sobre o cubo da roda) está reconstruindo metade da
convenção. A versão de mesa acerta isso: o brilho dourado que acende é a **casa da
grade**, exatamente como a mesa física faz — o dolly, não um número boiando perto do
eixo.

### 2.4 O que muda no código

**Novo arquivo de dados** — adicionar a `app/src/data/mapaDosTampos.ts` (junto de
`MAPA_BAC_BO`, mesmo arquivo, mesmo padrão):

```ts
export interface GradeBilinear {
  origem: PontoDaMesa;
  colFinal: PontoDaMesa;
  linhaFinal: PontoDaMesa;
  oposto: PontoDaMesa;
  colunas: number;
  linhas: number;
}

export function casaDaRoleta(grade: GradeBilinear, linha: number, coluna: number): PontoDaMesa {
  const u = coluna / (grade.colunas - 1);
  const v = linha / (grade.linhas - 1);
  const topoX = grade.origem.x + (grade.colFinal.x - grade.origem.x) * u;
  const topoY = grade.origem.y + (grade.colFinal.y - grade.origem.y) * u;
  const baseX = grade.linhaFinal.x + (grade.oposto.x - grade.linhaFinal.x) * u;
  const baseY = grade.linhaFinal.y + (grade.oposto.y - grade.linhaFinal.y) * u;
  return { x: topoX + (baseX - topoX) * v, y: topoY + (baseY - topoY) * v };
}

export function linhaColunaDoNumero(numero: number) {
  const indice = numero - 1;
  return { linha: Math.floor(indice / 3), coluna: indice % 3 };
}

/**
 * Roleta Europeia. A grade 0-36 é medida por INTERPOLAÇÃO BILINEAR de quatro cantos
 * (os números 1, 3, 34 e 36 — todos vermelhos, achados por varredura de cor), porque a
 * arte é uma renderização em perspectiva: um passo reto em x/y erra até ~3% da largura
 * do tampo. Ver docs/logica-roda-rolos-dados.md §2.1 pro método completo.
 */
export const MAPA_ROLETA = {
  grade: {
    origem: { x: 0.5321, y: 0.2470 },
    colFinal: { x: 0.6375, y: 0.2730 },
    linhaFinal: { x: 0.3488, y: 0.6657 },
    oposto: { x: 0.5006, y: 0.7206 },
    colunas: 3,
    linhas: 12,
  } satisfies GradeBilinear,
  zero: { x: 0.6005, y: 0.2130 } as PontoDaMesa,
  roda: {
    centro: { x: 0.2175, y: 0.1458 } as PontoDaMesa,
    raioX: 0.1419,
    raioY: 0.0579,
  },
  apostas: {
    baixo: { caixa: [0.1276, 0.7222, 0.2006, 0.8056], rotulo: '1 a 18' },
    par: { caixa: [0.1989, 0.7213, 0.2719, 0.8046], rotulo: 'Par' },
    impar: { caixa: [0.5687, 0.8426, 0.6417, 0.9259], rotulo: 'Ímpar' },
    alto: { caixa: [0.6484, 0.8630, 0.7214, 0.9463], rotulo: '19 a 36' },
    duzia1: { caixa: [0.2526, 0.7222, 0.3724, 0.7870], rotulo: '1ª dúzia' },
    duzia2: { caixa: [0.3776, 0.7361, 0.4974, 0.8009], rotulo: '2ª dúzia' },
    duzia3: { caixa: [0.4922, 0.7500, 0.6120, 0.8148], rotulo: '3ª dúzia' },
  } satisfies Record<string, AreaDaMesa>,
  /** vermelho e preto têm DUAS casas cada (losango + palavra) — ver §2.1. */
  apostasDuplas: {
    vermelho: [
      { caixa: [0.2619, 0.7463, 0.3349, 0.8296], rotulo: 'Vermelho' },
      { caixa: [0.4203, 0.8074, 0.4932, 0.8907], rotulo: 'Vermelho' },
    ],
    preto: [
      { caixa: [0.3448, 0.7833, 0.4177, 0.8667], rotulo: 'Preto' },
      { caixa: [0.4906, 0.8241, 0.5636, 0.9074], rotulo: 'Preto' },
    ],
  } satisfies Record<string, AreaDaMesa[]>,
};
```

**Arquivo novo, `RoletaMesaScreen.tsx`** (espelha `BacBoMesaScreen.tsx`):

```tsx
export function RoletaMesaScreen({ navigation }: { navigation: { goBack: () => void } }) {
  // ...estados iguais ao BacBoMesaScreen: config, saldo, apostas, rolando, resultado...

  return (
    <TampoDaMesa computador={TAMPOS_16X9.roleta.computador} tablet={TAMPOS_16X9.roleta.tablet}>
      {/* --- Os 36 números, calculados pela fórmula, não hardcoded --- */}
      {Array.from({ length: 36 }, (_, i) => i + 1).map((numero) => {
        const { linha, coluna } = linhaColunaDoNumero(numero);
        const ponto = casaDaRoleta(MAPA_ROLETA.grade, linha, coluna);
        return (
          <CasaDoNumero
            key={numero}
            numero={numero}
            ponto={ponto}
            apostado={apostado('numero', numero)}
            vencedor={resultado?.pocket === numero}
            onPress={() => alternarNumero(numero)}
          />
        );
      })}
      <CasaDoNumero numero={0} ponto={MAPA_ROLETA.zero} apostado={apostado('numero', 0)}
        vencedor={resultado?.pocket === 0} onPress={() => alternarNumero(0)} />

      {/* --- As nove apostas externas --- */}
      {Object.entries(MAPA_ROLETA.apostas).map(([tipo, area]) => (
        <CasaDeAposta key={tipo} area={area} valor={apostado(tipo)}
          escolhida={escolhidas.has(tipo)} travada={rolando}
          vencedora={apostaGanhou(tipo, resultado)} onPress={() => alternar(tipo)} />
      ))}
      {(['vermelho', 'preto'] as const).flatMap((tipo) =>
        MAPA_ROLETA.apostasDuplas[tipo].map((area, i) => (
          <CasaDeAposta key={`${tipo}-${i}`} area={area} valor={apostado(tipo)}
            escolhida={escolhidas.has(tipo)} travada={rolando}
            vencedora={apostaGanhou(tipo, resultado)} onPress={() => alternar(tipo)} />
        )),
      )}

      {/* --- A roda, posicionada e ACHATADA pra bater com a perspectiva do pano --- */}
      <RodaNoPano resultado={resultado?.pocket ?? null} girando={rolando} />

      {/* --- controles (saldo, valor por ficha, botão "Girar") fora do pano, como no Bac Bo --- */}
    </TampoDaMesa>
  );
}

/** Posiciona a RodaDaRoleta existente no ponto medido, com o achatamento da elipse. */
function RodaNoPano({ resultado, girando }: { resultado: number | null; girando: boolean }) {
  const palco = usePalco();
  if (!palco) return null;
  const diametro = palco.largura * MAPA_ROLETA.roda.raioX * 2;
  const achatamento = MAPA_ROLETA.roda.raioY / MAPA_ROLETA.roda.raioX; // ≈0,41
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: palco.esquerda + MAPA_ROLETA.roda.centro.x * palco.largura - diametro / 2,
        top: palco.topo + MAPA_ROLETA.roda.centro.y * palco.altura - (diametro * achatamento) / 2,
        transform: [{ scaleY: achatamento }],
      }}
    >
      <RodaDaRoleta resultado={resultado} girando={girando} tamanho={diametro} />
    </View>
  );
}
```

**`RodaDaRoleta.tsx`** — duas mudanças pequenas, o resto fica:

```ts
// era 3200
const DURACAO_DA_PARADA = 3800;
```

```ts
// dentro do useEffect, depois de setar o ângulo final da bola: um quique residual
// pequeno, reaproveitando a MESMA curva de atrito que o dado já usa em fisica.ts
anguloDaBola.value = withSequence(
  withTiming(destino, { duration: DURACAO_DA_PARADA, easing: Easing.out(Easing.poly(4)) }),
  withTiming(destino + 2.2, { duration: 90, easing: Easing.out(Easing.quad) }),
  withTiming(destino, { duration: 130, easing: Easing.out(Easing.quad) }),
);
```

**Marcador do número vencedor (novo, pequeno componente)** — reaproveita
`CasaDeAposta.vencedora` (já existe, já é usado pelo Bac Bo) pra acender a casa do
número; o "dolly" em si é um círculo dourado simples com `expo-linear-gradient`,
posicionado pelo mesmo `casaDaRoleta(...)` que desenhou a casa.

---

## 3. Caça-Níqueis (5 rolos)

### 3.1 O mapa medido

O gabinete art déco de `slots.webp` mostra cinco tambores cilíndricos **vazios** (sem
símbolo pintado — exatamente como `tampos-16x9-regras.md` pede: "Não fixar saldo, aposta,
prêmio, paylines ou botão GIRAR na arte-base"). Medi as costuras entre tambores por
varredura de **brilho** (soma R+G+B ao longo de uma linha horizontal em y=500):
cada costura é um vale de brilho nítido entre dois platôs claros.

```
bordas dos rolos (fração x): 0,2682 | 0,3568 | 0,4490 | 0,5510 | 0,6438 | 0,7323
topo da janela visível: fração y = 0,3611
base da janela visível: fração y = 0,6250
```

Os cinco rolos não têm exatamente a mesma largura (o do meio é levemente mais largo —
0,1020 de fração contra ~0,0886-0,0928 dos outros), o que é esperado numa renderização em
perspectiva com o tambor central mais de frente pra câmera. Por isso o mapa guarda os
**limites de cada rolo**, não um passo único — ainda é uma fórmula compacta (6 números
pra 5 colunas), só não assume uniformidade que a arte não tem:

```ts
export const MAPA_SLOTS = {
  rolos: [
    { esquerda: 0.2682, direita: 0.3568 },
    { esquerda: 0.3568, direita: 0.4490 },
    { esquerda: 0.4490, direita: 0.5510 },
    { esquerda: 0.5510, direita: 0.6438 },
    { esquerda: 0.6438, direita: 0.7323 },
  ],
  topo: 0.3611,
  base: 0.6250,
};
```

Altura de cada fileira de símbolo = `(base - topo) / 3 ≈ 0,0880` de fração.

### 3.2 A coreografia

O componente `Rolo.tsx` já é bom — a mudança pra "mesa é a interface" é de **onde ele
mora** (hoje dentro de um `View` desenhado à mão simulando um gabinete, com uma
`CELULA=58` fixa; deveria morar sobre o `slots.webp` de verdade, com a largura de cada
rolo vindo do `MAPA_SLOTS`) e de mais um detalhe de coreografia que falta:

```
t=0ms         toque em "Girar" — bet trava, todos os 5 rolos entram em loop
              contínuo (VOLTA_EM_MS=260ms por volta — já existe)
t≈0-300ms     requisição em voo (rolos continuam girando, mesmo raciocínio da roleta)
t=chegada     resposta chega com a grade de 15 símbolos JÁ sorteada
t=chegada+0ms      rolo 1 começa a desacelerar (ATRASO_POR_COLUNA=260ms de atraso
                   por coluna — já existe)
t=chegada+0..620ms      rolo 1: corrida final até o fim da tira (Easing.out(cubic))
t=chegada+620..820ms    rolo 1: repique de 8px (já existe) — o "tec" mecânico
t=chegada+260ms    rolo 2 começa a desacelerar (mesma sequência, defasada)
t=chegada+520ms    rolo 3 começa
t=chegada+780ms    rolo 4 começa
t=chegada+1040ms   rolo 5 começa, termina em t=chegada+1040+820=1860ms
t=chegada+1860ms   ÚLTIMO rolo parado. Só agora a tela sabe TODAS as células.
t=chegada+1910ms   as células vencedoras (vindas prontas em `winningLines[].cells`
              do servidor — não recalculadas no cliente) acendem em sequência,
              uma payline de cada vez se houver mais de uma (NOVO, ver 3.3)
t=chegada+1910..2800ms  ChipStack conta o prêmio subindo
```

**O que muda em relação ao código atual:** a marcação das linhas vencedoras hoje acende
**todas de uma vez** (`SlotsScreen.tsx`, bloco `marcacoes`). Ver 3.3 pra por que isso
merece virar sequencial.

### 3.3 A lógica por trás

**Por que da esquerda pra direita, sempre?** Duas razões, uma de regra e uma de
legibilidade — e são a mesma razão, na verdade. `slots.config.ts` já documenta a regra:
"a combinação começa OBRIGATORIAMENTE no rolo 1 e anda pra direita até quebrar" — é a
convenção padrão de slot de vídeo desde as máquinas mecânicas: o pagamento é lido como
uma frase, da esquerda pra direita, e o rolo 1 é sempre a primeira palavra. A defasagem
visual (rolo 1 para primeiro, rolo 5 por último) não é different da ordem de PAGAMENTO —
é a mesma ordem, só que devagar o bastante pro olho acompanhar. Isso é legítimo e é
"juice" saudável: dar ao jogador tempo de processar informação que chega em cascata em
vez de tudo de uma vez [fonte 2].

**A técnica que existe na indústria e que recuso.** Pesquisa de patentes de máquina
caça-níquel mostra, documentado e explícito, o oposto do que estamos fazendo: sistemas
em que "a ordem de parada dos rolos é reorganizada para que os símbolos vencedores sejam
direcionados para o(s) último(s) rolo(s) a parar, resultando num jogador mais
emocionalmente envolvido" — ou seja, o motor de jogo *sabe* se vai ganhar ou perder e
*escolhe* segurar o rolo que revelaria a vitória por último, ou embaralhar a ordem
especificamente pra maximizar suspense em cima de uma informação que ele já possui
[fonte 3]. Isso é diferente, em espécie, do que fazemos: nosso atraso por coluna
(`ATRASO_POR_COLUNA = coluna × 260ms`) é indexado pela **posição física do rolo**, não
pelo resultado — o rolo 1 sempre para primeiro exista vitória ou não, o rolo 5 sempre por
último exista vitória ou não. A cascata é honesta porque é fixa; vira manipulação no
instante em que passa a depender do que ela está prestes a revelar. **Não implementamos,
e não vamos implementar, nenhuma variação da ordem de parada condicionada ao resultado.**

**Por que o repique de 8px existe.** Um rolo mecânico de verdade tem massa e um freio —
ele não para instantaneamente, ele passa um pouco do ponto e o freio (ou a gravidade,
num tambor solto) o puxa de volta. O repique já implementado (`withSequence` de
`fim → fim+8 → fim`, 90ms + 110ms) é a assinatura desse freio; sem ele a parada lê como
"a imagem trocou", não "o tambor parou". É o mesmo princípio da bola da roleta (§2.3) e
do dado (`fisica.ts`) — objeto físico perdendo energia contra atrito, desenhado como
curva, não simulado quadro a quadro.

**Por que a marcação de linha deveria acender em sequência, não tudo de uma vez.**
Quando há duas ou mais paylines vencedoras na mesma rodada, acender todas simultaneamente
esconde informação: o jogador vê um monte de dourado e não separa "ganhei pela linha
central" de "ganhei pela diagonal em V". Acender uma payline de cada vez (250-350ms de
intervalo, com o valor daquela linha aparecendo junto) deixa a pessoa **contar** as
vitórias, que é outra forma honesta de "juice" (cada vitória é seu próprio evento
visual) em vez de comprimir tudo numa pausa única.

### 3.4 O que muda no código

**`mapaDosTampos.ts`** — adicionar `MAPA_SLOTS` (bloco acima).

**`SlotsScreen.tsx` → novo `SlotsMesaScreen.tsx`**: troca o `View` de gabinete desenhado
à mão pelo `TampoDaMesa` com `slots.webp`, e cada `<Rolo>` ganha posição/largura do mapa
em vez de `CELULA` fixa:

```tsx
<TampoDaMesa computador={TAMPOS_16X9.slots.computador} tablet={TAMPOS_16X9.slots.tablet}>
  {MAPA_SLOTS.rolos.map((rolo, coluna) => (
    <RoloNoPano key={coluna} rolo={rolo} coluna={coluna}
      girando={girando} resultado={colunaDoResultado(grid, coluna, 5, 3)} />
  ))}
  {!girando && linhaAcesa !== null && (
    <MarcacaoDaLinha payline={winningLines[linhaAcesa]} />
  )}
  {/* saldo, aposta, botão "Girar" — fora do pano, como no Bac Bo */}
</TampoDaMesa>
```

```tsx
function RoloNoPano({ rolo, coluna, girando, resultado }: { rolo: { esquerda: number; direita: number }; coluna: number; girando: boolean; resultado: string[] | null }) {
  const palco = usePalco();
  if (!palco) return null;
  const largura = (rolo.direita - rolo.esquerda) * palco.largura;
  const altura = (MAPA_SLOTS.base - MAPA_SLOTS.topo) * palco.altura;
  return (
    <View style={{ position: 'absolute', left: palco.esquerda + rolo.esquerda * palco.largura, top: palco.topo + MAPA_SLOTS.topo * palco.altura }}>
      <Rolo coluna={coluna} girando={girando} resultado={resultado} fileiras={3} largura={largura} altura={altura / 3} />
    </View>
  );
}
```

**Sequenciamento das paylines (novo, em `SlotsMesaScreen.tsx`)**:

```ts
const [linhaAcesa, setLinhaAcesa] = useState<number | null>(null);

useEffect(() => {
  if (girando || winningLines.length === 0) return;
  let i = 0;
  setLinhaAcesa(0);
  const relogio = setInterval(() => {
    i += 1;
    if (i >= winningLines.length) { clearInterval(relogio); return; }
    setLinhaAcesa(i);
  }, 300);
  return () => clearInterval(relogio);
}, [girando, winningLines]);
```

---

## 4. Banca Francesa (3 dados)

### 4.1 O mapa medido

A mesa oval de `banca-francesa.webp` tem, de cima pra baixo: a **tigela dos dados**
(o rasgo oval no couro, onde os dados são lançados e recolhidos), a caixa "3 ASES", o
arco "GRANDE" com os números 14-15-16 e um **spot circular** por baixo, e o arco
"PEQUENO" com 5-6-7 e outro spot circular — exatamente como `tampos-16x9-regras.md` já
descreve ("Há um único spot circular sobre a linha do GRANDE e um único spot circular
sobre a linha do PEQUENO").

```ts
export const MAPA_BANCA_FRANCESA = {
  tigela: { x: 0.5, y: 0.1741 },
  ases: { caixa: [0.1922, 0.2333, 0.2682, 0.3148], rotulo: 'Ases — soma 3' },
  grande: { caixa: [0.4818, 0.4343, 0.5182, 0.4991], rotulo: 'Grande — 14, 15 ou 16' },
  pequeno: { caixa: [0.4818, 0.6454, 0.5182, 0.7102], rotulo: 'Pequeno — 5, 6 ou 7' },
  /**
   * "Linha" não tem casa própria impressa na arte — na mesa real ela é a aposta na
   * FRONTEIRA entre Grande e Pequeno (ver banca-francesa.engine.ts: metade em cada).
   * Uso a faixa de feltro entre os dois spots como área tocável — é honesto sobre o que
   * está medido (o vão entre os dois círculos, não uma linha impressa) vs. o que é
   * decisão de produto (dar a essa aposta um lugar tocável razoável).
   */
  linha: { caixa: [0.3646, 0.5491, 0.6354, 0.5954], rotulo: 'Linha — metade Grande, metade Pequeno' },
} satisfies Record<string, unknown>;
```

### 4.2 A coreografia

```
t=0ms        toque em "Lançar" — as 4 casas travam
t≈0-300ms    requisição em voo
t=chegada    resposta chega com { dice, sum, outcome, rerolls } — o RESULTADO
             DECISIVO já veio pronto; rerolls diz quantos lançamentos nulos
             aconteceram no servidor ANTES do decisivo (ver §4.3 — hoje esse
             número chega e não é mostrado)
t=chegada+0ms       SE rerolls > 0: até 2 "chacoalhos fantasmas" — os 3 dados
             brilham/tremem (reaproveita o estado `rolando` do <Dado>, sem
             lancar()) por 260ms cada, com 120ms de pausa — é o "os dados
             voltaram pro copo" da mesa real, comprimido
t=chegada+até 760ms   fim dos chacoalhos fantasmas (0, 1 ou 2, nunca mais que
             isso mesmo se o servidor relançou mais vezes — ver §4.3)
t=chegada+…+0ms     os 3 dados DECISIVOS são lançados de verdade: reusa
             `lancar()` de fisica.ts, VOO_EM_MS=1150, ATRASO_POR_DADO=150ms
             (mesma física do Bac Bo) — o último dado assenta em 2×150+1150=1450ms
t=…+1450ms   soma calculada, arco vencedor (Grande/Pequeno/Ases) acende no
             pano — o NÚMERO exato (14, 15 ou 16 / 5, 6 ou 7) também acende,
             reaproveitando o estilo `vencedora` do CasaDeAposta
t=…+1500-1650ms   o spot vencedor pulsa (brilho dourado, 150ms)
t=…+1650-2550ms   ChipStack conta o prêmio
```

### 4.3 A lógica por trás

**Por que existe soma "nula" que relança os dados, em vez de qualquer soma resolver
algo?** Isto já está bem explicado no nosso próprio motor
(`banca-francesa.engine.ts`, comentário de `resolveBets`): das 216 combinações possíveis
de 3 dados, só 63 são decisivas (1 Ases + 31 Pequeno + 31 Grande); o resto (4, 8-13, 17,
18) não resolve nada e os dados voltam pro copo com as apostas em pé. Isso não é um
detalhe De regra arbitrário — é o que **calibra o RTP**: se qualquer soma resolvesse
alguma coisa, a matemática do jogo seria outra. É a mesma família de jogo que Sic Bo e
Craps, em que "nenhuma decisão ainda" é um resultado tão real quanto ganhar ou perder.

**O achado concreto:** o servidor já sabe quantos relançamentos nulos aconteceram
(`rerolls`, calculado em `rollUntilDecisive()`) e a tela solo (`BancaFrancesaScreen.tsx`,
linha 180) já mostra esse número em texto: *"(relançou Nx até decidir)"*. Mas a
**versão de mesa** (`bancaFrancesaMesa.ts` / `banca-francesa-table.service.ts`) **descarta
esse número no caminho** — o servidor calcula `rerolls` dentro de `rollUntilDecisive()`
mas `banca-francesa-table.service.ts:218` desestrutura só `{ dice, sum, outcome }`,
joga `rerolls` fora, e `RoundResult` (linha 25-27 do mesmo arquivo) nem declara o campo.
Resultado: quem joga na mesa nunca vê "os dados hesitaram" — só vê a jogada final, mesmo
quando o servidor relançou três ou quatro vezes por baixo dos panos. Isso é uma perda de
informação honesta (o relançamento é real, aconteceu, é regra do próprio jogo) que a
versão solo já não comete.

**Por que mostrar no máximo 2 chacoalhos mesmo se `rerolls` for maior.** A média real é
216/63 ≈ 3,4 lançamentos até decidir, mas a cauda existe (tecnicamente sem limite). Mostrar
literalmente *N* chacoalhos faria uma rodada rara de 6 relançamentos travar o jogo por
segundos sem motivo — o objetivo do chacoalho fantasma é **comunicar que houve hesitação**,
não replicar cada tentativa. Dois chacoalhos já comunicam "os dados custaram a decidir"
sem custar a paciência de quem está jogando; é o mesmo tipo de compressão que a Roleta
faz entre os 8-15s reais e os 3800ms nossos (§2.3) — honestidade sobre o que aconteceu,
sem replicar o tempo real inteiro.

### 4.4 O que muda no código

**Servidor** — `server/src/modules/rooms/banca-francesa-table.service.ts`:

```ts
// linha ~25-27: RoundResult ganha o campo que o engine já calculava e era descartado
export interface RoundResult {
  dice: number[];
  sum: number;
  outcome: 'ases' | 'pequeno' | 'grande';
  rerolls: number; // NOVO
  // ...
}
```

```ts
// linha ~218: capturar o campo que já vinha do engine
const { dice, sum, outcome, rerolls } = rollUntilDecisive();
this.anotar(table, 'DADOS', { dice, sum, outcome, rerolls });
```

```ts
// linha ~255
table.lastRound = { dice, sum, outcome, rerolls, bySeat, at: new Date().toISOString() };
```

**Cliente** — `app/src/api/bancaFrancesaMesa.ts`: acrescentar `rerolls: number;` a
`TableRoundView`.

**`mapaDosTampos.ts`**: adicionar `MAPA_BANCA_FRANCESA` (bloco em 4.1).

**Novo `BancaFrancesaMesaScreen.tsx`** (a versão atual já é "mesa" no sentido
multiplayer — o que falta é o pano de verdade):

```tsx
<TampoDaMesa computador={TAMPOS_16X9['banca-francesa'].computador} tablet={TAMPOS_16X9['banca-francesa'].tablet}>
  {(['ases', 'grande', 'pequeno', 'linha'] as const).map((tipo) => (
    <CasaDeAposta key={tipo} area={MAPA_BANCA_FRANCESA[tipo]} valor={apostado(tipo)}
      escolhida={selecionadas.has(tipo)} travada={girando}
      vencedora={table?.lastRound?.outcome === tipo || (tipo === 'linha' && table?.lastRound && table.lastRound.outcome !== 'ases')}
      onPress={() => alternar(tipo)} />
  ))}
  {[0, 1, 2].map((indice) => (
    <DadoNaTigela key={indice} indice={indice} face={dadosFinais?.[indice] ?? null}
      rolando={girando} fantasma={chacoalhoFantasma} />
  ))}
</TampoDaMesa>
```

```ts
// Chacoalho fantasma: dispara ANTES do lançamento de verdade, se rerolls > 0.
const [chacoalhoFantasma, setChacoalhoFantasma] = useState(false);

async function lancar() {
  setGirando(true);
  const resultado = await roll(table.id); // servidor já decidiu tudo, dice/rerolls prontos
  const repeticoes = Math.min(resultado.lastRound!.rerolls, 2);
  for (let i = 0; i < repeticoes; i += 1) {
    setChacoalhoFantasma(true);
    await esperar(260);
    setChacoalhoFantasma(false);
    await esperar(120);
  }
  setDadosFinais(resultado.lastRound!.dice); // SÓ AGORA os dados sabem a face final
  setGirando(false);
}
```

---

## 5. Stock Market

### 5.1 O mapa medido

A mesa é a mais simples das cinco: painel verde "ALTA" à esquerda, grade impressa (vazia,
decorativa) no centro, painel vermelho "BAIXA" à direita.

```ts
export const MAPA_STOCK_MARKET = {
  alta: { caixa: [0.1641, 0.1713, 0.3151, 0.5880], rotulo: 'Apostar em Alta' },
  baixa: { caixa: [0.6693, 0.1713, 0.8229, 0.5880], rotulo: 'Apostar em Baixa' },
  /** A área do gráfico impresso — é onde a linha animada da cotação desenha por cima. */
  grafico: [0.3255, 0.1713, 0.6615, 0.5880] as [number, number, number, number],
};
```

### 5.2 A coreografia

O jogo já tem uma coreografia decente (`Cotacao`, `MS_POR_TIQUE=45ms × 30 tiques =
1350ms` de linha andando) — o que muda é **onde** ela mora e como o toque funciona:

```
t=0ms        toque no painel ALTA ou BAIXA (o painel inteiro, não um botão pequeno
             abaixo do gráfico) — o painel escolhido ganha uma borda dourada pulsante
t=…          toque em "Investir" — trava
t=chegada    resposta chega com o CAMINHO INTEIRO da cotação já pronto (path[]) —
             a animação nunca decide o próximo tique, só revela o que já veio
t=chegada+0..1350ms   a linha anda dentro da MOLDURA IMPRESSA (o `grafico` medido),
             tique a tique, 45ms cada — já existente, só realocado pra dentro do pano
t=chegada+1350ms   o painel (ALTA ou BAIXA) que a pessoa apostou pisca na cor do
             resultado — verde se subiu, vermelho se desceu (NOVO — hoje o resultado
             só aparece como texto/porcentagem, sem tocar o painel de volta)
t=chegada+1400-2300ms   ChipStack conta
```

### 5.3 A lógica por trás

**Por que a linha desenha tique a tique em vez de aparecer pronta.** O comentário que já
existe no código acerta isso: "o caminho inteiro já chegou do servidor antes da animação
começar; ela só percorre o que já aconteceu, nunca decide nada" — é a regra de ouro
aplicada literalmente a um gráfico em vez de a uma roda ou um dado. Manter.

**Por que apostar no PAINEL, não num botão com ícone de seta.** É a mesma lógica de toda
esta pesquisa: numa mesa de verdade a aposta ocupa um espaço físico — aqui os dois
painéis coloridos (verde/vermelho) já SÃO esse espaço na arte, só que hoje ficam mudos
(decoração) enquanto o toque de verdade acontece em dois botões pequenos com ícone
abaixo do gráfico (`DirectionButton`). Fazer o painel colorido responder ao toque fecha
essa distância sem precisar de arte nova.

**Por que o painel deveria piscar no resultado.** Hoje o desfecho aparece só como número
("Fechou em +12,40%") — correto, mas desconectado do lugar físico onde a pessoa apostou.
Fazer o painel de volta acender (ou tremer, se perdeu) devolve o resultado pro mesmo
objeto que recebeu o toque, fechando o ciclo: toquei aqui → o jogo aconteceu → aqui
mesmo acendeu.

### 5.4 O que muda no código

**`mapaDosTampos.ts`**: adicionar `MAPA_STOCK_MARKET`.

**Novo `StockMarketMesaScreen.tsx`**:

```tsx
<TampoDaMesa computador={TAMPOS_16X9['stock-market'].computador} tablet={TAMPOS_16X9['stock-market'].tablet}>
  <PainelDeAposta area={MAPA_STOCK_MARKET.alta} cor={colors.success}
    escolhido={direcao === 'alta'} resultado={round && terminouDeDesenhar ? round.closePercent >= 0 : null}
    onPress={() => setDirecao('alta')} />
  <PainelDeAposta area={MAPA_STOCK_MARKET.baixa} cor={colors.ruby}
    escolhido={direcao === 'baixa'} resultado={round && terminouDeDesenhar ? round.closePercent < 0 : null}
    onPress={() => setDirecao('baixa')} />
  <GraficoNoPano area={MAPA_STOCK_MARKET.grafico} caminho={round?.path ?? historico} ateOTique={tiqueVisivel} />
</TampoDaMesa>
```

`PainelDeAposta` é uma variação fina de `CasaDeAposta` (mesmo princípio — a área já está
pintada na arte, o componente só acrescenta borda de seleção e o pulso de resultado);
`GraficoNoPano` é o `Cotacao` já existente, só que posicionado por `usePalco()` dentro da
caixa `grafico` em vez de um `View` com `height: CHART_HEIGHT` fixo fora do tampo.

---

## 6. Dominó

### 6.1 O mapa medido

Mesa octogonal, quatro bandejas de madeira nos cantos (uma por jogador) e o centro do
feltro livre para a corrente — exatamente como `tampos-16x9-regras.md` descreve.

```ts
export const MAPA_DOMINO = {
  bandejas: {
    noroeste: { x: 0.2573, y: 0.2750 },
    nordeste: { x: 0.7427, y: 0.2750 },
    sudoeste: { x: 0.2203, y: 0.6574 },
    sudeste: { x: 0.7885, y: 0.6574 },
  },
  /** Retângulo de feltro jogável — onde a corrente de dominó pode crescer. */
  pano: [0.1010, 0.2130, 0.8990, 0.7759] as [number, number, number, number],
};
```

### 6.2 A coreografia

O dominó é estruturalmente diferente dos outros quatro: não existe uma "rodada" com
resultado sorteado pra revelar — é turno a turno, e a regra de ouro já vale por outro
caminho: o servidor já valida cada jogada (`encaixes()` em `DominoMesaScreen.tsx` já
calcula localmente pra UI, mas quem decide de verdade é o servidor). O que muda aqui não
é "esconder um sorteio", é **onde a jogada acontece**.

```
1. Jogador toca numa peça da própria mão → a peça sobe (small "lift", ~120ms,
   TEMPO.toque já existe em animation/movimento.ts) e as pontas da corrente ONDE
   ela encaixa (calculadas por encaixes(), já existe) acendem douradas na
   posição REAL da ponta — não um botão de texto "◀ esquerda"
2. Jogador toca na ponta acesa (ou arrasta a peça até ela)
3. A peça viaja da bandeja até a ponta: reaproveita lancar() de fisica.ts, mas
   com um perfil mais "colocado" que "lançado" — alturaInicial menor (~0,35 em
   vez de 0,8-1,0 do dado), quantosQuiques=1, passoDoGiro=180 (a peça só
   precisa terminar numa de DUAS orientações válidas em relação à corrente,
   não em qualquer uma como o dado nem sempre "em pé" como a carta)
4. ~500-600ms depois, a peça assenta ponta-com-ponta; CorrenteDeDomino
   recalcula o layout (já existe — inclusive já dobra "perna" na borda)
5. Se a peça fechar o jogo ou não sobrar jogada, o placar da dupla atualiza
```

### 6.3 A lógica por trás

**Por que a ponta acesa em vez de um botão "◀ esquerda / direita ▶".** É o mesmo
argumento do documento inteiro, aplicado ao caso mais claro dele: numa mesa real você não
lê "esquerda" ou "direita" em lugar nenhum — você olha a ponta da corrente, vê que sua
peça bate ali, e a põe. O texto "◀ Ponta esquerda" só existe porque a interface atual não
sabe (nem tenta saber) onde a ponta está NA TELA — ela sabe só o valor lógico (`leftEnd`,
um número). Resolver isso é o cerne desta conversão: dominó precisa que a corrente
exponha a **posição em pixel da sua própria ponta**, não só o valor — algo que os outros
quatro jogos não precisam (áreas fixas resolvem tudo neles) e que é a real diferença de
arquitetura aqui.

**Por que a peça "pousa" em vez de ser "lançada".** Dado e carta, na mesa física, chegam
com energia — são soltos ou embaralhados. Uma peça de dominó é **colocada** — a pessoa
segura, olha, posiciona, solta com controle. Copiar a física do dado (`alturaInicial:
0.8`, 2-3 quiques) faria a peça parecer jogada displicentemente, o oposto da etiqueta real
do jogo. Isso não é um capricho estético: é a mesma função `lancar()`, com parâmetros
diferentes porque o objeto se comporta diferente — reuso de código, não duplicação, e é
exatamente esse tipo de generalização que fisica.ts foi desenhado pra permitir (a curva é
paramétrica, não hardcoded pro dado).

**Por que a mão do próprio jogador não cabe numa das quatro bandejas.** As bandejas
medidas são compartimentos pequenos, pensados na arte pra guardar peças **viradas pra
baixo** (a mão dos outros — informação pública de quantidade, não de conteúdo, mesmo
princípio que `MesaComLugares.tsx` já documenta: "a mão dos outros aparece de costas").
A sua própria mão, até 7 peças viradas pra CIMA que você precisa tocar individualmente,
precisa de mais largura do que uma bandeja de canto permite. Por isso a proposta: sua
mão ocupa uma fileira ao longo da borda inferior do `pano` medido (fração larga, y
próximo da base), enquanto as bandejas dos outros três jogadores (que só mostram costas
de peça) usam as caixas de canto medidas — cada peça no lugar certo pra informação que
ela carrega.

### 6.4 O que muda no código

**`mapaDosTampos.ts`**: adicionar `MAPA_DOMINO`.

**`CorrenteDeDomino.tsx`** precisa de uma mudança de arquitetura pequena mas real: hoje
ele só desenha; precisa também **informar onde as pontas caíram em pixel**, porque é lá
que o brilho de "aqui encaixa" e a trajetória da peça precisam mirar:

```tsx
export function CorrenteDeDomino({
  pecas,
  onPontasMedidas, // NOVO: devolve a posição em pixel de cada ponta depois de layoutar
}: {
  pecas: PecaDeDomino[];
  onPontasMedidas?: (pontas: { esquerda: { x: number; y: number }; direita: { x: number; y: number } }) => void;
}) {
  // ...layout atual, sem mudança...
  // ao final do layout: mede onLayout da primeira e da última peça renderizada
  // (refs), converte pra coordenada da tela, chama onPontasMedidas — permite ao
  // DominoMesaScreen posicionar o brilho e o destino de lancar() sem duplicar
  // a lógica de "pernas" que já existe aqui.
}
```

**Novo `DominoMesaScreen.tsx`**: troca `MesaComLugares` (mesa abstrata desenhada, hoje
usada tanto pra Dominó quanto Bac-que-nem-existe-mais-assim) pelo `TampoDaMesa` com
`domino.webp`; bandejas dos outros três jogadores nas posições de `MAPA_DOMINO.bandejas`
(rotacionadas pela mesma regra "você sempre embaixo" que `MesaComLugares.ancoraDo()` já
implementa — reaproveitar a função, só trocando a saída de "estilo de posição relativa"
pra "qual bandeja medida usar"); sua mão como fileira ancorada na base do `pano` medido.

---

## 7. Técnicas manipuladoras identificadas — e por que não entram

A pesquisa pública de convenções do setor encontrou, documentado (em literatura de
patente e em pesquisa acadêmica de psicologia do jogo), um conjunto de técnicas
desenhadas especificamente para distorcer a percepção de quem joga. Cada uma está listada
aqui com a fonte, e com o motivo concreto — não só "achamos errado" — pelo qual ela não
entra no Casino Inova.

| Técnica encontrada na pesquisa | Fonte | Por que não fazemos |
|---|---|---|
| **Reordenar a parada dos rolos** conforme o resultado, segurando o rolo que revelaria vitória por último pra maximizar suspense em cima de uma informação que o motor já possui | patentes de "gaming machine allowing selection of stopping order of reels for sustaining player's anticipation" [fonte 3] | Nossa defasagem por coluna é indexada pela POSIÇÃO do rolo (`coluna × 260ms`), fixa, calculada antes de qualquer verificação de vitória. Ver §3.3. |
| **"Quase ganhou" fabricado** (near-miss projetado) — dispor símbolos de propósito pra que a combinação pareça ter quase batido, aumentando o desejo de jogar de novo mesmo sem qualquer chance real adicional | revisão acadêmica do "near-miss effect" em caça-níqueis, décadas de pesquisa [fonte 4] | Nossos símbolos são sorteados por peso independente por célula (`drawSymbol`, `slots.config.ts`) — não existe lógica que force um "quase" visualmente perto do centro pagante. O RTP publicado é calculado em fórmula fechada a partir dos mesmos pesos que sorteiam, não ajustado por engenharia de quase-vitórias. |
| **Suspense esticado além do que a espera comunica** — alongar a revelação sem que o tempo extra sirva a leitura ou à antecipação, só pra prender atenção | contraponto direto ao princípio central de "juice" (Jonasson & Purho): a resposta deve ser proporcional à ação, não inflada [fonte 2] | Cada tempo deste documento tem uma razão declarada em "a lógica por trás" — quando comprimimos o real (roleta: 8-15s reais → 3800ms; banca francesa: relançamentos reais → no máximo 2 chacoalhos) é para CABER no ritmo do app, nunca para alongar além do que a informação pede. |
| **Som de vitória tocando numa perda** (ou em qualquer resultado que não seja vitória líquida) | prática amplamente documentada em pesquisa de "losses disguised as wins" no design de caça-níqueis | Não implementamos — `totalWin`/`totalReturn` chegam do servidor e o som/celebração só dispara quando o retorno excede a aposta. Nenhum efeito sonoro de vitória é acionado por uma perda ou por um "quase". |
| **RTP não divulgado, ou divulgado só sob pedido** | contraste com a exigência de certificação de RNG e auditoria contínua de RTP de agências como a eCOGRA e a licença da UK Gambling Commission [fonte 6] | Cada tela já mostra o RTP teórico calculado em fórmula fechada (`theoreticalRtp()`, presente nos cinco motores) na própria tela do jogo — não muda com esta conversão de interface. |

O padrão comum de toda a coluna da direita: **a regra de ouro não é um princípio abstrato
neste documento — ela é a régua que testa cada decisão de coreografia.** Se um tempo ou
uma ordem só faz sentido quando o motor "sabe" o resultado com antecedência e usa esse
conhecimento pra manipular a leitura de quem joga, ela fica de fora. Se o tempo existe pra
tornar uma decisão já tomada **legível** (dar ao olho tempo de acompanhar, dar ao momento
o peso que ele merece), ela fica dentro — com a razão escrita, não só o número.

---

## 8. Fontes públicas

1. **Ritual e tempo de giro da roleta física** — descrição de procedimento de mesa
   ("Casino Dealer Roulette"), confirmando a janela de aposta fechando ~5s antes do
   lançamento da bola, a regra de mínimo de 3 voltas antes de valer o giro, ~1,5 volta
   por segundo do rotor, e 8-15s do lançamento até a bola cair, com a bola dando de 7 a
   12 voltas na pista externa antes de cair.
   https://www.clevercommunitydevelopment.org/2026/05/15/casino-dealer-roulette/
2. **"Juice It or Lose It"**, Martin Jonasson & Petri Purho, GDC Europe 2012 — a
   referência canônica sobre "juice"/game feel: por que resposta proporcional a cada
   ação (incluindo o tempo de antecipação antes de revelar um resultado) faz um jogo
   parecer vivo. https://www.gdcvault.com/play/1016487/Juice-It-or-Lose ·
   https://www.youtube.com/watch?v=Fy0aCDmgnxg
3. **Reordenação manipulativa da parada de rolos** — literatura de patente da indústria
   de caça-níqueis descrevendo sistemas que atrasam de propósito o rolo que revelaria
   vitória, e machines que alternam ordem de parada (esquerda-direita, direita-esquerda,
   aleatória) especificamente para "sustentar a antecipação do jogador" — a técnica que
   este documento identifica e recusa em §3.3 e §7.
   https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/8342934
4. **O efeito "quase ganhei" em caça-níqueis** — revisão acadêmica de mais de meio século
   de pesquisa experimental sobre o near-miss effect, incluindo como reels virtuais e
   near-misses passaram a ser projetados deliberadamente na era digital do caça-níquel.
   https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7214505/
5. **Física do giro da roleta** (por que a bola e a roda giram em sentidos opostos, e
   como o atrito e a inclinação da pista derrubam a bola) — "Spinning the Wheel of
   Science: Understanding the Probabilities of Roulette through Physics".
   https://untamedscience.com/blog/spinning-the-wheel-of-science-understanding-the-probabilities-of-roulette-through-physics/
6. **Certificação de RNG e auditoria de RTP** — eCOGRA (RNG testing e certificação) e o
   papel da UK Gambling Commission na exigência de testes como condição de licença,
   sustentando por que o RTP divulgado na tela (já prática nossa) é o padrão esperado do
   setor regulado, não um extra. https://ecogra.org/igaming/rng-testing-and-ecogra-certification/

**Fontes internas** (o próprio código e a própria arte do repositório, citados ao longo
do documento como evidência, não como referência externa): `app/src/screens/games/
BacBoMesaScreen.tsx`, `app/src/components/CasaDeAposta.tsx`,
`app/src/data/mapaDosTampos.ts`, `app/src/components/TampoDaMesa.tsx`,
`app/src/components/RodaDaRoleta.tsx`, `app/src/components/Dado.tsx`,
`app/src/components/Rolo.tsx`, `app/src/animation/fisica.ts`,
`app/src/animation/movimento.ts`, `app/src/components/CorrenteDeDomino.tsx`,
`app/src/components/MesaComLugares.tsx`, `docs/mesa-de-verdade.md`,
`docs/tampos-16x9-regras.md`, `server/src/modules/games/roulette/roulette.config.ts`,
`server/src/modules/games/slots/slots.config.ts`,
`server/src/modules/games/banca-francesa/banca-francesa.engine.ts`,
`server/src/modules/games/stock-market/stock-market.engine.ts`,
`server/src/modules/rooms/banca-francesa-table.service.ts`,
`server/src/modules/games/domino/domino.config.ts`, e as artes medidas em
`app/assets/images/tampos-16x9/computador/{roleta,slots,banca-francesa,stock-market,domino}.webp`.
