import { resolveBets, theoreticalRtp } from './banca-francesa.engine';
import { BET_TYPES } from './banca-francesa.config';

/**
 * Prova exata dos pagamentos — sem simulação, sem amostra.
 *
 *   npx ts-node src/modules/games/banca-francesa/verify-payouts.ts
 *
 * O verify-rtp.ts ao lado joga meio milhão de rodadas e confere que a média converge.
 * Este aqui faz outra coisa, e as duas juntas são o que dá confiança: percorre as 63
 * combinações que decidem, pesa cada uma pelo número de jeitos de sair, e compara o
 * resultado com o RTP que o motor declara. Se alguém mexer numa tabela de pagamento e
 * esquecer da outra, isto acusa na hora — não depois, no extrato de alguém.
 *
 * Confere também que TODO pagamento fecha em ficha inteira. A aposta de linha é
 * dividida ao meio, e o saldo é BIGINT: meia ficha não existe.
 */
const CAMINHOS = { ases: 1, pequeno: 31, grande: 31 } as const;
const DECISIVAS = CAMINHOS.ases + CAMINHOS.pequeno + CAMINHOS.grande;
const APOSTA = 100;

let falhou = false;

for (const tipo of BET_TYPES) {
  let devolvido = 0;
  for (const resultado of ['ases', 'pequeno', 'grande'] as const) {
    const [r] = resolveBets(resultado, [{ type: tipo, amount: APOSTA }]);
    if (!Number.isInteger(r.totalReturn)) {
      console.error(`  ${tipo} / ${resultado}: devolveu ${r.totalReturn} — não é ficha inteira`);
      falhou = true;
    }
    devolvido += r.totalReturn * CAMINHOS[resultado];
  }
  const medido = devolvido / DECISIVAS / APOSTA;
  const declarado = theoreticalRtp(tipo);
  const bate = Math.abs(medido - declarado) < 1e-12;
  if (!bate || medido > 1) falhou = true;
  console.log(
    `  ${tipo.padEnd(14)} declarado ${(declarado * 100).toFixed(4)}%  medido ${(medido * 100).toFixed(4)}%  ` +
      `${bate ? 'bate' : 'DIVERGE'}${medido > 1 ? '  A CASA PERDE DINHEIRO' : ''}`,
  );
}

process.exit(falhou ? 1 : 0);
