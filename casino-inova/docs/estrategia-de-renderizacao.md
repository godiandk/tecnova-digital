# Estratégia de renderização — ficha técnica jogo a jogo

Decisão pedida: parar de escolher uma tecnologia para o projeto inteiro e escolher **a
melhor para cada jogo**, com Unity + C# e PixiJS como opções ativas de implementação.

O casco do aplicativo — menu, lobby, login, carteira, perfil, histórico, navegação, telas
administrativas — **fica onde está**. O que está em avaliação são os dez jogos.

---

## 0. A restrição que manda em tudo, dita antes de qualquer recomendação

**Como o jogo chega no jogador hoje: pelo navegador.**

O programa de desenvolvedor da Apple não vai ser pago, então no iPhone o Casino Inova é um
site aberto no Safari. Isso não é preferência de arquitetura, é o canal de distribuição — e
ele muda a conta de renderização inteira:

| | PixiJS | Skia (react-native-skia) | Unity WebGL |
|---|---|---|---|
| Peso que o jogador baixa | ~400 KB comprimido | ~2,9 MB (CanvasKit em WebAssembly) | 5–10 MB no mínimo, 15–40 MB com conteúdo |
| Primeiro carregamento | imediato | rápido | segundos, em rede boa |
| Memória | baixa | média | 200–500 MB de heap |
| Safari no iPhone | é o alvo natural | funciona | a própria Unity não dá como suportado |
| Mesmo código no celular nativo | não (é web) | sim | sim, via Unity as a Library |

**A leitura honesta:** Unity é excelente, e é excelente exatamente onde nós não estamos
hoje — dentro de um aplicativo instalado pela loja. No canal que temos, ela paga o preço
mais alto justamente na plataforma mais frágil.

Isso **não é um "não"**. É a ordem em que a avaliação tem que acontecer: o teste que pode
desqualificar é barato e vem primeiro. Ver §4.

E existe um caminho real que reabre a porta: o Google Play custa 25 dólares uma vez. Um
aplicativo Android nativo com Unity nos jogos pesados, e a web com PixiJS, é uma
arquitetura legítima — e é uma decisão de produto sobre canal, não sobre renderer.

---

## 1. As fichas técnicas

O número que mais decide não é "é um jogo?", é **quantos objetos mudam por quadro** e
**que primitivas de desenho o jogo precisa**. Estas duas colunas explicam quase todas as
recomendações abaixo.

### 1. Caça-Níqueis — **PixiJS** (Unity se o canal virar loja)

| | |
|---|---|
| Objetos animados | 25–40 símbolos em movimento contínuo + 100–500 partículas no big win |
| Precisa de | batching de sprite, atlas, filtros, máscara, glow, partículas, timeline longa |
| Física visual | nenhuma |
| Dificuldade no celular | alta — é o único jogo que estoura o React Native de verdade |

**É o único jogo da casa que exige um renderer de jogo.** Cinco rolos girando com símbolos
saindo e entrando, antecipação (o rolo que desacelera antes de parar num scatter), linhas
de prêmio acendendo em sequência, cascata, multiplicador subindo, e uma sequência de big
win com partículas — isso é centenas de objetos por quadro e várias animações
simultâneas. Não é caso de heurística: é a diferença entre um slot e uma lista que desce.

PixiJS entrega isso no canal que temos hoje, com 400 KB. Unity entregaria mais (partículas,
shaders, timeline, câmera) e custaria o canal.

### 2. Roleta Europeia — **Skia**

| | |
|---|---|
| Objetos animados | 2 que importam (roda e bola) + fichas |
| Precisa de | caminho curvo, máscara, degradê radial, desfoque de movimento |
| Física visual | trajetória da bola com desaceleração — já existe, e é nossa |

Contagem de objetos baixíssima; a dificuldade é **qualidade de desenho**, não quantidade.
Hoje a roda são camadas com `transform` e a luz de vitória são três elipses concêntricas —
porque o React Native não tem degradê radial. Isso é exatamente o buraco que o Skia
preenche: caminho, máscara, degradê, sombra e *shader*, com o mesmo TypeScript e no mesmo
projeto. PixiJS resolveria também, mas traria um segundo motor de desenho para ganhar
pouco, e Unity seria um canhão para dois objetos.

