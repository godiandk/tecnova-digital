# RENDERING_STRATEGY — a decisão de renderer, com os números que a sustentam

Saída formal da **POC DE RENDERIZAÇÃO — CASINO INOVA** (§4 de `estrategia-de-renderizacao.md`).

O material está em `poc-renderizacao/`; como rodar, em `poc-renderizacao/LEIA-ME.md`; os
números crus, em `poc-renderizacao/resultados/medidas.json`.

---

## 0. O que foi medido, o que não foi, e por quê — antes de qualquer número

Esta seção vem primeiro de propósito. Um número lido fora do ambiente em que nasceu vira
decisão errada, e essa é a forma mais fácil de esta POC causar dano em vez de evitar.

### O ambiente da medição não tem GPU

Verificado, não suposto: não existe `/dev/dri` no contêiner, e o Chromium cai no
**SwiftShader** — rasterizador por software, sobre 4 núcleos — mesmo quando a aceleração é
pedida à força (`--use-gl=angle`, `--ignore-gpu-blocklist`, `--enable-gpu-rasterization`
foram testados: os três devolvem o mesmo SwiftShader).

O que sai daqui é, portanto, **custo de CPU por quadro**. Não é quadros por segundo de
celular, e nenhuma linha deste documento deve ser lida assim.

E a distorção tem direção conhecida: um rasterizador de software castiga **taxa de
preenchimento**, **MSAA** e **troca de estado do WebGL** muito mais do que uma GPU castiga.
Justamente os três itens em que os dois braços mais diferem. **A ordem do pódio pode virar
em hardware de verdade** — e é por isso que a decisão do §5 é condicional e o §6 existe.

### O Portão 0 (Unity WebGL) NÃO foi executado

E não é possível executá-lo aqui: a Unity não está instalada no contêiner, e o portão pede
medidas que só existem em aparelho físico — pico de memória, comportamento ao bloquear e
desbloquear o iPhone, 5G contra Wi-Fi, estabilidade após dez minutos. Fica **em aberto**,
com o roteiro no §6. Não está reprovado por medição: está não medido.

O que **é** decidível hoje sobre Unity está no §5, e vem de duas fontes que não dependem
deste contêiner: o peso de download mínimo de um build WebGL e a posição da própria Unity
sobre o Safari do iPhone.

### O braço Skia mede o CanvasKit direto

O CanvasKit é exatamente o motor que o `@shopify/react-native-skia` usa na web — mas aqui
ele foi medido **sem a ponte React**. Se o Skia for o escolhido, o custo dessa ponte
(reconciliação, re-render, `useSharedValue`) precisa ser medido à parte antes de congelar.
Neste documento, o número do Skia é o **teto** dele, não o que a integração entregaria.

### O áudio ficou fora, e ficou de propósito

O §4 pedia áudio na cena. Áudio na web é Web Audio nos dois braços — o mesmo código, o
mesmo custo, independente de quem desenha. Ele **não discrimina renderer**, e num contêiner
sem placa de som não produziria medida nenhuma. O que o áudio *pode* discriminar é
sincronia entre som e imagem quando quadros caem, e isso só se observa em aparelho: está no
roteiro do §6.

---

## 1. A honestidade que custou três correções na própria POC

A primeira versão desta POC produzia números. Os números estavam errados, e o erro não era
de medição — era de **cena**. Fica registrado porque explica por que os números do §2 são
confiáveis e os anteriores não eram.

| O que estava errado | Por que invalidava | Como se sabe |
|---|---|---|
| Pixi desenhava a 1 pixel por ponto, Skia a 2 | o Skia pintava **4x mais pixels** e ainda "perdia" | `resolution` do Pixi não estava configurada |
| Partículas diferentes: Pixi usava um símbolo de 192 px encolhido, sem cor; Skia, um disco liso colorido de raio 3 a 9 | comparava **dois desenhos diferentes**, e o mais pesado era o do Pixi | leitura do código dos dois lados |
| Só o Skia desenhava o halo das linhas | o Skia fazia **mais coisa** e mesmo assim ganhava | comparação visual lado a lado |
| "Quadro perdido" contado como `> 16,67 ms` | dava "p50 16,7 · p95 16,8 · 57,7% fora do orçamento" — três números que não podem ser todos verdade | limiar em cima da linha de um renderizador preso ao sincronismo |
| Retratos tirados por relógio de parede | contador em 3.233 num lado e 2.746 no outro: meio segundo de animação de diferença, lado a lado como se fosse o mesmo instante | o próprio retrato |

