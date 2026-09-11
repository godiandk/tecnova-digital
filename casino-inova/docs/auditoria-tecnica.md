# Auditoria técnica do Casino Inova

Levantamento do que existe hoje no repositório, medido no código e não de memória, contra
a especificação de plataforma (Game Core, State Machine, Animation Director, renderização,
assets, performance, replay, reconexão, testes, segurança).

**Regra desta auditoria:** nada aqui é opinião sobre estética. Cada classificação aponta o
arquivo que a sustenta, e cada recomendação diz o problema que resolve. Onde eu não tenho
medida, está escrito que não tenho.

---

## 1. O quadro, sistema por sistema

| # | Sistema | Situação | Onde está |
|---|---|---|---|
| 3 | Regra separada da apresentação | **Existe e está bom** | os 10 `*.engine.ts` são TypeScript puro, sem React; `verify-*.ts` roda cada um no terminal |
| 4 | Game Core comum | **Existe parcialmente** | `games/core/` (fases, eventos, reconexão, relógio) + `games/shared/` (RNG, sapata, naipes, níveis) |
| 5 | State Machine da rodada | **Existe e todos usam** | `core/fases.ts` + `core/maquina-de-rodada.ts`; `verifica-fases-dos-jogos.ts` reprova se um jogo mover dinheiro sem registrar rodada |
| 6 | Animation Director | **Não existe** | animação vive dentro de cada tela, com `setTimeout` encadeado |
| 7 | Renderização por tela | **Existe parcialmente** | tudo é React Native + Reanimated; sem Skia, sem Pixi |
| 8 | Asset pipeline | **Não existe** | sem atlas, sem preload por jogo, sem descarregamento; as artes são WebP soltas |
| 9 | Performance budget | **Não existe** | nada mede FPS, frame time, memória ou draw calls |
| 10 | Replay determinístico | **Existe e está bom** | `rodadas` + `eventos_da_rodada`, com `seq` por rodada e versão da regra gravada; `verifica-replay.ts` reconstrói uma rodada só do banco |
| 11 | Reconexão | **Existe e está bom (nas salas)** | `core/reconexao.service.ts` + `verificacao/verifica-reconexao.mjs` |
| 12 | Testes sem interface | **Existe e está bom** | 44 conferências; várias exaustivas (216 combinações, 37 casas × 13 apostas, fast-check) |
| 13 | Testes visuais | **Existe parcialmente** | `verifica-arcos-da-banca.mjs` compara a arte medida; `verifica-tamanhos.mjs` cobre 5 telas; **não há linha de base de imagem com diff** |
| 14 | Responsividade real | **Existe parcialmente** | provada só na Banca Francesa; o resto não tem conferência |
| 15 | Design System | **Existe parcialmente** | `theme/` com tokens, componentes compartilhados; sem documento nem inventário |
| 16 | Sistema de áudio | **Existe parcialmente** | `som/mesaSonora.ts` com mudo, movimento reduzido e força por batida; só na Banca Francesa; sem música, ambiente, prioridade ou fade |
| 17 | Sistema de eventos | **Existe parcialmente** | `core/registro-de-eventos.ts` com `seq`; em memória, teto de 500 por mesa, só nas salas |
| 18 | Observabilidade | **Não existe** | sem log estruturado, sem código de erro, sem correlação por rodada |
| 19 | Segurança do **jogo** | **Existe e está bom** | servidor decide tudo; RNG do servidor (`shared/rng.ts`); nenhuma rota aceita valor calculado pelo cliente |
| 19b | Segurança da **aplicação** | **Não auditada** | autenticação, sessão, autorização, limite de taxa, validação de entrada, SQL, segredos, CORS, WebSocket, abuso e log de dado sensível — nada disso foi olhado ainda |
| 20 | Idempotência | **Existe e está bom** | `acoes-repetidas.service.ts` + chave única no extrato; conferido sob concorrência |
| 21 | Versionamento de protocolo | **Não existe** | `api/versao.ts` recarrega o app quando o servidor muda; não há versão de API nem de evento |
| 22 | Slot engine | **Matemática boa, apresentação não** | RTP corrigido pra 95,9922%; falta o reel engine, e o renderer dele será decidido antes (ver docs/estrategia-de-renderizacao.md) |
| 23 | Card engine | **Existe parcialmente** | `shared/sapata.ts` e `naipes.ts` no servidor; `Carta.tsx` na tela; sem sistema de dar/virar/mover |
| 24 | Dice engine | **Existe e está bom** | `fisica/motorDeDados.ts`; o servidor decide a face e a física só encena; `verifica-face-do-dado` prova em 240 dados |
| 25 | Chip system | **Existe e está bom** | `Ficha.tsx`, `TrilhoDeFichas.tsx`, `fichasDeValor.ts`; usado por 3 jogos |
| 26 | Quality gates | **Existe parcialmente** | as conferências são a metade automática; falta a lista aplicada por tarefa |
| 27 | Definition of Done | **Não existe** | escrito nesta auditoria pela primeira vez |
| — | Redis | **Não é necessário agora** | um servidor, salas em memória; Redis resolve problema que ainda não temos |
| — | Unity / PixiJS / Spine / WebGPU | **Não é necessário agora** | ver §4 |