### 3. Blackjack — **Reanimated + Skia na carta**

| | |
|---|---|
| Objetos animados | ~10 cartas, algumas fichas |
| Precisa de | arco da distribuição, virada com perspectiva, sombra que acompanha, canto arredondado |

A qualidade aqui é **timing**, não potência: o arco em que a carta sai da sapata, a
antecipação antes de virar, o atraso entre a carta do jogador e a do crupiê. Reanimated faz
o movimento; o Skia faz a carta parecer uma carta (sombra projetada que muda com a altura,
brilho na virada, canto recortado). Engine completa para dez cartas seria custo sem ganho.

### 4. Bacará — **igual ao Blackjack**

Mesma contagem, mesmas primitivas. O que ele tem a mais é o *squeeze* — a revelação lenta
da carta, dobrando a ponta — e isso é máscara e deformação: Skia.

### 5. Bac Bo — **fica onde está**, Skia se quisermos o vidro

| | |
|---|---|
| Objetos animados | 4 dados |
| Física visual | nossa, já pronta e conferida (240 dados param na face que o servidor sorteou) |

Quatro objetos. O motor de física é nosso, roda sem tela e é provado. Trocar o renderer
aqui melhoraria o **vidro do agitador** (refração, reflexo) e nada mais. Isso é um ganho
real, mas pequeno, e é um caso de Skia — não de Unity.

### 6. Stock Market — **Skia**

| | |
|---|---|
| Objetos animados | um caminho com centenas de pontos, redesenhado a cada quadro |
| Precisa de | caminho, preenchimento com degradê, recorte, linha animada |

É o caso clássico de Skia e o segundo jogo mais exigente da casa. Um gráfico vivo com
preenchimento em degradê e indicadores não se faz com `<View>`: cada ponto viraria um nó de
layout. Em Skia é um caminho só, redesenhado na GPU.

### 7. Banca Francesa — **fica onde está**

| | |
|---|---|
| Objetos animados | 3 dados + fichas |
| Estado hoje | arte medida pixel a pixel, física provada, som tirado da física, cinco tamanhos verdes |

Ela é a Golden Reference **arquitetural** — e você tem razão que isso não a obriga a ficar
neste renderer para sempre. Mas hoje o que ela tem de melhor não é o desenho: é a
disciplina (as áreas de toque saem da arte medida, a trava recusa retângulo chutado). Um
ganho visual aqui viria do voo das fichas no pagamento, que é Skia.

### 8. Truco — **fica onde está**

Cartas e uma mesa. Contagem baixa, primitivas simples. O que falta é timing e som, não
potência.

### 9. Dominó — **fica onde está**

Até 28 peças, e a dificuldade é **geometria da corrente** (para onde a peça vira quando a
mesa acaba), que é conta, não renderização.

### 10. Poker — **Reanimated + Skia no pote**

Cartas são poucas. O que pesa é o **pote**: dezenas ou centenas de fichas voando para o
meio e de volta para o vencedor. Aí sim há contagem, e é Skia.

---

## 2. O resumo que essa análise produz

- **PixiJS ganha um jogo: o caça-níqueis.** E ganha bem — é o único que estoura a stack
  atual por quantidade, não por gosto.
- **Skia ganha quatro:** Roleta, Stock Market, Poker e as cartas de Blackjack/Bacará. Não
  por contagem, mas porque o React Native **não tem** caminho, máscara e degradê radial, e
  isso limita a qualidade num teto que nenhum esforço de animação alcança.
- **Cinco jogos ficam onde estão** — e não por comodidade: porque neles a diferença entre
  bom e profissional é *easing*, antecipação, atraso intencional, som sincronizado e
  feedback, e nada disso melhora trocando de renderer.
- **Unity não ganha nenhum hoje**, e a razão é o canal, não a capacidade. Se o produto
  decidir publicar no Google Play, o caça-níqueis passa a ser um caso legítimo de Unity.

Isto é uma resposta jogo a jogo, e não "React Native consegue, então deixa": em cinco dos
dez a recomendação é **mudar** de tecnologia de desenho.

---

## 3. A camada que faz a troca ser possível: o `AdaptadorDeJogo`