Depois de corrigir tudo isso, o Pixi melhorou de 99 ms para 66 ms de quadro típico só por
causa das partículas — **um terço do "resultado" original era erro nosso**.

Hoje as duas cenas são a mesma cena: mesma resolução, mesmas partículas do mesmo tamanho e
da mesma cor, mesmo halo, mesmo instante nos retratos.

---

## 2. Os números

Cena: 5 rolos, 9 símbolos por rolo, antecipação no quinto, parada com mola amortecida, 3
linhas de prêmio acendendo em sequência com halo, 320 partículas, contador subindo,
multiplicador, entrada e saída. 8,2 segundos. Idêntica nos dois braços.

**Leia como custo de CPU. Não como desempenho de aparelho.** (§0)

### Celular (390 × 844 @2x — 780 × 1688 pixels reais)

| Braço | Quadro típico | p95 | p99 | Pior | Entregue | Viradas perdidas |
|---|---|---|---|---|---|---|
| Pixi, ingênuo (MSAA 4x + `Text`) | 100,6 ms | 123,4 | 170,3 | 170,3 | 9,7 q/s | 398 |
| Pixi, sem MSAA | 76,1 ms | 83,7 | 88,3 | 117,9 | 13,1 q/s | 370 |
| **Pixi, afinado** (sem MSAA + `BitmapText`) | **76,5 ms** | 85,0 | 107,5 | 116,9 | 13,1 q/s | 378 |
| **Skia (CanvasKit)** | **16,8 ms** | 23,6 | 33,0 | 121,4 | 53,0 q/s | 25 |

### Monitor (1920 × 1080 @1x)

| Braço | Quadro típico | p95 | p99 | Pior | Entregue |
|---|---|---|---|---|---|
| Pixi, ingênuo | 203,0 ms | 228,7 | 248,1 | 248,1 | 4,9 q/s |
| Pixi, afinado | 152,8 ms | 178,8 | 187,5 | 187,5 | 6,4 q/s |
| **Skia** | **29,9 ms** | 46,5 | 83,2 | 127,4 | 30,1 q/s |

**Neste ambiente, o Skia desenha a cena inteira dentro do orçamento de 16,67 ms e o Pixi
não chega perto.** Duas leituras que o número exige:

- O `p50` de 16,8 ms do Skia está **preso no sincronismo da tela**: ele não é "o Skia leva
  16,8 ms", é "o Skia acaba antes de 16,67 e espera". O custo real dele é menor que isso, e
  esta medição não consegue enxergar quanto — só o `q/s` da ablação (§3) revela a folga.
- O "pior quadro" de 121 ms do Skia é o primeiro quadro depois da compilação do WebAssembly.
  Acontece uma vez.

### O que custa o quê — a ablação

Desligando um pedaço de cada vez (`?sem=`). Como o `p50` do Skia fica preso no sincronismo,
a coluna que informa é **quadros entregues por segundo**.

| Cena acumulada | Pixi (q/s) | Skia (q/s) | Pixi, o que **esse item** somou | Skia, idem |
|---|---|---|---|---|
| nada desenhado (custo fixo do quadro) | 58,2 | 60,1 | — | — |
| só o feltro | 33,9 | 59,3 | **+12,3 ms** | +0,2 ms |
| feltro + símbolos, **sem** recorte | 20,2 | 50,1 | +20,0 ms | +3,1 ms |
| feltro + símbolos, **com** recorte | 14,2 | 59,0 | **+20,9 ms** | **−3,0 ms** |
| + 320 partículas | 13,4 | 56,2 | +4,2 ms | +0,8 ms |
| + linhas de prêmio com halo | 13,2 | 53,0 | +1,1 ms | +1,1 ms |
| + contador e multiplicador | 13,0 | 52,3 | +1,2 ms | +0,3 ms |

