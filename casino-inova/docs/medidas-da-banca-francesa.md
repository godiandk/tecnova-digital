# Medidas do pano da Banca Francesa

O que está realmente desenhado na arte da mesa, medido pixel a pixel — e onde o
`mapaDosTampos.ts` de hoje diverge dela.

- **Arte medida:** `app/assets/images/tampos-16x9/computador/banca-francesa.webp`, 1920x1080
- **Arte conferida:** `app/assets/images/tampos-16x9/tablet/banca-francesa.webp`, 1600x900
- **Números:** `app/src/data/arcosDaBanca.ts`
- **Conferência:** `app/verificacao/verifica-arcos-da-banca.mjs` (160 checagens, exit 1 em
  qualquer fração fora de 0,004)

Toda fração é do lado correspondente: **x é fração da largura, y é fração da altura**.
Como a arte é 16:9, um círculo perfeito em pixel sai com `raioX ≠ raioY` — a razão é 9/16.
Isso é unidade, não erro de medição.

---

## 1. O que a arte tem

Cada casa (GRANDE e PEQUENO) é uma **faixa em arco**, não um retângulo:

- um **arco de fora** e um **arco de dentro**, os dois traços dourados de 3 a 5 px;
- um **bico reto** fechando cada ponta — a casa termina em ponta, não em quina redonda;
- um **disco** pendurado no meio, que é a casa da aposta na LINHA e que **interrompe** o
  arco de dentro por onde passa;
- os algarismos flutuando dentro da faixa.

**Não existe um terceiro arco.** O pedido descrevia três (fora, linha dos números,
dentro); a arte tem dois. O que parece um terceiro é o bico reto das pontas, que sobe
enquanto o arco desce. Conferido coluna a coluna: em x=680 a janela inteira do GRANDE tem
exatamente duas corridas de dourado, y 413..416 e y 508..511.

**A "linha dos números" não é traço, é lugar.** E os seis algarismos não estão todos na
mesma curva:

| algarismo | onde está | distância até a linha do meio da faixa |
|---|---|---|
| 14 | meio da faixa | 1,9 px |
| 16 | meio da faixa | 0,5 px |
| 5  | meio da faixa | 1,3 px |
| 7  | meio da faixa | 3,2 px |
| 15 | **em cima do arco de fora**, que ele interrompe | 58 px acima do meio |
| 6  | **em cima do arco de fora**, que ele interrompe | 53 px acima do meio |

O motivo está desenhado: no centro o meio da faixa é ocupado pelo disco da LINHA, e o
algarismo do meio foi subido pra sair da frente dele. Por isso `numeros` no
`arcosDaBanca.ts` é a **linha do meio da faixa** (o lugar de 14/16/5/7), medida como o
ponto médio entre os dois arcos coluna a coluna — e não um traço que exista na arte.

---

## 2. Os arcos e os discos

Elipses alinhadas aos eixos: `x = centro.x·L + raioX·L·cos t`, `y = centro.y·A + raioY·A·sin t`,
com `t` em graus, 0 = leste, crescendo pra baixo (é a orientação da tela).

| casa | curva | centro.x | centro.y | raioX | raioY | de t | até t | de x | até x | erro médio | pior erro | pontos |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| grande | fora | 0,49894 | 0,14448 | 0,31462 | 0,26951 | 46,25° | 133,81° | 0,28021 | 0,71823 | 0,35 px | 2,94 px | 781 |
| grande | numeros | 0,49863 | 0,14311 | 0,34437 | 0,31346 | 50,56° | 129,29° | 0,28021 | 0,71823 | 0,32 px | 1,53 px | 759 |
| grande | dentro | 0,49857 | 0,23631 | 0,32689 | 0,26251 | 33,45° | 146,78° | 0,22552 | 0,77135 | 0,47 px | 2,74 px | 963 |
| grande | disco | 0,49685 | 0,46967 | 0,02692 | 0,03517 | −180° | 180° | — | — | 0,92 px | 2,27 px | 1021 |
| pequeno | fora | 0,49794 | 0,15367 | 0,48126 | 0,45067 | 47,09° | 133,21° | 0,16771 | 0,82708 | 0,46 px | 3,12 px | 1218 |
| pequeno | numeros | 0,49854 | 0,16237 | 0,51004 | 0,48749 | 50,00° | 130,41° | 0,16771 | 0,82708 | 0,42 px | 1,32 px | 1166 |
| pequeno | dentro | 0,49911 | 0,25128 | 0,50111 | 0,44392 | 41,11° | 139,56° | 0,11771 | 0,87656 | 0,55 px | 2,12 px | 1352 |
| pequeno | disco | 0,49625 | 0,66989 | 0,02777 | 0,03745 | −180° | 180° | — | — | 0,97 px | 2,35 px | 1131 |

