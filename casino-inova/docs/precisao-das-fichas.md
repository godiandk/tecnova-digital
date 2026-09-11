# A precisão das fichas — até onde a conta é exata

> Conferência que prova tudo o que está escrito aqui: `npm run verify:precisao`
> (no servidor). Código: `server/src/comum/teto-de-fichas.ts`.

## O problema, dito sem rodeio

Ficha é número inteiro. No JavaScript, número inteiro é exato até **2^53 − 1 =
9.007.199.254.740.991** (nove quatrilhões). Passando disso, a conta não dá erro —
ela para de funcionar em silêncio:

```js
9007199254740992 + 1 === 9007199254740992   // true
```

Um saldo acima dessa linha não avisa ninguém. Ele simplesmente deixa de subir. Num
livro-caixa isso é o pior defeito possível, porque não aparece em log, não quebra
nenhum teste que não esteja olhando pra ele, e o jogador só descobre quando ganha e o
número na tela não muda — exatamente a cena que esta base passou semanas fechando.

## A representação escolhida

| Camada | Tipo | Exato até |
|---|---|---|
| Postgres (`ledger_entries.amount`, `balance_before`, `balance_after`) | `BIGINT` | 9.223.372.036.854.775.807 (~9,2 quintilhões) |
| Servidor (NestJS) | `number` inteiro | 9.007.199.254.740.991 (2^53 − 1) |
| API (JSON) | `number` | o mesmo 2^53 − 1 |
| Aplicativo (React Native) | `number` inteiro | o mesmo 2^53 − 1 |

O elo mais fraco é o `number`, e é ele que manda no teto.

### Por que não BigInt

BigInt seria exato até a memória acabar, e mesmo assim **não** foi escolhido:

1. **Não atravessa JSON.** `JSON.stringify({ saldo: 1n })` lança exceção. Toda a API
   teria que mandar ficha como *texto*, e cada tela teria que converter na volta — um
   lugar a mais pra alguém esquecer, num caminho que hoje é conferido de ponta a ponta.
2. **Contamina os dez jogos.** Multiplicador, comissão, divisão do bolo e RTP passariam
   a exigir sufixo `n` e conversão em toda conta com fração (comissão de 5% não existe
   em BigInt). Dez motores reescritos por um ganho que ninguém usa.
3. **O ganho é fora do alcance do produto.** A mesa mais alta da escada (Eclipse) entra
   com 500 trilhões de fichas. Isso é **dezoito vezes menos** que o teto. Nenhum caminho
   do jogo leva alguém a nove quatrilhões — e se um dia levar, a decisão volta pra mesa
   com dados, e não por precaução abstrata.

O banco continua em `BIGINT` de propósito: ele é a verdade, e a verdade tem que ter mais
folga que a cópia. `database.service.ts` converte `BIGINT` em `number` na leitura, e
`verify:precisao` prova que a ida e a volta não perdem um dígito, inclusive no teto.

## O que acontece na borda

Como **não existe aposta máxima** neste projeto (decisão registrada em
`problemaComAAposta`: a casa não tem caixa que possa quebrar), uma aposta grande num
jogo que paga muito poderia calcular um prêmio acima do teto. As duas saídas ruins:

- creditar um número errado, em silêncio; ou
- a carteira recusar o crédito **depois** de a aposta já ter sido debitada — "você
  ganhou" na tela e o saldo parado.

Então a trava é **na aposta, e antes dela**. Cada mesa declara o maior retorno que sabe
pagar (`MAIOR_MULTIPLICADOR`, calculado da própria tabela de pagamento sempre que dá), e
a aposta é recusada com a conta explicada quando o prêmio máximo não couber:

> Nesta mesa a aposta máxima é 112.589.990.684 fichas: o prêmio máximo é 80.000x a
> aposta, e acima disso a conta das fichas deixaria de ser exata.

### O que cada jogo pode pagar

| Jogo | Maior retorno | Aposta máxima segura |
|---|---:|---:|
| Caça-níqueis | 80.000x (5 linhas × 16.000) | 112.589.990.684 |
| Bac Bo | 89x (empate em 2 ou 12) | 101.204.486.008.325 |
| Banca Francesa | 62x (Ases) | 145.277.407.334.532 |
| Roleta | 36x (pleno) | 250.199.979.298.360 |
| Blackjack | 17,5x (4 mãos dobradas + seguro) | 514.697.100.270.913 |
| Bacará | 9x (empate) | 1.000.799.917.193.443 |
| Truco / Dominó / Pôquer | 10x (o bolo inteiro) | 900.719.925.474.099 |
| Stock Market | 2x | 4.503.599.627.370.495 |

## O defeito que esta conferência encontrou

No Eclipse, a aposta mínima da mesa é **5 trilhões**. O caça-níqueis paga até 80.000x.
Cinco trilhões vezes oitenta mil não cabe na conta exata — então **o mínimo da mesa era
maior que o máximo aritmético**, e nenhuma aposta era legal. A mesa mais alta do jogo
mais popular era impossível de jogar, e a tela nem sabia disso: ela ofereceria fichas e
o servidor recusaria todas.

Havia três saídas, e duas eram ruins:

- **encurtar a escada de degraus** — mexe na economia, e economia não se muda pra
  consertar aritmética;
- **baixar o prêmio máximo do caça-níqueis** — mexe no pagamento, que é promessa
  publicada ao jogador.

A escolhida é a terceira: **o trilho de fichas daquele jogo para de subir onde a conta
para de ser exata** (`degrauQueCabeNaConta`). No caça-níqueis, as fichas do jogador mais
rico param no degrau Platina (ficha máxima 100 bilhões); nos outros sete jogos elas
sobem a escada inteira, porque esses jogos pagam pouco o bastante pra ela caber. As
fichas continuam sendo as redondas da própria escada — nenhuma denominação inventada — e
a razão aparece na mesma frase que a recusa escreve.

A regra que sustenta isso: **o trilho publicado e a validação da aposta usam a mesma
função, com o mesmo multiplicador**. Se a tela lesse um trilho e o servidor validasse por
outro, estaríamos de volta ao defeito original com outra causa.

## O que a conferência mede

`npm run verify:precisao`, nove seções:

1. a escada de mesas inteira cabe na conta exata, degrau por degrau;
2. o maior prêmio de cada jogo, na maior aposta que ele aceita, ainda é exato;
3. de 50 a um trilhão, o que cada jogo aceita e o que recusa (e a recusa é sempre a do
   teto, nunca uma recusa sem motivo);
4. existe aposta legal em **todos** os doze degraus, em **todos** os jogos;
5. a aposta que não cabe é recusada antes de a ficha sair do saldo, com a conta na
   mensagem;
6. Postgres e JavaScript concordam sobre o mesmo número, na ida e na volta, inclusive
   no teto;
7. o JSON não estraga o número no caminho até a tela;
8. doze créditos de 50 a um trilhão somam exatamente;
9. a carteira recusa um crédito que passaria do teto — e a recusa não mexe no saldo.

As travas foram conferidas por mutação: removendo cada uma delas, a conferência reprova
(a do saldo, por exemplo, deixa o saldo ir a 9.008.754.810.296.540 — passando da linha).