*(A coluna em milissegundos é a diferença entre uma linha e a anterior, convertida de
quadros por segundo. O `p50` não serve para isso no braço Skia, porque ele fica preso no
sincronismo da tela e esconde a folga.)*

Três coisas saltam:

1. **O custo fixo do quadro é o mesmo** (58 contra 60 q/s com a tela vazia). A diferença
   toda está no desenho, não em ineficiência de laço, de `requestAnimationFrame` ou de
   apresentação. Isso valida a comparação.

2. **O recorte do rolo se comporta ao contrário nos dois.** No Skia, `clipRect` é tesoura
   de verdade: ligar o recorte **acelera** (50,1 → 59,0 q/s), porque o que não aparece não é
   pintado. No Pixi, a máscara de `Graphics` é uma passada de estêncil: ligar **desacelera**
   (20,2 → 14,2 q/s), custando mais do que o preenchimento que economiza. São ~21 ms de
   quadro, o maior item isolado do braço Pixi.
   *O comentário original no código do Pixi dizia "no WebGL vira recorte de tesoura, custo
   praticamente zero". Era palpite, e a medida desmentiu.*

3. **As partículas são baratas nos dois.** O `ParticleContainer` do Pixi entrega o que
   promete: 320 sprites em lote custam 4,2 ms num rasterizador de software, contra 20,9 ms
   de uma máscara. No Skia custam 0,8 ms. A conclusão da auditoria — de que partícula em
   massa exige um renderizador de jogo — se confirma; o que não se confirma é que o Pixi
   seja o único capaz.

E os dois erros de implementação que a POC isolou, no braço Pixi:

| Escolha | Custo medido |
|---|---|
| `antialias: true` (MSAA 4x) | **+24,5 ms** por quadro |
| `Text` em vez de `BitmapText` no contador | **diferença nenhuma** nesta cena (−0,4 ms, dentro do ruído) |

O MSAA é caro em qualquer lugar, e num rasterizador de software é caríssimo: 24,5 ms de um
orçamento de 16,67 é a escolha mais cara da POC inteira.

O `Text` **não** apareceu, e isso merece ser dito com a mesma clareza com que a suspeita foi
levantada: a armadilha clássica do Pixi — redesenhar o texto e subir a textura a cada
mudança de string — não custou nada de mensurável aqui, porque a máscara e o feltro
dominavam a conta e porque o contador só corre em dois dos oito segundos da cena. A regra
"contador que anda vai em `BitmapText`" continua valendo por construção, mas **esta POC não
a mediu como ganho**, e registrar o contrário seria inventar número.

---

## 3. O peso que o jogador baixa

Medido arquivo por arquivo, com `gzip -9` onde o formato comprime.

| Braço | Peso | O que é |
|---|---|---|
| **Pixi** | **~761 KB** | `pixi.min.mjs` 225 KB · atlas 529 KB · página e cena 7 KB |
| **Skia** | **~3.648 KB** | `canvaskit.wasm` **2.870 KB** · `canvaskit.js` 36 KB · **fonte 207 KB** · atlas 529 KB · página e cena 6 KB |

**O Skia custa +2,9 MB.** Essa é a conta que anda no sentido contrário à do §2, e é o
verdadeiro dilema desta POC.

Dois detalhes que só aparecem quando se mede em vez de estimar:

- **O CanvasKit não traz nenhuma fonte.** `new CK.Font(null, tamanho)` compila, roda e não
  reclama — e todo caractere vira o glifo `.notdef`. A "fonte do sistema", que no React
  Native e no DOM vem de graça, no Skia é um arquivo que alguém baixa: +207 KB por um peso
  de uma família. Reduzir a fonte só aos glifos usados corta quase tudo isso, e **não foi
  medido** (não há `fonttools` no ambiente) — então o número acima é o custo sem essa
  otimização, não uma previsão.
- O atlas (529 KB) é dos dois, e sai da conta quando se compara um braço com o outro. A
  diferença líquida entre os braços é de **2.887 KB**.

---

## 4. Qualidade visual

Retratos nos mesmos três instantes da cena — girando (t=2000), primeira linha acesa
(t=4000), big win (t=5600) — com o tempo **congelado**, para os dois braços desenharem
exatamente o mesmo quadro.

