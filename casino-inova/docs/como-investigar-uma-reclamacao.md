# Como investigar uma reclamação

"Girei e não me pagaram." "Sumiram minhas fichas." "A mesa travou e perdi a aposta."

Este documento é o caminho de uma reclamação até a resposta, com o que existe hoje. Ele
serve para o suporte e serve para quem for programar: se algum passo aqui não funcionar,
é defeito, não é limitação.

---

## O caminho, em uma linha

**print → `X-Pedido` → linha do registro → número da rodada → a rodada inteira → o extrato**

Cada seta abaixo é uma peça que existe e foi construída para isso. Nenhuma delas sozinha
responde à pergunta; juntas, respondem.

---

## 1. Peça o número do pedido

Toda resposta do servidor volta com um cabeçalho `X-Pedido`, com oito caracteres. É o
único número que a pessoa consegue mandar sem entender nada de sistema.

Se ela não tiver o número, dá para chegar pelo horário e pelo id da conta — mais trabalho,
mesmo resultado.

## 2. Ache a linha do registro

O servidor escreve **uma linha de JSON por requisição**. Achar é `grep`:

```
grep '"pedido":"5d9c909d"' registro.log | jq
```

O que vem:

```json
{"em":"2026-09-10T05:24:50Z","nivel":"info","onde":"http","mensagem":"POST /games/slots/girar",
 "pedido":"5d9c909d","usuario":"u-123","jogo":"slots","rodada":"f4bf42b1-…","status":201,"ms":38}
```

`nivel` já responde metade das perguntas:

| `nivel` | O que é | O que fazer |
|---|---|---|
| `info` | deu certo | a resposta está na rodada (passo 3) |
| `aviso` | 4xx — foi recusado | o campo `falha.mensagem` diz por quê: saldo, token vencido, aposta fora da mesa |
| `erro` | 5xx — foi nosso | isto é um defeito nosso, e a lista destes deveria estar vazia |

Se **não existe linha nenhuma** para aquele pedido, isso também é resposta: a requisição
não chegou. Rede, aplicativo ou proxy — mas não o servidor.

## 3. Puxe a rodada inteira

Com o número da rodada da linha acima:

```
GET /admin/rodadas/f4bf42b1-…       (precisa da permissão ver_carteira_usuario)
```

Devolve a rodada e **todos os eventos dela, em ordem, com hora**: apostas confirmadas,
sorteio, cada ação do jogador, liquidação. É o replay do que aconteceu — e vem com
`versaoDaRegra` e `versaoDoProtocolo`, então dá para saber com qual regra aquela rodada
foi julgada, mesmo que a regra tenha mudado depois.

É aqui que a maioria das reclamações termina. "Não pagou" quase sempre é "pagou, e o
extrato mostra" ou "a aposta não era a que a pessoa lembra" — e as duas coisas estão
escritas, com hora.

## 4. Confira o dinheiro

```
GET /admin/carteira/:userId/historico
```

O extrato é a fonte da verdade sobre saldo — nunca o registro, nunca a memória do
aplicativo. Cada lançamento carrega o id da rodada, então bate direto com o passo 3.

---

## Quando a rodada abriu e não fechou

```
GET /admin/rodadas-abertas
```

**Esta lista não pode crescer.** Uma rodada aberta sem resultado significa que o processo
morreu no meio dela.

Ela existe de propósito: a máquina de rodadas registra a rodada **antes** de qualquer
débito, exatamente para que o pior caso possível seja este — uma rodada visível e
incompleta — e nunca dinheiro movido sem nada que o explique. Se aparecerem itens aqui,
cada um é uma investigação, e a hora deles diz quando o servidor caiu.

---

## O que o registro nunca vai ter

E é bom que não tenha:

- **senha, token, cookie, chave** — escondidos por nome e por formato. Um JWT guardado
  numa chave chamada `x` também some, porque o formato é reconhecido;
- **e-mail, CPF, telefone, data de nascimento, endereço** — dado pessoal não vai para log;
- **saldo** — quem quer saldo lê o extrato, que é a fonte. Saldo em log é número velho.

Vai o **id** da pessoa, que é o que serve para achar a conta sem espalhar dado dela.

Isso é conferido, não prometido: `npm run verify:registro` e
`node verificacao/verifica-registro-http.mjs`.

---

## Para quem programa

| Quero | Uso |
|---|---|
| escrever uma linha | `registro.info('slots', 'girou', { … })` |
| marcar a rodada em todas as linhas seguintes do pedido | `acrescentarAoContexto({ jogo, rodada })` |
| ler o contexto de agora | `contextoAgora()` |

Não precisa passar o número do pedido adiante: ele viaja sozinho, num
`AsyncLocalStorage` aberto pelo middleware antes de qualquer guard.

**O contexto é de observação, nunca de decisão.** Autorização, saldo e regra continuam
vindo por parâmetro e passando pelo banco. No dia em que uma decisão de dinheiro depender
de um valor implícito, ninguém mais consegue ler o código e ter certeza do que ele faz.