---

## 2. As respostas às 20 perguntas

**1. O que já existe?** A base de dinheiro e de regra, que é a parte cara: extrato
encadeado com saldo antes e depois, idempotência por chave, travamento de linha, RNG do
servidor, dez motores de regra sem React, 44 conferências (várias exaustivas), reconexão
nas salas, máquina de fases, registro de eventos com número de ordem, e um pipeline de
medição de arte que já pegou defeitos que ninguém veria lendo código.

**2. O que existe parcialmente?** A máquina de fases (um jogo de dez a usa). O registro de
eventos (em memória, só nas salas). O áudio (um jogo). A responsividade provada (um jogo).
O design system (tokens sim, inventário não). O replay (o extrato sabe a rodada, mas não há
tabela de rodadas nem de eventos).

**3. O que está mal implementado?** Uma coisa só, e é séria: **o RTP dos caça-níqueis está
em 89,17%** — medido agora, fórmula exata e cinco milhões de giros concordando. Todos os nossos
outros jogos entregam entre 97% e 99%. Isso é uma diferença de margem que o jogador não
tem como saber, e o nosso compromisso é RTP real e declarado.

**4. O que falta de verdade?** Animation Director; replay persistido; medição de
performance; asset pipeline; observabilidade; versionamento de protocolo.

**5. O que eu NÃO recomendo implementar agora?**
- **Redis.** Um servidor, salas em memória. Redis resolve estado compartilhado entre
  instâncias — problema que não temos. Entra quando houver a segunda instância.
- **PixiJS.** Poria um segundo motor de desenho no mesmo aplicativo: o pior dos dois
  mundos. Se um dia a web virar alvo único, é a escolha certa — mas aí é outro aplicativo.
- **Unity.** Ver pergunta 18.
- **Spine.** Não temos personagem animado; os crupiês são fotos.
- **WebGPU.** Sem carga de GPU e sem suporte amplo. WebGL via Skia cobre o que precisamos.
- **Mover as regras para um pacote `/game-core` que o app importe.** As regras já estão
  fora do React. Deixá-las alcançáveis pelo cliente é uma porta que não precisa existir.

**6. O que precisa ser preservado?** A carteira e o extrato; o `acoes-repetidas`; o RNG e a
sapata; os dez motores de regra; as 44 conferências; o motor de dados; o mapa medido da
Banca Francesa (`arcosDaBanca.ts`) e a trava que impede voltar a chutar retângulo; o
`core/` inteiro. Nada disso deve ser reescrito — deve ser **usado por mais gente**.

**7. Maiores dívidas técnicas.**
1. Nove jogos sem estado de rodada: cada um resolve "não dá pra apostar depois do
   fechamento" à sua maneira, ou não resolve.
2. Nenhuma rodada é reconstruível. Se você disser "sumiu uma ficha ontem", eu tenho o
   extrato, não tenho o que aconteceu.
3. A apresentação guarda estado em booleanos soltos e encadeia `setTimeout`. Funciona, e é
   de onde vem a família de bugs "a animação travou".
