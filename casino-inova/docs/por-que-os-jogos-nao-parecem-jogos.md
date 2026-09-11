# Por que os jogos não parecem jogos — diagnóstico no código

> Frente: **GAME PRESENTATION REBUILD**. Este documento é o passo 1: achar no código o que
> produz a impressão de "componentes React colocados por cima de uma fotografia de uma
> mesa". Não é opinião sobre estética — cada item aponta arquivo e linha.

## O resumo em uma frase

A mesa é uma **fotografia de fundo**; o jogo é um **formulário vertical** desenhado por
cima dela. Nenhuma das duas coisas é um erro isolado — juntas, elas são exatamente a
descrição do problema.

```tsx
// app/src/screens/games/BaccaratScreen.tsx
<GameBackdrop source={TABLE_IMAGES.bacara}>   // ← a mesa é uma FOTO de fundo
  <ScrollView>                                 // ← e o jogo ROLA por cima dela
    <Text style={styles.title}>Bacará</Text>
    <View style={styles.table}>
      <Text style={styles.placeholderText}>Escolha onde apostar e mande jogar.</Text>
    </View>
    <Text style={styles.sectionLabel}>Sua aposta</Text>
    <Pressable><Text>Banca · 1.95</Text></Pressable>     // ← a aposta é um botão de rádio
    <SeletorDeAposta … />
    <Pressable><Text>Apostar</Text></Pressable>          // ← e um botão de enviar
  </ScrollView>
</GameBackdrop>
```

Um bacará de verdade não tem "Sua aposta" escrito em cima de um botão. Ele tem **três
zonas no pano** — Jogador, Banca, Empate — e a pessoa **põe a ficha na zona**. A diferença
não é enfeite: é a diferença entre jogar e preencher um formulário.

---

## Os cinco defeitos estruturais, com evidência

### 1. A mesa é papel de parede, e o degradê apaga justamente onde se joga

`app/src/components/GameBackdrop.tsx` põe a foto no fundo e um degradê por cima:

```tsx
colors={['rgba(11,15,13,0.25)', colors.background]}
locations={[0, 0.8]}
```

De 80% da altura para baixo, a foto está **coberta por cor sólida**. E é exatamente aí que
ficam os controles em todas as dez telas. Ou seja: a metade de baixo da mesa não existe
visualmente — é um painel escuro com widgets. A foto só se vê no topo, onde nada acontece.

### 2. O jogo rola. Mesa de cassino não rola.

`ScrollView` envolvendo a área de jogo em **sete das dez telas**:

| Tela | Onde |
|---|---|
| RouletteScreen | linha 263 |
| BlackjackScreen | linha 220 |
| BaccaratScreen | linha 138 |
| StockMarketScreen | linha 214 |
| DominoScreen | linha 185 (a corrente rola de lado) |
| BancaFrancesaMesaScreen | linhas 295 e 368 |
| BacBoMesaScreen | linha 421 |

Rolagem é o gesto de um documento. Uma mesa cabe na tela ou não é uma mesa: o que não cabe
tem que ser resolvido por disposição — encolher, sobrepor, esconder atrás de um toque —, e
não empurrado para baixo da dobra.

### 3. A aposta é um `radio button`, não uma ficha num lugar

O padrão se repete: uma linha de `Pressable` com `<Text>` dentro, e um botão "Apostar" que
envia. Em `BaccaratScreen`:

```tsx
{BET_OPTIONS.map((option) => (
  <Pressable style={[styles.betTypeChip, betType === option.type && styles.betTypeChipActive]}>
    <Text>{option.label} · {option.multiplier}</Text>
  </Pressable>
))}
```

Onde deveria haver **zonas no pano** (bacará, blackjack, bac bo) ou **casas** (banca
francesa, roleta), há uma lista de opções com rótulo e multiplicador em texto.

As duas telas que **já fazem certo** e servem de referência: `PanoDaBancaFrancesa` e
`PanoDaRoleta` — nelas a ficha vai para a casa, e a casa é um lugar no pano.

### 4. Peça de jogo desenhada como texto

`app/src/screens/games/DominoScreen.tsx`:

```tsx
function tileLabel(tile: DominoTile): string {
  return `${tile.a}|${tile.b}`;
}
…
<Text style={styles.cardLabel}>{tileLabel(tile)}</Text>
```

A peça de dominó é a string `"3|5"` dentro de um botão. O projeto **já tem** a peça de
verdade — `app/src/components/CorrenteDeDomino.tsx` com `DOMINO_TILE_IMAGES` —, mas ela é
usada só na mesa online (`DominoMesaScreen`). O modo contra o bot, que é o que se abre
primeiro, ficou com o texto.

Cartas e dados **não** têm esse problema: `Carta.tsx` e `DadoFisico.tsx` desenham objeto de
verdade.

### 5. O estado do jogo é contado por escrito

`BaccaratScreen`, no lugar da mesa:

```tsx
<Text style={styles.placeholderText}>Escolha onde apostar e mande jogar.</Text>
```

e o resultado:

```tsx
<Text>{OUTCOME_LABEL[round.winner]}{round.totalReturn > 0 ? ` — +${…} fichas` : ' — não foi dessa vez'}</Text>
```

Quem ganhou, quanto pagou e o que fazer agora chegam como frases. Num jogo, isso é trabalho
da **cena**: a ficha empilha na zona vencedora, a carta vira, o pagamento desliza até a
pilha do jogador. O texto é a legenda, não o acontecimento.

---

## O que NÃO é o problema

Vale escrever, porque economiza trabalho:

- **Não é o renderer.** Nada dos cinco itens acima melhora trocando React Native por Pixi,
  Skia ou Unity. Um formulário desenhado em WebGL continua sendo um formulário. A decisão
  de renderer (`docs/RENDERING_STRATEGY.md` §5) resolve *fluidez* e *efeito*, e continua
  travada onde está — esperando medição em aparelho (§6).
- **Não é a arte.** As fotos de mesa, as cartas, os dados e as peças de dominó existem e
  são boas. O problema é que a arte está no fundo e a interação está por cima, em vez de a
  interação ACONTECER na arte.
- **Não é a matemática.** RTP, pagamento, carteira e extrato estão provados
  (`verify:pagamento`, `verify:liquidacao`, `verify:precisao`).

## A ordem de ataque que isto sugere

1. **Zonas de aposta no pano** para bacará, blackjack e bac bo — é o item que mais muda a
   sensação por unidade de trabalho, e há dois panos prontos para copiar a técnica.
2. **Tirar a rolagem** das telas de jogo: o que não cabe vira sobreposição ou gaveta.
3. **Peça de dominó de verdade** no modo contra o bot — o componente já existe.
4. **Degradê que não mata a mesa**: escurecer para legibilidade sem cobrir o pano onde a
   ficha vai cair.
5. **A cena conta o resultado**; o texto vira legenda.

Cada um desses é independente do renderer e pode ser feito agora. O que depende do renderer
— reel engine do caça-níqueis, roda da roleta com física, shakers do bac bo — continua
esperando o §6, e está registrado lá.
