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
| 5 | State Machine da rodada | **Existe mas só um jogo usa** | `core/fases.ts` define 10 fases e as transições; só a Banca Francesa consome |
| 6 | Animation Director | **Não existe** | animação vive dentro de cada tela, com `setTimeout` encadeado |
| 7 | Renderização por tela | **Existe parcialmente** | tudo é React Native + Reanimated; sem Skia, sem Pixi |
| 8 | Asset pipeline | **Não existe** | sem atlas, sem preload por jogo, sem descarregamento; as artes são WebP soltas |
| 9 | Performance budget | **Não existe** | nada mede FPS, frame time, memória ou draw calls |
| 10 | Replay determinístico | **Existe parcialmente** | `ledger_entries.round_id` liga dinheiro à rodada; não há tabela de rodadas nem de eventos |
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
| 22 | Slot engine | **Existe mas está ruim** | `slots.engine.ts` funciona, mas **RTP 89,17%** (medido agora) e sem reel engine |
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
em 89,17%** — medido agora, fórmula exata e 500 mil giros concordando. Todos os nossos
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
| P0.1 | **RTP dos caça-níqueis para 94–96%** | 89,17% medido, contra 97–99% dos outros jogos. É margem que o jogador não vê | `verify-rtp` com fórmula exata e 500 mil giros concordando; o número declarado na tela |
| P0.2 | **Tabelas `rodadas` e `eventos_da_rodada` no Postgres** | Nenhuma rodada é reconstruível hoje | conferência que joga uma rodada, apaga o estado em memória e a reconstrói do banco |
| P0.3 | **Os outros nove jogos na máquina de fases** | "aposta depois do fechamento" e "liquidação dupla" só são impossíveis num jogo | conferência por jogo tentando cada transição inválida |

### P1 — jogo profissional

| | Tarefa | Problema | Como se prova |
|---|---|---|---|
| P1.1 | **Animation Director** (eventos → apresentação, com sequência, paralelo, cancelar, pular) | animação encadeada por `setTimeout` dentro da tela; trava e não cancela | teste que dispara a sequência, desmonta no meio e prova que nada ficou marcado |
| P1.2 | **Linha de base visual com diff** | "funciona mas não parece com a referência" já aconteceu três vezes | `tira-retratos` guarda a base; a conferência reprova acima da tolerância |
| P1.3 | **Medição de frame time** | hoje a resposta é "parece fluido" | Playwright com trace: p50/p95 por mesa, e teto que reprova |
| P1.4 | **Audio Manager** (música, ambiente, prioridade, fade, ducking) | o áudio atual serve a um jogo e não tem hierarquia | conferência de mistura: efeito nunca abaixo da música; mudo cala tudo |
| P1.5 | **Log estruturado** com `gameId`, `roundId`, `sessionId`, fase anterior e nova | quando quebrar em produção, não saberemos por quê | conferência que provoca erro e acha a linha pelo `roundId` |

### P2 — qualidade

P2.1 asset pipeline (atlas, preload por jogo, descarregamento);
P2.2 design system consolidado com inventário e documento;
P2.3 Skia na roda da roleta e no pagamento com fichas;
P2.4 responsividade provada nos dez jogos, não em um.

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