4. Sem linha de base visual. Já aconteceu três vezes de o jogo funcionar e não parecer com
   a referência.

**8. Maiores riscos de bug hoje.** Dinheiro em jogo que não passa pela máquina de fases
(liquidação dupla numa reconexão); animação encadeada por tempo que não é cancelada ao
desmontar; e a matemática dos caça-níqueis.

**9. Arquitetura final.** A que já está desenhada, aplicada a todos:
`ENGINE (regra pura) → SERVICE (autoridade, dinheiro, fases) → EVENTOS → PROTOCOLO →
CLIENTE (estado espelhado) → ANIMATION DIRECTOR → DESENHO / ÁUDIO`.
O que muda não é o desenho: é fazer os dez jogos entrarem nele.

**10. Ordem de implementação.** Ver §3.

**11. Golden Reference.** Banca Francesa. Já é: é o único jogo com máquina de fases,
áudio, arte medida, responsividade provada e ponta a ponta.

**12. O que resolver primeiro na Banca Francesa.** Ela está perto. Falta: (a) o Animation
Director extraído do que hoje é `encenar` com `setTimeout`; (b) a rodada e os eventos
persistidos, para replay; (c) a linha de base visual; (d) a medição de frame time.

**13. O que dela será reutilizado.** `arcosDaBanca` + a trava de medição (padrão para todo
tampo); o `mesaSonora` virando Audio Manager; o `CasaDeAposta` com tiras (serve para a
roleta, que também tem áreas não retangulares); o `TrilhoDeFichas`; o `motorDeDados`; o
`rodada-solo` virando o molde da máquina de fases solo dos outros nove.

**14–17. Qual tecnologia gráfica onde.**
- **React Native basta** em: lobby, perfil, carteira, histórico, loja, torneios, modais,
  formulários, e nas mesas onde o que se move são fichas e placas — Banca Francesa, Bac Bo,
  Bacará, Blackjack, Truco, Dominó, Pôquer. São dezenas de elementos, não centenas.
- **Skia passa a ser melhor** quando houver: a roda da roleta com a bola (hoje são camadas
  com `transform`; em Skia é um desenho só, com a pista de verdade), pagamento com muitas
  fichas voando, partícula, brilho, rastro, máscara e degradê radial (hoje a luz de vitória
  são três elipses porque não temos degradê).
- **PixiJS na web**: só se um dia a web virar alvo único. Enquanto o mesmo código servir os
  dois, não.
- **Heurística, não lei:** por volta de 80 elementos animados, ou qualquer máscara, curva
  ou degradê de verdade, é hora de *medir*. **Quem decide é o benchmark, não o número.**
  Se 120 elementos em Reanimated estão segurando o orçamento de frame, não se migra por
  causa de um número; se 40 estão estourando por causa de desfoque, máscara ou composição,
  Skia entra antes. Skia entra **por tela**, com o resto continuando React Native por fora.
  Performance medida ganha de regra numérica — sempre.

**18. Existe justificativa para Unity hoje?** **Não.** Nenhum jogo nosso é 3D, nenhum tem
personagem esqueletal, nenhum passa de algumas dezenas de objetos animados. Unity custaria
toda a interface e o caminho web — que é o nosso alvo principal. **Não migrar.**

**18b. Segurança está encerrada?** **Não.** O que está bom é a segurança *do jogo*:
autoridade do servidor, RNG, saldo, idempotência, cálculo fora do cliente. A segurança *da
aplicação* — autenticação, autorização, sessão, limite de taxa, validação de entrada, SQL,
segredos, variáveis de ambiente, CORS, WebSocket, abuso e log de dado sensível — **nunca
foi auditada**. Isso é uma auditoria própria, com o seu próprio relatório, e ela não
interrompe o P0.

**19. Benchmarks para provar melhora.** Frame time p50/p95 em cada mesa nos cinco tamanhos;
tempo até a mesa jogável; bytes por jogo; número de nós animados; ausência de quadro acima
de 33 ms durante um lançamento; e as conferências que já existem, que não podem regredir.