**Ápices** (`centro.y + raioY`, o ponto mais baixo na tela, no centro da mesa):

| | fora | numeros | dentro |
|---|---|---|---|
| grande | 0,41399 | 0,45657 | 0,49882 |
| pequeno | 0,60434 | 0,64986 | 0,69520 |

**Pontas (bicos) de cada casa:**

| casa | esquerda | direita |
|---|---|---|
| grande | x 0,22552 · y 0,38009 | x 0,77135 · y 0,38102 |
| pequeno | x 0,11771 · y 0,53935 | x 0,87656 · y 0,54306 |

O eixo da foto **não é x = 0,5**: as pontas do GRANDE (433 e 1481 px) têm meio em 957 px e
as do PEQUENO (226 e 1683) em 954,5; os seis `centro.x` ficam entre 0,49794 e 0,49911. O
eixo está uns 3 px à esquerda do meio da imagem — 0,0016 da largura.

### Por que elipse e não círculo

A mesa é uma foto: os arcos estão em perspectiva. O resíduo do ajuste circular é
sistemático e simétrico em torno do centro — no arco de dentro do GRANDE, o resíduo médio
em doze faixas de x dá −2,1 / +2,5 / +1,6 / +0,2 / −0,9 / −1,8 / −1,9 / −1,2 / −0,1 /
+1,2 / +2,2 / −1,4 px. Isso é curvatura que falta ao modelo, não ruído.

| curva | círculo (médio / pior) | elipse (médio / pior) |
|---|---|---|
| grande fora | 0,67 / 2,62 px | 0,35 / 2,94 px |
| grande numeros | 0,46 / 1,89 px | 0,32 / 1,53 px |
| grande dentro | 1,60 / **8,78 px** | 0,47 / 2,74 px |
| grande disco | 4,46 / 8,79 px | 0,92 / 2,27 px |
| pequeno fora | 0,92 / 4,07 px | 0,46 / 3,12 px |
| pequeno numeros | 0,73 / 3,35 px | 0,42 / 1,32 px |
| pequeno dentro | 1,49 / **7,68 px** | 0,55 / 2,12 px |
| pequeno disco | 4,20 / 8,71 px | 0,97 / 2,35 px |

Os dois piores em negrito passam de 0,008 da altura — o dobro da folga que a conferência
exige. A elipse ganha no erro médio nos oito casos. Todos os oito usam elipse: um conjunto
misto seria pior de consumir e não teria como se justificar, já que a perspectiva vale
pra mesa inteira.

---

## 3. Plaqueta, letreiros, brasão e tigela

**Plaqueta dos ASES** — quadrilátero em perspectiva, inclinado pra esquerda conforme
desce. Os cantos são chanfrados na arte; o ponto devolvido é o meio do chanfro (~10 px de
incerteza).

| canto | x | y |
|---|---|---|
| superior esquerdo | 0,18229 | 0,24815 |
| superior direito | 0,25260 | 0,24907 |
| inferior direito | 0,24427 | 0,32037 |
| inferior esquerdo | 0,16979 | 0,32130 |

Caixa envolvente: 0,16979 / 0,24444 / 0,25312 / 0,32778. Ela sobra 24 px de feltro no
canto superior esquerdo e 17 px no inferior direito, porque a aresta esquerda escorrega
0,0125 e a direita 0,0083 do topo pra base.

**Letreiros** (esquerda / topo / direita / base):

| | esquerda | topo | direita | base |
|---|---|---|---|---|
| GRANDE | 0,43542 | 0,33796 | 0,56250 | 0,36019 |
| PEQUENO | 0,42240 | 0,53704 | 0,57031 | 0,56944 |
| 14 | 0,29375 | 0,38981 | 0,32552 | 0,42407 |
| 15 | 0,48333 | 0,38981 | 0,50990 | 0,41667 |
| 16 | 0,66823 | 0,38981 | 0,69948 | 0,42593 |
| 5 | 0,24063 | 0,57222 | 0,26354 | 0,60370 |
| 6 | 0,48750 | 0,58519 | 0,50417 | 0,61574 |
| 7 | 0,72188 | 0,57685 | 0,73750 | 0,61111 |
| brasão CI | 0,46458 | 0,73704 | 0,52812 | 0,84074 |