Lado a lado, versionados: `poc-renderizacao/comparacao-1-girando.png`,
`comparacao-2-primeira-linha.png`, `comparacao-3-big-win.png` e
`comparacao-4-big-win-monitor.png`. Os retratos em resolução cheia saem de `medir.mjs`.

**Resultado: empate.** As duas imagens são praticamente indistinguíveis. Mesmos símbolos nas
mesmas posições, mesmo halo, mesmas partículas nas mesmas coordenadas e cores, mesmo
contador. As únicas diferenças visíveis:

- a fonte do contador (Liberation Sans no Skia, `system-ui` no Pixi) — consequência do §3,
  não de capacidade;
- diferença de subpixel no posicionamento vertical dos símbolos.

Isso responde uma pergunta importante e mata outra:

- **Nenhum dos dois é visualmente superior nesta cena.** O halo com degradê radial, que era
  o argumento de qualidade a favor do Skia, o Pixi faz igual **assando o degradê numa
  textura uma vez** e carimbando o sprite. Custa mais linha de código e entrega a mesma
  imagem.
- Logo, **a decisão não se resolve por qualidade visual.** Resolve-se por desempenho, peso
  e custo de manutenção — e é aí que os §2, §3 e §5 mandam.

Vale registrar o que essa conclusão **não** diz: ela vale para *esta* cena. Efeitos que o
Pixi só faz com shader escrito à mão — desfoque real, máscara com caminho curvo, deformação
de carta no *squeeze* do bacará — continuam sendo território natural do Skia, e é por isso
que a recomendação do §5 é por jogo e não por projeto.

---

## 5. As decisões

### O que a POC permite congelar agora

**Unity + C# está fora do canal web.** Não por esta medição — por duas coisas que não
dependem dela: um build WebGL mínimo pesa de 5 a 10 MB comprimido, contra os 761 KB do Pixi
e os 3,6 MB do Skia, e a própria Unity não dá o Safari do iPhone como plataforma suportada.
Com o programa da Apple não pago, o iPhone é exatamente o nosso canal. **Registrado como
tecnicamente inadequado para o canal web atual**, como o §4 pedia — e o Portão 0 (§6)
continua valendo para confirmar com número, sem bloquear nada enquanto isso.
Unity segue viva para Android nativo (§1c de `estrategia-de-renderizacao.md`).

**O MSAA de framebuffer está fora, em qualquer renderer.** +24,5 ms por quadro nesta cena.
Suavização se faz por forma, ou por textura já suavizada.

**Contador que anda vai em `BitmapText`.** Regra por construção — mas a POC **não** mediu
ganho nisso nesta cena (§2), e isso fica registrado para ninguém citar um número que não
existe.

**A cena continua não sorteando nada.** Os dois braços receberam o resultado pronto e a POC
não mediu nenhum caminho em que a tela decida qualquer coisa. Isso não estava em avaliação
e não mudou.

### O que a POC NÃO permite congelar

**O renderer do caça-níqueis.** E a razão é o §0: o Skia ganhou por 4,5x num ambiente **sem
GPU**, que é precisamente onde um desenhista imediato otimizado para CPU brilha e onde o
custo de chamada do WebGL é mais punido. Os dois maiores itens da conta do Pixi — a passada
de estêncil da máscara e o preenchimento do feltro — são exatamente os que uma GPU achata.
Congelar aqui seria trocar um palpite por outro, com a diferença de ter uma tabela do lado.

O que **mudou** com a POC, e não é pouco:

| Antes da POC | Depois da POC |
|---|---|
| "Pixi para o caça-níqueis, Skia para outros quatro" | o Skia virou **candidato real também para o caça-níqueis** |
| a qualidade visual era argumento a favor do Skia | **empatou** — deixou de ser argumento (§4) |
| o peso do Skia era estimativa | **+2,9 MB, medido** — virou o principal argumento contra |
| o custo da máscara era palpite | **~21 ms, medido**, e ao contrário do que o código dizia |

E aparece um argumento novo, que só existe porque a decisão é jogo a jogo:

