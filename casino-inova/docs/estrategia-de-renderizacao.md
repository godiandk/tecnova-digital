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

## 1b. A tabela de decisão

Nenhum jogo fica onde está "porque funciona": fica se o teto visual e técnico da stack
atual for **suficiente para ele**, e isso está dito caso a caso. E nenhum jogo migra
"porque a ferramenta é de jogo": migra se houver ganho real. O alvo é a melhor experiência
possível com a menor complexidade necessária.

| Jogo | Hoje | Recomendado | Motivo | Ganho esperado | Custo | Risco | POC? | Decisão |
|---|---|---|---|---|---|---|---|---|
| Caça-Níqueis | RN | **PixiJS ou Skia** | 25–40 sprites contínuos + 300 partículas; é o único que estoura a stack por quantidade | alto — é a diferença entre um slot e uma lista que desce | alto: motor de rolos novo + ponte com o casco | médio: segundo renderer no projeto | **feita, sem GPU** | **em aberto** — falta aparelho (`RENDERING_STRATEGY.md` §6) |
| Roleta | RN | **Skia** | precisa de caminho curvo, máscara, degradê radial e desfoque — o RN não tem | alto — a roda e a bola são o jogo | médio: uma tela redesenhada | baixo: mesmo TypeScript, mesmo projeto | feita, junto | **decide junto com o caça-níqueis** — os 2,9 MB do CanvasKit são pagos uma vez só |
| Bac Bo | RN + física nossa | **RN, com Skia no vidro** | 4 objetos; a física é nossa e provada (240 dados param na face sorteada) | médio — refração e reflexo do agitador | baixo | baixo | **sim, Unity avaliado explicitamente** | congela depois da POC |
| Blackjack | RN | **RN + Skia na carta** | 10 cartas; a qualidade é timing, não potência; falta sombra e recorte de verdade | médio | baixo | baixo | não | decidido |
| Bacará | RN | **RN + Skia na carta** | igual ao Blackjack, mais o *squeeze* (máscara e deformação) | médio | baixo | baixo | não | decidido |
| Poker | RN | **RN + Skia no pote** | cartas são poucas; o pote são dezenas ou centenas de fichas voando | médio | baixo | baixo | não | decidido |
| Stock Market | RN | **Skia** | caminho com centenas de pontos redesenhado por quadro; em `<View>` cada ponto é um nó de layout | alto | médio | baixo | não | decidido |
| Banca Francesa | RN | **RN**, Skia no pagamento | 3 dados e fichas; o forte dela hoje é a disciplina (arte medida, trava contra retângulo chutado) | baixo hoje | — | — | não agora | reavaliar depois da POC |
| Truco | RN | **RN** | cartas e uma mesa; falta timing e som, não potência | baixo | — | — | não | decidido |
| Dominó | RN | **RN** | até 28 peças; a dificuldade é a geometria da corrente, que é conta | baixo | — | — | não | decidido |

**Sobre Unity, jogo a jogo, sem enrolar:**

- **Caça-níqueis** — é o único candidato de verdade. Entra na POC como terceiro braço se
  passar no portão do §4.
- **Bac Bo** — avaliado explicitamente, como pedido. O que a Unity traria são partículas,
  *shader* de vidro com refração e um sistema de câmera. O que ela **não** traria: física
  melhor, porque a nossa é determinística por exigência de projeto (o servidor decide a
  face antes da animação) e a física da Unity é não determinística por natureza. Trocar
  aqui seria pegar o motor da Unity e desligar justamente a parte dele que é boa. Um
  *shader* de vidro em Skia custa uma tela; em Unity custa o canal.
- **Blackjack, Bacará, Poker** — Unity traria **peso, não ganho**. Dez cartas não fazem uma
  engine valer o download. Registrado como avaliado e recusado.
- **Roleta** — Unity daria uma roda 3D com iluminação de verdade. É o segundo caso mais
  defensável depois do slot, e entra na POC **se** o portão do §4 passar.
- **Truco, Dominó, Stock Market, Banca Francesa** — sem caso.

---

## 1c. O renderer pode variar por canal

O teto gráfico do produto **não** fica preso ao Safari para sempre. A tabela acima é a
decisão para o canal de hoje; a arquitetura tem que deixar a porta aberta:

