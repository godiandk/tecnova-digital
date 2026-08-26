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

Teste rápido de ponta a ponta:

```
curl http://localhost:3000/wallet/u1/saldo
curl -X POST http://localhost:3000/store/comprar -H "Content-Type: application/json" -d '{"userId":"u1","packageId":"ouro"}'
curl http://localhost:3000/wallet/u1/saldo
```

O saldo depois da compra deve estar 40.000 fichas maior.

## O que falta para isto ser a Fase 0 de verdade

Nesta ordem:

1. **Persistência real** — trocar os arrays em memória por PostgreSQL (as tabelas já estão desenhadas no plano de produto: `users`, `ledger_entries`, `purchases`).
2. **Autenticação** — Firebase Auth com Google, Facebook, Apple e e-mail/senha; `GET /users/me` passa a ler o usuário do token, não um valor fixo.
3. **Compra real** — integrar RevenueCat: o app faz a compra na App Store/Play Store, a RevenueCat valida o recibo e chama um webhook aqui, que só então chama `walletService.credit(...)`. O endpoint `POST /store/comprar` atual serve pra testar o resto do fluxo enquanto isso não existe — ele não deve ir para produção como está, porque hoje qualquer um pode chamá-lo e "comprar" fichas de graça.
4. **Amigos** — tabela `friendships` e endpoints de convite/aceite.
5. **Torneios e ranking** — tabelas `tournaments`, `tournament_entries`, `leaderboards` do plano de produto.
