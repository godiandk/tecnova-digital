# Versão de partida da auditoria estrutural

Este arquivo congela o que estava no ar **antes** de qualquer mudança da auditoria.
Ele é o ponto de comparação e o ponto de volta.

## O commit

- **Ramo de partida:** `claude/mobile-casino-tournaments-jdtyzb`
- **Commit:** `ae1c68ea104fee233a37b53ce71b2d326a1dfa74`
- **Título:** Um agente que sabe o jogo: o engenheiro de jogos do Casino Inova
- **Data:** 2026-09-04 16:28:27 +0000
- **Ramo da auditoria:** `claude/auditoria-estrutural` (criado a partir deste commit)

Para voltar tudo ao estado de partida:

```bash
git checkout claude/mobile-casino-tournaments-jdtyzb
```

## Tamanho do que existe

| parte | arquivos | linhas |
|---|---:|---:|
| aplicativo (`app/src`) | 124 | 20213 |
| servidor (`server/src`) | 154 | 14601 |

## Pilha

- **Aplicativo:** Expo SDK ~51.0.0, React Native 0.74.5, Reanimated ~3.10.1, TypeScript ~5.3.3
- **Servidor:** NestJS ^10.3.0, pg ^8.23.0, TypeScript ^5.3.3
- **Banco:** PostgreSQL 16, SQL escrito à mão (sem ORM)
- **Node:** v22.22.2

## Ambiente de homologação

`./homologacao/subir.sh` sobe banco, site e servidor sempre igual, em
`http://localhost:3000`. Com `--testes`, roda todas as conferências depois.

Conta de teste: `wly.vianna@gmail.com` / `senha-de-teste-123` (dono, admin).