| Canal | Casco | Jogos leves | Jogos pesados |
|---|---|---|---|
| **Web** (hoje) | React Native Web | RN + Reanimated / Skia | PixiJS |
| **Android nativo** (Google Play, 25 dólares uma vez) | React Native | RN / Skia | **Unity as a Library** é candidato real |
| **iOS nativo** (se o programa da Apple for pago) | React Native | RN / Skia | mesma avaliação do Android |

É o `AdaptadorDeJogo` do §3 que torna isso possível sem duplicar regra: o mesmo protocolo,
o mesmo servidor, o mesmo resultado — e um renderer diferente por plataforma quando isso
for tecnicamente justificável.

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

## 4. POC DE RENDERIZAÇÃO — CASINO INOVA

> **Estado: executada em parte. A saída está em `RENDERING_STRATEGY.md`.**
>
> Os braços PixiJS e Skia rodaram a mesma cena e estão medidos. O **Portão 0 (Unity WebGL)
> não foi executado** — a Unity não está instalada no ambiente e o portão pede medidas que
> só existem em aparelho físico.
>
> E o ambiente da medição **não tem GPU**: o que foi colhido é custo de CPU por quadro, não
> desempenho de celular. Por isso **o renderer do caça-níqueis continua não congelado** —
> falta rodar os mesmos dois braços num aparelho de verdade, e o roteiro para isso está no
> §6 do `RENDERING_STRATEGY.md`, pronto para ser executado sem ferramenta nenhuma no
> telefone.
>
> O que a POC já mudou: a qualidade visual **empatou** entre os dois (deixou de ser
> argumento a favor do Skia), o peso do Skia virou número medido (**+2,9 MB**), e o Skia
> passou a ser candidato real também para o caça-níqueis. O que ela desmentiu do nosso
> próprio material está listado lá.

Etapa formal, com nome e protocolo. Acontece **depois do P0.3** e **antes** de
consolidarmos o Animation Director e o Reel Engine — porque congelar um motor de rolos em
componentes de interface para depois trocar de renderer é o desperdício que esta etapa
existe para evitar.

### Portão 0 — Unity WebGL é viável no nosso canal? (1 a 2 dias)

Não um jogo: um **build mínimo** de Unity WebGL, publicado no mesmo servidor, medido no
que decide. O teste que pode desqualificar vem primeiro porque é o mais barato.

| O que medir | Onde |
|---|---|
| Tamanho do build, comprimido | servidor |
| Tempo até aparecer algo na tela | Safari iPhone, Chrome Android |
| Tempo até ficar jogável | idem |
| Pico de memória | idem |
| Estabilidade depois de 10 minutos aberto | idem |
| FPS, frame time, quadros perdidos | idem |
| Ao alternar de aba e voltar | idem |
| Ao bloquear e desbloquear o iPhone | iPhone |
| Em 5G e em Wi-Fi | iPhone |
| Impacto no carregamento do RESTO do aplicativo | comparar com e sem |

**Se falhar:** fica registrado aqui, com os números, como **tecnicamente inadequado para o
canal web atual** — e não como opinião. Unity continua na mesa para Android/iOS nativo
(§1c).
**Se passar:** entra como terceiro braço real da POC.

### Braços — a mesma cena, três vezes

Cena representativa do caça-níqueis, idêntica nos três: 5 rolos, 25–40 símbolos em
movimento, antecipação no quinto rolo, parada, linhas de prêmio acendendo em sequência,
300+ partículas no big win, glow, contador subindo, multiplicador, áudio sincronizado, e
entrada e saída da cena.

**A cena não sorteia nada.** Ela recebe o resultado pronto, como o `AdaptadorDeJogo`
entrega — senão a POC compara três renderers fazendo coisas diferentes.

1. **PixiJS** — candidato principal.
2. **Skia** — a stack atual levada ao limite dela; é a linha de base que diz se a migração
   se justifica.
3. **Unity + C#** — se o Portão 0 passar.

### Critérios, com peso

Não é só FPS. Qualidade visual pesa mais que quadro por segundo, **desde que o orçamento
de 16,67 ms seja respeitado** — um jogo lindo que trava não é um jogo lindo.

qualidade visual · fluidez · estabilidade · tempo de desenvolvimento · manutenção ·
integração · multiplataforma · tamanho · carregamento · capacidade futura · custo técnico.

Uma tecnologia pode consumir mais e ainda ser a escolha certa se elevar muito a qualidade e
permitir crescer.

### Saída

`RENDERING_STRATEGY.md` com a decisão de cada jogo e **os números que a sustentaram**.
Decisão sem número vira modismo em seis meses.

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