Nada acima vale se trocar o renderer significar reescrever regra, carteira e protocolo.
Então o contrato vem **antes** da implementação:

```
SERVIDOR (autoridade)
  ↓ protocolo — tipos e eventos, sem React e sem renderer
ADAPTADOR DE JOGO — assina, reconecta, ordena por seq, expõe estado + eventos
  ↓
RENDERER — React Native | Skia | PixiJS | Unity
```

O adaptador entrega sempre a mesma coisa, seja qual for o renderer:

| Evento | O que carrega |
|---|---|
| `RODADA_ABERTA` | rodadaId, jogo, versão da regra, limites |
| `APOSTA_ACEITA` / `APOSTA_RECUSADA` | a aposta e, na recusa, o motivo |
| `APOSTAS_FECHADAS` | — |
| `RESULTADO_PRONTO` | o que saiu, **já decidido** |
| `PAGAMENTO` | por casa, com o valor |
| `RODADA_COMPLETA` | estado final |

Três regras do adaptador, e elas são o que impede a arquitetura de se desfazer:

1. **O renderer nunca fala com o servidor.** Ele recebe evento e devolve intenção
   ("apostar 100 no Grande"). Quem traduz é o adaptador.
2. **O evento chega já decidido.** `RESULTADO_PRONTO` traz o resultado; a animação encena.
   Um renderer que sorteia qualquer coisa está quebrado, e isso vale igual em Unity.
3. **A ordem é a do servidor** (`seq`), não a de chegada — é a mesma garantia que as
   tabelas de rodada acabaram de ganhar no P0.2.

Com isso, trocar o caça-níqueis de React Native para PixiJS mexe numa pasta, e em nenhuma
regra.

---

## 4. A prova de conceito, na ordem que custa menos para descobrir

Você pediu três braços: Skia, PixiJS e Unity, numa cena comparável de slot. Concordo com a
comparação, e proponho uma **ordem** — o teste que pode desqualificar vem primeiro, porque
construir um slot em Unity para depois descobrir que ele não passa no nosso canal é a forma
cara de aprender isso.

**Passo 0 — o teste barato de Unity (1 a 2 dias).** Não um jogo: um *build* mínimo de
Unity WebGL, medido no que decide:

- peso baixado, comprimido;
- tempo até a primeira imagem, em rede de celular;
- pico de memória no Safari do iPhone e no Chrome do Android;
- se sobrevive a dez minutos aberto sem o navegador matar a aba.

Se passar, Unity entra na comparação como terceiro braço. Se não passar, está respondido —
com número, não com opinião — e a decisão vira "Unity só se formos para a loja".

**Passo 1 — a cena comparável, em Skia e em PixiJS.** A mesma cena nos dois: 5 rolos, 12
símbolos, giro com antecipação no quinto rolo, parada, três linhas de prêmio acendendo em
sequência, 300 partículas, multiplicador subindo, big win, e som sincronizado.

**Passo 2 — medir.** Não "parece fluido": frame time p50 e p95 no iPhone e num Android
modesto, pico de memória, peso baixado, tempo até jogável, e o tamanho do diff necessário
para integrar. Os onze critérios que você listou, com peso — e qualidade visual pesando
mais que FPS, desde que o orçamento de quadro seja respeitado.

**Passo 3 — decidir, e escrever a decisão** em `RENDERING_STRATEGY.md`, com os números que
a sustentaram. Uma decisão sem os números vira modismo em seis meses.

---

## 5. O que muda no plano, e o que não muda

**Muda:** Unity + C# e PixiJS passam a ser opções ativas de implementação, e a decisão de
renderer do caça-níqueis acontece **antes** de construirmos o Reel Engine definitivo. Não
vamos consolidar um motor de rolos em componentes de interface se um renderer melhor for
comprovadamente melhor.

**Não muda:** a ordem P0. Rodadas e eventos persistidos (em andamento) e a máquina de fases
nos nove jogos vêm primeiro — porque são a camada que o renderer *usa*, e trocar o desenho
antes de ter isso pronto seria pintar a casa com a fundação em aberto.

**Também não muda:** o servidor continua autoridade, o resultado continua vindo dele, e a
animação continua sem decidir nada. Isso vale igual em Unity.