**20. Como impedir regressão.** É o que a casa já faz e deve continuar fazendo: toda
correção difícil vira conferência, e a conferência entra no `verify:tudo`. Esta auditoria
acrescenta três travas que faltam: linha de base visual com diff, orçamento de frame time
que reprova, e teste de estado que recusa transição inválida.

---

## 3. Roadmap

### P0 — justiça e fundação

| | Tarefa | Problema | Como se prova |
|---|---|---|---|
| ~~P0.1~~ **FEITO** | **RTP dos caça-níqueis: 95,9922%** | 89,17% medido, contra 97–99% dos outros jogos. É margem que o jogador não vê | `verify-rtp` com fórmula exata e cinco milhões de giros concordando; o número declarado na tela |
| ~~P0.2~~ **FEITO** | **Tabelas `rodadas` e `eventos_da_rodada` no Postgres** | Nenhuma rodada é reconstruível hoje | conferência que joga uma rodada, apaga o estado em memória e a reconstrói do banco |
| ~~P0.3~~ **FEITO** | **Os outros nove jogos na máquina de fases** | "aposta depois do fechamento" e "liquidação dupla" só são impossíveis num jogo | conferência por jogo tentando cada transição inválida |

### P1 — jogo profissional

| | Tarefa | Problema | Como se prova |
|---|---|---|---|
| P1.1 **SEGURA** | **Animation Director** (eventos → apresentação, com sequência, paralelo, cancelar, pular) | animação encadeada por `setTimeout` dentro da tela; trava e não cancela | teste que dispara a sequência, desmonta no meio e prova que nada ficou marcado |
| ~~P1.2~~ **FEITO** | **Linha de base visual com diff** | "funciona mas não parece com a referência" já aconteceu três vezes | `verifica-visual.mjs`: duas execuções iguais dão 0% a 0,001%; um deslocamento de 4 px acusa 22% |
| ~~P1.3~~ **FEITO** | **Medição de frame time** | hoje a resposta é "parece fluido" | `app/src/desempenho/`, mesma conta da POC; `?quadros=1` liga na web. Conferido contra sequências de quadro inventadas à mão |
| ~~P1.4~~ **FEITO** | **Audio Manager** (música, ambiente, prioridade, fade, ducking) | o áudio atual serve a um jogo e não tem hierarquia | `verifica-mistura`: 15 conferências. **Música e ambiente ainda não têm conteúdo** — as camadas existem e estão vazias |
| ~~P1.5~~ **FEITO** | **Log estruturado** com `gameId`, `roundId`, `sessionId`, fase anterior e nova | quando quebrar em produção, não saberemos por quê | `verifica-registro` (18) e `verifica-registro-http` (8, num servidor de verdade) |

**P1.1 está SEGURA de propósito, e não esquecida.** Congelar um diretor de animação em
componentes de interface antes de saber qual renderizador vai desenhá-los é exatamente o
desperdício que a POC existe pra evitar. Ela sai da espera quando o §6 do
`RENDERING_STRATEGY.md` for executado num aparelho de verdade.

**O que o P1 achou de quebrado no caminho, e que ninguém sabia:**

- o servidor tinha **cinco** chamadas de `console` no código inteiro, e três só dizem a
  porta. Reclamação de jogador não tinha o que ler;
- a primeira versão do registro perdia **todo 401 do guard** — no Nest o guard roda antes
  do interceptor. Justamente as linhas que mais importam;
- `verifica-escada-do-truco` precisava de servidor no ar mas estava dentro do `verify:tudo`
  do aplicativo, que roda sem nada no ar: ela estourava e **as quatro conferências
  seguintes na corrente nunca rodavam**;
- as tabelas do P0.2 não tinham porta nenhuma: pra ler uma rodada era preciso abrir o
  banco na mão. Agora há `/admin/rodadas/:id` e `/admin/rodadas-abertas`, e o caminho
  inteiro está em `como-investigar-uma-reclamacao.md`.

### P2 — qualidade