Os algarismos das pontas são **girados** pra acompanhar a tangente do arco: no "14" o '1'
está 9 px acima do '4'; no "16" é o contrário, espelhado. E são maiores na tela que o do
meio, porque estão mais perto de quem olha.

O brasão é dourado apagado — traço de cor média (71, 62, 37) contra feltro (8, 22, 11).
Com a máscara principal (`r > 85`) ele se despedaça em seis cacos de 10 a 57 px e a caixa
sai errada (x 930..979, y 800..863: só a coroa e dois pedaços de louro). Com o filtro
próprio `(r > 45) && (r − b > 15) && (g > 27)` a caixa é estável: de corte 45 a 65 não se
mexe um pixel.

**Tigela:**

| | esquerda | topo | direita | base |
|---|---|---|---|---|
| moldura (bandeja inteira) | 0,31667 | 0,12130 | 0,68281 | 0,27315 |
| couro (caixa envolvente) | 0,33594 | 0,16389 | 0,66250 | 0,25556 |
| maior retângulo dentro do couro | 0,37500 | 0,17222 | 0,62031 | 0,25463 |

---

## 4. Onde o mapa de hoje diverge da arte

Nada disso foi alterado neste trabalho — o `mapaDosTampos.ts` não foi tocado. É a lista do
que a conferência imprime como **aviso** no fim.

1. **As casas são arcos, e o mapa usa retângulos.** A faixa do GRANDE vai de x 0,22552 a
   0,77135 e de y 0,3390 (quina do bico) a 0,49882 (ápice do arco de dentro); a caixa do
   mapa é `[0,226, 0,300, 0,771, 0,505]`. Em x bate bem; em y ela cobre a caixa toda,
   inclusive o feltro acima do arco, que não é da casa.

2. **O PEQUENO começa acima de onde o mapa diz.** O ponto mais alto da faixa é a quina do
   bico do arco de fora, em y ≈ 0,4821 — e a caixa do mapa começa em 0,510. As duas
   quinas do PEQUENO ficam fora da casa. E como a caixa do GRANDE termina em 0,505
   enquanto o ápice do arco de dentro dele está em 0,49882, sobra uma faixa de 0,005 que
   não é de ninguém.

3. **A caixa da LINHA invade o arco.** O disco impresso do GRANDE tem 0,054 × 0,070 da
   arte (103 × 76 px); a caixa `linha-grande` do mapa tem 0,120 × 0,125 (230 × 135 px) —
   2,2× mais larga e 1,8× mais alta que o desenho. No PEQUENO, 2,2× e 1,7×.

4. **Os bicos não estão no mapa.** A casa vai 0,055 da largura mais longe, em cada ponta,
   do que o arco de fora sugere — 105 px por lado na arte de 1920. É onde a ficha de quem
   senta na quina da mesa iria.

5. **`TIGELA_DA_BANCA.fora` não bate com a bandeja.**

   | lado | mapa | medido | diferença |
   |---|---|---|---|
   | esquerda | 0,3245 | 0,3167 | 0,0078 |
   | topo | 0,1630 | 0,1213 | **0,0417** |
   | direita | 0,6630 | 0,6828 | **0,0198** |
   | base | 0,2722 | 0,2732 | 0,0010 |

   A bandeja sobe mais e vai mais pra direita do que o mapa diz. E
   `TIGELA_DA_BANCA.chao.base = 0,262` passa 0,0064 (7 px) do fim do couro (0,2556): a
   tira de baixo do "chão" já está em cima do aro de latão da frente. Nada disso quebra o
   jogo hoje — o dado assenta no meio —, mas muda se alguém mexer no tamanho do dado.

6. **`ARCO_DO_GRANDE` e `ARCO_DO_PEQUENO` estão certos, e são só metade da história.** As
   duas listas descrevem o arco de **dentro**, e batem com a medição nova dentro de 0,0036
   e 0,0030 da altura. O arco de fora não existe no mapa.

---

## 5. O tablet é a mesma composição

A arte de tablet (1600x900) foi medida com o mesmo programa. Comparando as **curvas**, a
maior distância entre as duas artes ao longo dos seis arcos é **0,00022 da altura** — um
quarto de pixel em 1080. Os ápices batem em 0,00012 e os discos em 0,0001. Nenhum
parâmetro isolado diverge mais que 0,00344. **O mesmo mapa serve pras duas.**

