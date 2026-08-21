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

2. **Faixa livre em baixo.** Escura e vazia, sem nada desenhado — nem
   logótipo, nem figura, nem letra. É onde entram os botões do site **e
   os comandos do carrossel** (as bolinhas e o «Pausar»), que são HTML
   porque têm de ser clicáveis e mudar de língua. **Não desenhe botões.**

   O que os cartazes trazem, medido nos PNG dos três idiomas
   (português, inglês e espanhol — quarenta e cinco ao todo):

   | Formato | Faixa que reservam | Pior caso |
   |---|---|---|
   | Telemóvel | 19,0% a 21,7% | destaque 5 |
   | Tablet | 28,5% a 30,6% | destaque 5 |
   | Computador | 21,0% a 24,2% | destaque 3, em inglês |

   Chega para o que o site põe lá em cima. Ver a secção do fim.

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

## O QUE FICOU FEITO, E MEDIDO

1. O palco tem agora a proporção fixa de cada classe — 3/5 no telemóvel,
   5/4 no tablet, 2/1 no computador. Medido: 0,60, 1,25 e 2,00 exactos.
2. A imagem passou a `cover`. Como a forma do palco é a mesma do cartaz,
   `cover` não corta nada — e acabaram as barras escuras dos lados.
3. Cada cartaz tem variantes WebP: cinco larguras no telemóvel, quatro no
   tablet, cinco no computador. Quase todas abaixo dos 120 KB; só as de
   2560 e 3840 passam, de propósito, porque é aí que a letra aparece ao
   tamanho a que foi desenhada e não vale a pena esfarelá-la.
4. Só o primeiro destaque vem no arranque. Os outros quatro guardam os
   endereços em `data-srcset` e só os passam a valer quando lhes chega a
   vez.

### A mobília teve de encolher

A faixa desenhada não chegava para os botões e os comandos como estavam:
no telemóvel assentavam em cima do logótipo, e num portátil de 1024px o
palco só tem 512px de altura — os comandos empilhados pediam 28,6% dele.

O que mudou: o intervalo entre os botões e os comandos passou de 44px
para 24px; num palco largo os comandos saem de baixo dos botões e vão
para o canto direito da faixa; e a 360px deixam de partir em duas filas.

O que a mobília pede agora, contra o que o cartaz reserva:

| Ecrã | Palco | Mobília | Cartaz reserva |
|---|---|---|---|
| Telemóvel 360 | 360×600 | 17,0% | 19,0% |
| iPhone 390 | 390×650 | 16,0% | 19,0% |
| iPhone 430 | 430×717 | 14,5% | 19,0% |
| Tablet 768 | 768×614 | 19,7% | 28,5% |
| iPad 834 | 834×667 | 18,1% | 28,5% |
| Portátil 1024 | 1024×512 | 15,7% | 21,0% |
| MacBook 1440 | 1440×720 | 11,2% | 21,0% |
| Monitor 1920 | 1920×960 | 8,4% | 21,0% |
| Telemóvel deitado 844 | 844×422 | 12,3% | 21,0% |
| iPhone SE deitado 568 | 568×284 | 18,3% | 21,0% |

Verificado em 17 tamanhos de ecrã × 3 línguas × 5 destaques — 255
casos, cada um contra a faixa do cartaz daquela língua.

Os cartazes existem nos três idiomas e trocam com o seletor de língua.
Como isso está ligado, ver `cartazes-por-idioma.md`.

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
