# Casino Inova — API (Fase 0, esqueleto)

Backend em NestJS + TypeScript. Nesta etapa, **tudo roda em memória** — reiniciar o
servidor apaga os dados. É o suficiente pra validar o formato dos endpoints e o
comportamento do ledger antes de conectar um banco de verdade.

## Rodando

```
cd server
npm install
npm run start:dev
```

API sobe em `http://localhost:3000`.

## Endpoints disponíveis

| Rota | O que faz |
|---|---|
| `GET /users/me` | Retorna o usuário mock (`u1`) — não existe login ainda. |
| `GET /wallet/:userId/saldo` | Soma todas as entradas do ledger daquele usuário. |
| `GET /wallet/:userId/historico` | Lista todas as entradas do ledger daquele usuário. |
| `GET /store/pacotes` | Lista os 4 pacotes de fichas (bronze/prata/ouro/diamante). |
| `POST /store/comprar` `{ userId, packageId }` | Credita as fichas do pacote na carteira — simula o que a RevenueCat faria depois de validar um recibo real. |
| `GET /games/slots/config` | Símbolos, aposta mín/máx e o **RTP teórico exato** (calculado por fórmula, não chutado — ver `slots.engine.ts`). |
| `POST /games/slots/girar` `{ userId, bet }` | Debita a aposta, sorteia a grade 3x3 no servidor, credita o prêmio se houver e devolve o resultado. |
| `GET /games/roleta/config` | Números vermelhos, aposta mín/máx, multiplicador por tipo de aposta e o RTP (36/37 ≈ 97,30%, fixo por regra matemática da roleta europeia). |
| `POST /games/roleta/girar` `{ userId, bet: { type, number? }, amount }` | Debita a aposta, sorteia a casa (0-36) no servidor, credita o retorno se houver. `bet.type` é um de: `numero` (com `number` de 0 a 36), `vermelho`, `preto`, `par`, `impar`, `baixo`, `alto`, `duzia1`, `duzia2`, `duzia3`. |
| `GET /games/blackjack/config` | Aposta mín/máx, multiplicador de blackjack natural (2,5x = "paga 3 para 2") e a regra do dealer (para em 17). |
| `POST /games/blackjack/apostar` `{ userId, bet }` | Debita a aposta e distribui 2 cartas pra cada lado. Se sair blackjack natural (do jogador ou do dealer), a mão já termina aqui. |
| `POST /games/blackjack/pedir-carta` `{ userId }` | Compra mais uma carta pro jogador. Estoura 21 → mão termina, dealer perde a vez de jogar. |
| `POST /games/blackjack/parar` `{ userId }` | Jogador para, dealer compra até 17, resultado é decidido e o prêmio (se houver) é creditado. |
| `GET /games/bacara/config` | Aposta mín/máx. |
| `POST /games/bacara/apostar` `{ userId, betType, amount }` | Roda a mão inteira numa chamada só (bacará não tem decisão do jogador) e credita se houver prêmio. `betType` é `jogador`, `banca` ou `empate`. Empate com aposta em jogador/banca devolve a ficha (nem ganha nem perde). |

Blackjack é sequencial — `apostar` sempre primeiro, depois qualquer número de `pedir-carta`, terminando em `parar` (ou automaticamente, se estourar ou sair um natural). Só existe uma mão em andamento por usuário por vez.

Teste rápido de ponta a ponta:

```
curl http://localhost:3000/wallet/u1/saldo
curl -X POST http://localhost:3000/store/comprar -H "Content-Type: application/json" -d '{"userId":"u1","packageId":"ouro"}'
curl http://localhost:3000/wallet/u1/saldo
```

O saldo depois da compra deve estar 40.000 fichas maior.

```
curl -X POST http://localhost:3000/games/slots/girar -H "Content-Type: application/json" -d '{"userId":"u1","bet":100}'
curl -X POST http://localhost:3000/games/roleta/girar -H "Content-Type: application/json" -d '{"userId":"u1","bet":{"type":"vermelho"},"amount":100}'
curl -X POST http://localhost:3000/games/blackjack/apostar -H "Content-Type: application/json" -d '{"userId":"u1","bet":100}'
curl -X POST http://localhost:3000/games/blackjack/pedir-carta -H "Content-Type: application/json" -d '{"userId":"u1"}'
curl -X POST http://localhost:3000/games/blackjack/parar -H "Content-Type: application/json" -d '{"userId":"u1"}'
curl -X POST http://localhost:3000/games/bacara/apostar -H "Content-Type: application/json" -d '{"userId":"u1","betType":"banca","amount":100}'
```

Para conferir que o RTP configurado em `slots.config.ts` é realmente o que o motor entrega (fórmula exata batendo com simulação de 500 mil giros):

```
npm run verify:rtp
```

Blackjack não tem RTP fixo — depende da estratégia de quem joga. `npm run verify:blackjack` simula uma estratégia simples (pedir carta até 17) só como referência de que o jogo não está nem generoso nem apertado demais; com estratégia básica ótima de verdade, essas regras (dealer para em todos os 17, blackjack paga 3:2, baralho infinito) ficam perto de ~99,5%.

Bacará não tem decisão de jogador nenhuma, então o RTP de cada aposta é mesmo um número fixo — só complexo demais pra fórmula fechada por causa da tabela de compra da 3ª carta. `npm run verify:bacara` mede por simulação (1 milhão de rodadas) o RTP de jogador, banca e empate.

## O que falta para isto ser a Fase 0 de verdade

Nesta ordem:

1. **Persistência real** — trocar os arrays em memória por PostgreSQL (as tabelas já estão desenhadas no plano de produto: `users`, `ledger_entries`, `purchases`).
2. **Autenticação** — Firebase Auth com Google, Facebook, Apple e e-mail/senha; `GET /users/me` passa a ler o usuário do token, não um valor fixo.
3. **Compra real** — integrar RevenueCat: o app faz a compra na App Store/Play Store, a RevenueCat valida o recibo e chama um webhook aqui, que só então chama `walletService.credit(...)`. O endpoint `POST /store/comprar` atual serve pra testar o resto do fluxo enquanto isso não existe — ele não deve ir para produção como está, porque hoje qualquer um pode chamá-lo e "comprar" fichas de graça.
4. **Amigos** — tabela `friendships` e endpoints de convite/aceite.
5. **Torneios e ranking** — tabelas `tournaments`, `tournament_entries`, `leaderboards` do plano de produto.