> **Os dois renderers não se somam de graça.** Se o Skia entrar para Roleta, Stock Market,
> Poker e as cartas — como `estrategia-de-renderizacao.md` recomenda —, os 2,9 MB do
> CanvasKit **já estão pagos**. Nesse cenário, usar Skia também no caça-níqueis custa
> **zero byte a mais** e evita manter um segundo renderer; usar Pixi custa +225 KB, uma
> segunda ponte com o casco e duas bases de código de animação para sempre.
>
> Hoje o `app/package.json` não tem nem um nem outro: nenhum dos dois está pago ainda. Por
> isso a decisão do caça-níqueis **não é independente** da decisão dos outros quatro jogos,
> e as duas devem ser tomadas juntas, depois do §6.

### A recomendação, dita como recomendação

Se o §6 confirmar em aparelho o que se viu aqui — Skia dentro do orçamento, Pixi fora —, a
escolha coerente é **Skia para os cinco jogos**, aceitando os 2,9 MB uma vez, com carga
tardia: o CanvasKit só baixa quando o jogador abre um jogo que precisa dele, nunca no
carregamento do lobby.

Se o §6 mostrar o contrário — Pixi dentro do orçamento em aparelho, como é plausível assim
que existir GPU —, então **Pixi no caça-níqueis e Skia nos outros quatro** volta a ser a
resposta certa, porque 761 KB contra 3,6 MB é uma diferença que o jogador sente no primeiro
carregamento.

**Nenhuma das duas deve ser escrita em código antes do §6.**

---

## 6. O que falta medir, e como

Roteiro executável por quem tiver os aparelhos. É o que fecha a decisão.

### 6a. Os dois braços num aparelho de verdade

Sirva `poc-renderizacao/` e abra no telefone:

```
npx serve -l 8080 poc-renderizacao
# no aparelho, na mesma rede: http://<ip>:8080/
```

A página inicial diz na hora se aquele aparelho desenha por hardware ou software, e cada
braço mostra os próprios números no rodapé ao terminar. Nenhuma ferramenta no telefone.

Aparelhos: **um iPhone** (o canal), **um Android intermediário** (o pior caso realista) e
**um Android antigo**, se houver.

Rode cada braço **três vezes** e anote quadro típico, p95 e pior quadro. Depois repita:
alternando de aba e voltando; bloqueando e desbloqueando a tela; com o aparelho já morno.
É na terceira execução com o telefone quente que a diferença aparece — e é essa que decide,
não a primeira com o aparelho frio.

### 6b. O que só o aparelho responde

| Pergunta | Como |
|---|---|
| O CanvasKit cabe na memória do iPhone? | Web Inspector no Safari, com o telefone ligado no Mac |
| Quanto os 2,9 MB custam em 5G? | tempo até a cena andar, em 5G e em Wi-Fi |
| O som fica sincronizado quando o quadro cai? | Web Audio nos dois braços, e olhar (§0) |
| A ponte do `react-native-skia` custa quanto? | repetir o braço Skia dentro de um componente React Native (§0) |
| Uma fonte reduzida aos glifos usados pesa quanto? | `pyftsubset` na Liberation Sans (§3) |

### 6c. Portão 0 — Unity WebGL

Continua como está em `estrategia-de-renderizacao.md` §4, **não executado** (§0). Um build
WebGL vazio, publicado no mesmo servidor, medido no iPhone: peso comprimido, tempo até
aparecer algo, tempo até ficar jogável, pico de memória, dez minutos aberto, alternar de
aba, bloquear e desbloquear, 5G contra Wi-Fi, e o impacto no carregamento do resto do
aplicativo.

O §5 já registra Unity como inadequada ao canal web por peso e por suporte declarado. O
Portão 0 serve para trocar esse registro por número — e para reabrir a porta com dados se o
canal virar loja.

---

## 7. O que não mudou

O servidor continua sendo a autoridade. O resultado continua vindo dele antes de qualquer
animação começar. A animação continua **contando o que já aconteceu**, e não decidindo nada
— e as duas cenas desta POC foram escritas assim de propósito, recebendo um resultado
pronto, para que a comparação não medisse um jogo que não vamos construir.

A arquitetura `Servidor → Protocolo → AdaptadorDeJogo → Renderer` continua sendo o que
torna esta decisão reversível: é ela que permite trocar o renderer de um jogo sem tocar em
regra, em dinheiro nem em rodada.
