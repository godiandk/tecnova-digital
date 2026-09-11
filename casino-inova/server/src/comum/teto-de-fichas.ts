/**
 * O TETO DA FICHA — até onde a conta é EXATA, e o que acontece na borda.
 *
 * O JavaScript guarda número em ponto flutuante de 64 bits. Isso dá soma, subtração e
 * multiplicação EXATAS para inteiros até 2^53 − 1 = 9.007.199.254.740.991 (nove
 * quatrilhões). Passando disso, o próprio `+ 1` deixa de funcionar:
 *
 *     9007199254740992 + 1 === 9007199254740992   // true, e não é piada
 *
 * Um saldo que passe dessa linha não fica "quase certo": ele fica calado. A soma erra e
 * ninguém é avisado — que é o pior defeito possível numa carteira.
 *
 * A REPRESENTAÇÃO ESCOLHIDA, e o porquê (decisão registrada, não implícita):
 *
 *   • NO BANCO, ficha é BIGINT. O Postgres soma em 64 bits inteiros — o extrato e o
 *     `SUM` dele são exatos até 9,2 quintilhões, mil vezes mais do que o teto abaixo.
 *   • NO SERVIDOR E NO APLICATIVO, ficha é `number` inteiro. Não é BigInt porque BigInt
 *     não atravessa JSON (vira erro de serialização), obrigaria os dez jogos e a tela
 *     inteira a fazer conta com sufixo `n`, e o ganho só apareceria acima de um teto
 *     que este projeto não alcança — a maior mesa da escada entra com 500 trilhões, e
 *     500 trilhões cabem com folga de dezoito vezes aqui dentro.
 *   • A PONTE ENTRE OS DOIS é conferida: `database.service.ts` converte BIGINT em
 *     número, e `verifica-precisao.ts` prova que a ida e a volta não perdem um dígito
 *     até o teto.
 *
 * A CONSEQUÊNCIA QUE PRECISA SER DITA EM VOZ ALTA: como não existe aposta máxima neste
 * projeto (a decisão está em `problemaComAAposta`), uma aposta grande num jogo que paga
 * muito pode calcular um prêmio ACIMA do teto. Não dá pra deixar isso chegar na
 * carteira: o prêmio sairia errado, ou a carteira recusaria o crédito DEPOIS da aposta
 * já debitada — e aí o jogador veria "você ganhou" na tela e o saldo não subiria. É
 * exatamente o defeito que esta base passou semanas provando que não existe mais.
 *
 * ENTÃO A TRAVA É NA APOSTA, E ANTES DELA. Cada mesa sabe o maior multiplicador que ela
 * é capaz de pagar, e a aposta é recusada, com a conta explicada, quando o prêmio
 * máximo dela não couber. Não é teto pra proteger a casa (a casa não tem caixa que
 * quebre): é teto pra proteger a ARITMÉTICA, e a mensagem na tela diz isso.
 */

/** O maior inteiro em que somar 1 ainda muda o número. 2^53 − 1. */
export const TETO_DE_FICHAS = Number.MAX_SAFE_INTEGER;

/** Este valor é ficha de verdade: inteiro, exato, e não negativo. */
export function fichaExata(valor: number): boolean {
  return Number.isSafeInteger(valor) && valor >= 0;
}

/**
 * A maior aposta cujo prêmio máximo ainda cabe na conta exata.
 *
 * @param maiorMultiplicador o maior retorno TOTAL que uma rodada desta mesa pode pagar,
 *   em múltiplos da aposta — retorno, e não lucro: um jogo que devolve a aposta junto
 *   com o prêmio paga 2x quando o jogador "dobra".
 */
export function apostaMaximaSegura(maiorMultiplicador: number): number {
  if (!Number.isFinite(maiorMultiplicador) || maiorMultiplicador <= 0) return TETO_DE_FICHAS;
  return Math.floor(TETO_DE_FICHAS / maiorMultiplicador);
}

/**
 * O problema de teto desta aposta, ou `null` quando ela cabe.
 *
 * A mensagem é escrita pra ser lida por quem está apostando, e diz a conta inteira: o
 * limite, o multiplicador que o gerou e o motivo. Um número sem motivo na tela de um
 * cassino parece arbitrário — e aqui ele não é.
 */
export function problemaComOTeto(aposta: number, maiorMultiplicador: number): string | null {
  const maxima = apostaMaximaSegura(maiorMultiplicador);
  if (aposta <= maxima) return null;
  return (
    `Nesta mesa a aposta máxima é ${maxima.toLocaleString('pt-BR')} fichas: o prêmio máximo ` +
    `é ${maiorMultiplicador.toLocaleString('pt-BR')}x a aposta, e acima disso a conta das ` +
    'fichas deixaria de ser exata.'
  );
}