| | Tarefa | Estado |
|---|---|---|
| P2.1 | asset pipeline (atlas, preload por jogo, descarregamento) | a fazer — o gerador de atlas já existe (`tools/gera-atlas-do-slot.py`, feito na POC) |
| P2.2 | design system consolidado com inventário e documento | a fazer |
| P2.3 **SEGURA** | Skia na roda da roleta e no pagamento com fichas | **espera o §6 do `RENDERING_STRATEGY.md`** — é a decisão de renderer |
| ~~P2.4~~ **FEITO** | responsividade provada nos dez jogos, não em um | 50 combinações (10 jogos × 5 tamanhos) passam. **Nove dos dez estavam quebrados**: `hitSlop` não existe no `react-native-web`, então todo botão redondo era 40 px no navegador — que é o nosso canal |

---

## 3b. Pedidos do produto — a fila, na ordem pedida

Registrado a pedido, para não se perder. A ordem é a que o produto definiu.

### F1 — urgente: seletor de aposta

Uma mesa pode exigir 500 milhões de fichas e a interface começa num valor mínimo,
obrigando a pessoa a tocar no `+` dezenas de vezes. **Isso não pode existir.**

- `BetSelector` reutilizável, com valores escaláveis e escolha rápida;
- a aposta desejada em **2 a 3 interações**, não em dezenas;
- mesa com mínimo de 500 milhões **abre em 500 milhões**, não em 50.

*O que já existe e não deve ser recriado:* `niveis-de-mesa.ts` no servidor já entrega
`fichas: [1, 2, 5, 10, 20] × mínimo` por degrau — a régua de valores por mesa já está
calculada e versionada. O `TrilhoDeFichas` do aplicativo já é o componente do trilho.

**Uma decisão em aberto, criada pela própria correção: o "Tudo" em UM toque.**

Não existe aposta máxima neste jogo (decisão registrada em `niveis-de-mesa.ts`: a casa não
tem caixa que possa quebrar, então o teto não protegeria ninguém). Com o `+` de 50 em 50,
apostar o saldo inteiro exigia milhares de toques — havia uma proteção acidental contra o
gesto irreversível. Agora "Tudo" é um botão, ao lado das fichas.

Isso não é engano nem manipulação: o valor está escrito no próprio botão. Mas é um toque
que pode zerar a conta, e ele mora a um dedo de distância dos botões normais.

