# Tamanhos das imagens do carrossel — o que é preciso

## O QUADRO

| # | Formato | Tamanho a pedir | Proporção | Serve |
|---|---|---|---|---|
| 1 | **Telemóvel** | **1440 × 2400** | 0,60 (vertical) | Todos os telemóveis |
| 2 | **Tablet** | **1800 × 1440** | 1,25 | Tablets e iPads |
| 3 | **Computador** | **3840 × 1920** | 2,00 (larga) | Portáteis, monitores, 2K e televisões 4K |

**Três por cada destaque × 5 destaques = 15 imagens.**

Os nomes dos ficheiros:

```
1-telemovel   1-tablet   1-computador
2-telemovel   2-tablet   2-computador
3-telemovel   3-tablet   3-computador
4-telemovel   4-tablet   4-computador
5-telemovel   5-tablet   5-computador
```

---

## PORQUE SÃO ESTES NÚMEROS, E NÃO OUTROS

Não são inventados. Forcei o palco do carrossel a uma proporção fixa em
cada classe de ecrã e medi o que sobra:

| Ecrã | Palco que vai ter | Proporção |
|---|---|---|
| Telemóvel 320 | 320×500 | 0,64 |
| iPhone 390 | 390×650 | 0,60 |
| iPhone 430 | 430×717 | 0,60 |
| iPhone Pro Max 440 | 440×733 | 0,60 |
| Tablet 768 | 768×614 | 1,25 |
| iPad 834 | 834×667 | 1,25 |
| Portátil 1024 | 1024×512 | 2,00 |
| Portátil 1366 | 1366×676 | 2,02 |
| MacBook 1440 | 1440×720 | 2,00 |
| Monitor 1920 | 1920×950 | 2,02 |
| Ecrã 2K | 2560×1267 | 2,02 |
| Televisão 4K | 3840×1901 | 2,02 |

**A imagem passa a ter exactamente a forma do palco.** Enche de ponta a
ponta, sem barras escuras ao lado e sem cortar nada.

O desvio máximo é de 0,60 para 0,64, e só no telemóvel mais pequeno que
existe. São 3% de cada lado — a margem de segurança abaixo absorve isso.

---

## REGRAS PARA AS IMAGENS

Valem para as quinze.

1. **Margem de segurança de 6%.** Nada de importante — letra, número,
   logótipo, rosto — a menos de 6% de qualquer bordo. É o que garante
   que aquele desvio de 3% no telemóvel pequeno nunca toca no texto.

2. **Faixa livre em baixo — e o tamanho MUDA com o formato:**

   | Formato | Faixa livre em baixo |
   |---|---|
   | Telemóvel 1440×2400 | **30% da altura** (720px em baixo, vazios) |
   | Tablet 1800×1440 | **24% da altura** (346px) |
   | Computador 3840×1920 | **20% da altura** (384px) |

   Escura e vazia, sem nada desenhado — nem logótipo, nem figura, nem
   letra. É onde entram os botões do site **e os comandos do carrossel**
   (as bolinhas e o «Pausar»), que são HTML porque têm de ser clicáveis e
   mudar de língua. **Não desenhe botões.**

   Da primeira vez pedi 18% em todos, e foi pouco: no telemóvel os
   botões ficaram a assentar em cima do logótipo. Medi o que os botões e
   os comandos ocupam mesmo — 140px — e é isto que dá em cada formato.

3. **Sem cortar e sem esticar.** Cada formato é composto de raiz para a
   sua forma. A do telemóvel não é a do computador cortada, nem ao
   contrário — se for, o texto fica espremido ou minúsculo.

4. **As quinze da mesma família.** Mesma luz, mesma paleta, mesma letra,
   logótipo sempre no mesmo canto.

5. **O texto é o mesmo nos três formatos** do mesmo destaque. Só muda a
   arrumação: no computador o texto fica à esquerda e a figura à
   direita; no telemóvel fica tudo empilhado.

---

## COMO ARRUMAR CADA FORMATO

**Computador (3840×1920, deitada)**
Texto à esquerda, figura à direita, como está agora. É o único em que
isso funciona.

**Tablet (1800×1440, quase quadrada)**
Texto em cima, figura em baixo — ou texto à esquerda com a figura mais
pequena à direita. Não deixe o texto colado ao topo.

**Telemóvel (1440×2400, ao alto)**
Tudo empilhado e centrado: título em cima, uma linha de apoio, os
números, e a figura em baixo. **A letra tem de ser bem maior** do que na
versão de computador — numa imagem estreita, texto pequeno não se lê.

---

## O QUE EU MUDO DO MEU LADO

Assim que as imagens chegarem:

1. O palco passa a ter a proporção fixa de cada classe (0,60 / 1,25 /
   2,00), em vez da conta que faz hoje.
2. A imagem passa a `cover` — enche o palco todo — em vez de `contain`,
   que era o que deixava as barras escuras ao lado.
3. Faço as variantes WebP em vários tamanhos, cada uma abaixo de 120 KB.
4. Volto a medir nos doze ecrãs do quadro acima e mostro-lhe o
   resultado antes de dar por acabado.

---

## O QUE CORREU MAL DESTA VEZ, PARA NÃO SE REPETIR

Perguntou-me se os tamanhos serviam e ofereceu-se para gerar mais. Eu
respondi que não era preciso.

Estava errado. As imagens de 1536×1024 têm proporção 1,50 e o palco do
computador tem 2,02. Como não queria cortar o título, mandei mostrar a
imagem inteira — e o que sobrou foram barras escuras dos dois lados.
Tecnicamente nada foi cortado, mas o resultado no ecrã é mau na mesma, e
era isso que interessava.

**O erro foi meu: devia ter-lhe pedido as proporções certas quando
perguntou.** É o que este documento faz agora.