Uma armadilha que aparece nessa comparação e vale registrar: no arco de fora do GRANDE o
`centro.y` diverge 0,00344 entre as artes e o `raioY` diverge 0,00336 — mas a **soma**
deles, que é o ápice, diverge 0,00012. O ajuste de elipse num arco raso tem uma direção
mole em que centro e raio deslizam juntos sem mudar a curva. Comparar `raioY` entre artes
diz pouco; comparar a curva diz tudo.

---

## 6. Como refazer

### A conferência (é a reprodução principal)

```bash
cd app
node verificacao/verifica-arcos-da-banca.mjs
```

Ela refaz a medição inteira em Node — máscara de dourado, peneira de componente, varredura
coluna a coluna, corte do bico e os ajustes — e compara com o `arcosDaBanca.ts`. Sai 1 em
qualquer fração fora de 0,004. Leva meio segundo.

Ela lê `app/verificacao/banca-francesa-1920x1080.png`, que é a arte convertida sem perda
(o Node não abre WebP sem biblioteca, e biblioteca nova numa conferência é conferência que
ninguém roda). Os dois arquivos têm o sha256 anotado no script, e ele confere os dois: se
a arte for trocada e o PNG não, a conferência acusa e diz o que fazer.

### Refazer a medição em Python (pra conferir o tablet, ou depois de trocar a arte)

Precisa de `PIL`, `numpy` e `scipy`. Os cinco passos, na ordem:

1. **Máscara de dourado:** `(r > 85) & (r − b > 30) & (g > 55)`. Dá 165.944 pixels na arte
   de computador (8,00%).
2. **Peneira de componente:** dentro da janela da casa, só ficam as componentes conexas
   (8 vizinhos) com pelo menos 1.500 px — que são as duas metades da faixa (3.402 e 3.405
   no GRANDE; 5.394 e 5.340 no PEQUENO). Tudo abaixo disso é letra, algarismo ou disco: 14
   manchas / 4.842 px no GRANDE, 48 / 7.804 no PEQUENO. Não há nada entre 1.131 (o maior
   descarte) e 3.402 (a menor metade), então o corte não é arbitrário.
3. **Corrida fina:** seguindo o traço coluna a coluna, só vale corrida vertical de até
   6 px. O traço tem 3 a 5; letra e algarismo são manchas de 8 a 30. Pegou o que escapou
   da peneira: 3 colunas no GRANDE, 5 no PEQUENO.
4. **Tirar o bico:** o arco é monótono do ápice pra cada lado e o bico vira pro outro lado
   (no bico esquerdo do GRANDE a inclinação do segmento é −0,409 contra +0,466 do arco na
   quina). Andando do ápice pra fora, para quando o y sobe mais de **1 px**. Tira 204
   colunas no arco de fora do GRANDE e 186 no do PEQUENO; **zero** nos arcos de dentro,
   que não têm bico — que é a prova de que o critério não corta arco bom.
5. **Ajuste:** círculo (`x²+y²+Dx+Ey+F=0`) e elipse alinhada aos eixos
   (`x²+Cy²+Dx+Ey+F=0`), os dois por mínimos quadrados **lineares** em coordenadas
   normalizadas (média fora, dividido pelo maior desvio-padrão). Forma fechada, sem
   otimizador — é o que faz o Node chegar ao mesmo número, e não a "quase o mesmo".

**A folga de 1 px do passo 4 já esteve errada, e vale a nota.** O centro de uma corrida de
3 ou 4 px cai numa grade de meio pixel, então duas colunas vizinhas do mesmo traço podem
diferir 1 px só por arredondamento. Com folga de 2 px a varredura passava seis colunas
além da quina (ia até x=1382 no GRANDE, quando a quina está em 1379) e a curva ajustada
errava esses pontos em 5,2 px na vertical — acima dos 4,3 px que a conferência aceita. Com
folga de 1 px os 6.239 pontos dos seis arcos ficam todos a menos de 3,5 px da curva (o
pior é 3,44 px). E com folga 0 o corte come arco bom: o arco de fora do PEQUENO desaba de
1.218 pontos pra 63.

### Regerar o PNG da conferência

```bash
cd app
python3 -c "from PIL import Image; \
  Image.open('assets/images/tampos-16x9/computador/banca-francesa.webp') \
       .convert('RGB').save('verificacao/banca-francesa-1920x1080.png', compress_level=9)"
```

Depois refaça as medidas, atualize o `arcosDaBanca.ts` e os dois `sha256` do
`verifica-arcos-da-banca.mjs`.