Duas saídas, e a escolha é do produto: deixar como está (rápido, e coerente com "é escolha
de quem joga"), ou fazer o "Tudo" pedir um segundo toque pra confirmar — o que preserva os
dois ou três toques das apostas normais e põe uma batida antes da irreversível. **Não foi
implementado sem decisão**, porque adicionar atrito é exatamente o oposto do que a F1 pediu.

### F2 — urgente: barra de nível (XP)

O asset existe. Falta a barra funcionar:

- barra mais alta; preenchimento correto de 0 a 100% ocupando todo o espaço útil;
- sem buracos e sem preenchimento torto; nível centralizado; XP legível;
- animação ao ganhar XP e **animação especial ao subir de nível**;
- **o mesmo componente no Perfil e no Lobby**;
- no Lobby, mais espaço vertical: nome + saldo + nível + barra + XP não podem ficar
  espremidos.

*O que já existe:* `verifica-barra-de-nivel.mjs` já confere a barra contra a arte dela.

**A curva de XP foi trocada** (ver `docs/economia.md`, seção K). A antiga —
`1 + √(aposta/10)`, nível N custando `500 + (N−1)×250` — fazia o nível 10.000 exigir 250
milhões de rodadas e premiava apostar o mínimo em 29× por ficha. A nova é
`50 × ln(1+r) / ln(21)` com `r = aposta / mínimo do degrau da pessoa`, nível N custando
`197 × √N`, teto de 60.000 XP por dia e nível máximo de 10.000 no código. O nível 10.000
passa a sair em seis anos de jogo pesado, e apostar em unidades da MESA é o que impede
comprar fichas de virar comprar nível.

### F3 — economia: a discrepância medida

O produto apontou incoerência entre saldos, mesas e loja. **Ela é real e está medida:**

| | |
|---|---|
| Banca de boas-vindas | 10.000 fichas |
| Mesa Bronze | mínimo 50 · Prata 500 · Ouro 5.000 · Diamante 50.000 · ×10 por degrau, 12 degraus |
| Maior pacote da loja | **120.000 fichas por R$ 149,90** |
| Recompensa diária de hoje, 30 dias | **1.874 × o mínimo da mesa do saldo** |

Ou seja: um jogador no degrau Diamante recebe **93,7 milhões de fichas por mês de graça**,
contra 120 mil do maior pacote pago. **A recompensa diária vale 780 pacotes da loja por
mês.** Acima de Prata, a loja não tem função econômica.

Isso precisa ser resolvido *antes* de congelar os valores da recompensa diária — e é
exatamente o que o pedido 19 do produto ataca ao tirar o saldo da fórmula.

### F4 — loja e pagamentos

Arquitetura com Pix, Apple Pay, Google Pay e cartão; EUR, USD e BRL; `PaymentProvider`,
webhook, idempotência e validação no servidor.

**Sem NFT nem cripto agora** — pagamentos tradicionais primeiro; blockchain vira estudo
separado, depois.

#### F4b — quanta ficha cada pacote dá (pedido do produto: variar por nível)

O produto pediu: preços fixos, e a QUANTIDADE de fichas de cada pacote variando conforme o
nível do jogador, com faixas de 50 em 50 até o nível 500, de 100 em 100 até 1.000, e
seguindo daí em diante; mais pacotes promocionais em alguns dias, com bônus de 40% a 80%.

**Duas medidas que precisam ser lidas antes de desenhar essa tabela.**

**1. O problema não é o nível — é a mesa.** Quantas apostas mínimas cada pacote compra hoje:

| | R$ 9,90 | R$ 24,90 | R$ 59,90 | R$ 149,90 |
|---|---|---|---|---|
| Bronze (mín. 50) | 100 | 300 | 800 | 2.400 |
| Prata (500) | 10 | 30 | 80 | 240 |
| Ouro (5.000) | 1 | 3 | 8 | 24 |
| Diamante (50.000) | 0 | 0 | 0 | **2** |
| Rubi (500.000) | 0 | 0 | 0 | **0** |

O maior pacote pago compra **duas apostas** na mesa Diamante e **nenhuma** na Rubi. Como o
mínimo da mesa vem do SALDO, multiplicar o pacote por um fator de nível não resolve: um
multiplicador de 2,5× no Diamante leva de 2 para 5 apostas.

**2. Os níveis pedidos não são alcançáveis com a curva de XP de hoje.** *(RESOLVIDO —
a curva foi trocada; os números abaixo são os da curva ANTIGA, guardados como registro do
que estava errado. Ver `docs/economia.md`, seção K.)* A curva era
`1 + √(aposta/10)` com teto de 50 XP por rodada, e o nível N custava `500 + (N−1)×250`.
Mesmo jogando sempre no teto:

| Nível | Rodadas | Jogando sem parar |
|---|---|---|
| 50 | 6.370 | 9 h |
| 100 | 25.245 | 1,5 dia |
| 200 | 100.495 | 6 dias |
| 500 | 626.245 | **36 dias** |
| 1.000 | 2,5 milhões | **145 dias** |
| 10.000 | 250 milhões | **40 anos** |

Faixas de 100 em 100 até 1.000 desenham uma tabela para jogadores que não existem.

#### A recomendação

**O pacote deve vender RODADAS, não fichas:**

```
fichas do pacote = k(preço) × mínimo da mesa do jogador × multiplicadorDeNível(nível)
```

- **`k(preço)` é fixo** — por exemplo R$ 9,90 = 100 rodadas, R$ 149,90 = 2.400 rodadas. É o
  que mantém o poder de compra igual em toda mesa, e é o que faz a loja voltar a existir
  acima do Ouro.
- **O mínimo da mesa entra aqui, e não entra na recompensa diária** — e a diferença é o
  ponto: a recompensa é de graça, então escalá-la pelo saldo é presentear quem já é rico
  (o pedido 19 recusa isso, com razão). O pacote é **pago**. Dar proporcionalmente mais
  fichas por real a quem joga em mesa alta não é privilégio: é o mesmo produto pelo mesmo
  dinheiro.
- **O multiplicador de nível é a regalia por tempo de casa**, como o produto pediu — mas
  modesto, 1,0× a 2,5×, na mesma forma da tabela de recompensa diária. Ele não precisa
  carregar o peso econômico, porque quem já carrega é o mínimo da mesa.

**As faixas de nível**, dadas as rodadas acima: de 50 em 50 até 300, e uma última faixa
aberta ("300 ou mais"). Faixas acima disso só fazem sentido se a curva de XP mudar — e
mudar a curva é decisão de produto à parte, não efeito colateral da loja.

**Pacotes promocionais** entram como bônus percentual sobre o `k(preço)`, com data de
início e fim no servidor, versionados junto com o resto da configuração. O bônus é sobre a
quantidade, nunca sobre o preço — assim a promoção não cria um preço que precise existir
em três moedas.

**Nada disso entra no código antes da proposta econômica** (§ recompensa diária §4), porque
`k(preço)` e o multiplicador saem da mesma conta.

### F5 — recompensa diária (calendário)

Sistema completo, especificado em **`docs/recompensa-diaria.md`**: mês real (28/29/30/31),
estados do dia, sequência, fuso, idempotência, multiplicador por nível, marcos, modal no
login, histórico e testes.

**Boa parte do servidor já existe** e não deve ser recriada — o que existe, o que falta e
os quatro conflitos entre o que existe e o que foi pedido estão nesse documento.

### A ordem, como o produto pediu

1. registrar no roadmap *(esta seção)*;
2. **F1 e F2** — os problemas urgentes de aposta e XP, e o diagnóstico econômico da F3;
3. **as tarefas estruturais que destravam o renderer** — o §6 do `RENDERING_STRATEGY.md`
   (medir os dois braços num aparelho de verdade), que é o que libera P1.1 e P2.3;
4. **F5** — a recompensa diária, integrada à arquitetura atual;
5. não recriar sistema que já existe;
6. aproveitar os assets de recompensa que já temos.

> **A proposta econômica está pronta e aguardando aprovação: `docs/economia.md`.**
> O modelo que produziu os números está em `tools/economia-proposta.py`, para poder ser
> refeito e contestado.
>
> O achado principal: **a recompensa diária de hoje é uma catraca de juros compostos** que
> leva qualquer conta ao topo da escada de doze degraus em **171 dias sem jogar nada**, e
> a economia está invertida — quem joga muito fica no Bronze, quem só coleta chega ao
> Eclipse. Três decisões ficaram para o produto, e a mais importante é a curva de XP:
> hoje **apostar o mínimo é estritamente a melhor estratégia** (29× mais XP por ficha e
> 29× menos perda), o que anula qualquer freio baseado em nível.

**Antes de congelar qualquer valor de ficha da recompensa diária**, o produto pediu uma
proposta econômica com recompensa base, crescimento diário, multiplicadores por nível,
marcos 7/14/21/fim de mês, e o total que um jogador de nível baixo, médio e alto receberia
em 30 dias — com o impacto estimado na economia. Ela vai em `docs/recompensa-diaria.md`,
e **os valores só entram no código depois de aprovada.**

### P3 — futuro

P3.1 slot engine de verdade (reel strips, antecipação, turbo, cascata) sobre Skia;
P3.2 versionamento de API e de evento;
P3.3 Redis, quando existir a segunda instância;
P3.4 teste de carga das salas.

---

## 4. Definition of Done, por jogo

Um jogo só está pronto com: regra conferida contra a referência; matemática com RTP
declarado e provado; motor sem React; máquina de fases com transições inválidas recusadas;
servidor como autoridade; aposta, resultado e pagamento com idempotência; animação dirigida
por evento; áudio; histórico; reconexão; responsividade nos cinco tamanhos; frame time
dentro do orçamento; conferências; replay; validação visual contra a base; e erro tratado.

**A Banca Francesa cumpre hoje 14 dos 18.** Faltam: animação dirigida por evento, replay,
validação visual com base, e frame time medido.
