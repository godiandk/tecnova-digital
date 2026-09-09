import { PAYLINES, SLOT_SYMBOLS } from './slots.config';
import { spin, theoreticalRtp } from './slots.engine';

/**
 * A MATEMÁTICA DO CAÇA-NÍQUEIS ESTÁ ONDE DEVERIA?
 *
 *   npx ts-node src/modules/games/slots/verify-rtp.ts
 *
 * Esta conferência REPROVA (sai com 1) — ela não é um relatório. É a trava que existe
 * porque o RTP já esteve em 89,17% sem ninguém perceber: um número numa tabela não
 * anuncia sozinho que está errado, e "mexi num peso e o jogo continuou funcionando" é
 * exatamente como uma margem escondida entra num jogo.
 *
 * Ela confere seis coisas, e cada uma existe por um motivo:
 *
 * 1. A FÓRMULA BATE COM A SIMULAÇÃO. Duas contas independentes — uma fechada, outra de
 *    meio milhão de giros pelo motor de verdade. Se divergirem, ou a fórmula não
 *    descreve o motor, ou o motor não faz o que a fórmula diz. As duas são graves.
 * 2. O RTP ESTÁ NA FAIXA DECIDIDA. 96% foi decisão de produto, não de programação: é o
 *    RTP modal do slot de vídeo regulado, e deixa o slot como a mesa mais apertada da
 *    casa — que é o que ele é em qualquer cassino — sem ser punitivo.
 * 3. A FREQUÊNCIA DE VITÓRIA É DE SLOT. Abaixo de 18% o jogo só drena; acima de 30% o
 *    prêmio deixa de significar alguma coisa.
 * 4. A ESCADA DE PRÊMIOS EXISTE. Símbolo mais raro paga mais, e dentro do símbolo 3 < 4
 *    < 5. Uma tabela que viola isso ensina errado quem olha.
 * 5. O MAIOR PRÊMIO É ALCANÇÁVEL. Ele já esteve a uma vez em 3,3 x 10^34 giros — mais
 *    raro que qualquer coisa que já aconteceu no universo. Prêmio que não sai não é
 *    prêmio: é enfeite, e enfeite anunciado como prêmio é propaganda enganosa.
 * 6. NENHUM SÍMBOLO É INÚTIL. O Jackpot chegou a contribuir 0,013 ponto de RTP. Um
 *    símbolo que não move o retorno é um símbolo que só serve pra ocupar espaço na
 *    tela e criar expectativa que a matemática não sustenta.
 *
 * O relatório completo, com a distribuição exata do retorno, sai de
 * `tools/analisa-slot.py` — que calcula sem simular.
 */

/*
 * CINCO MILHÕES, e não meio milhão — e o motivo é o desvio padrão.
 *
 * O retorno de um giro tem desvio padrão de 10,4 vezes a aposta (medido em
 * tools/analisa-slot.py). O erro padrão da média cai com a raiz do número de giros:
 * com 500 mil giros ele é de 1,47 ponto percentual, o que significa que a conferência
 * só perceberia um erro maior que uns quatro pontos. Com cinco milhões o erro padrão
 * cai pra 0,47 ponto, e a trava passa a valer alguma coisa.
 */
const GIROS = 5_000_000;
const APOSTA = 100;

/** A faixa aceita. Mexer nisto é decisão de produto, e tem que ser deliberada. */
const RTP_ALVO = 0.96;
const TOLERANCIA_DO_ALVO = 0.005; // meio ponto percentual pra cada lado
/**
 * Quantos erros padrão de folga a simulação tem.
 *
 * A folga NÃO é um número fixo: ela é calculada a partir da variância observada na
 * própria simulação. Um limite fixo é errado nos dois sentidos — frouxo demais quando a
 * volatilidade é alta (foi o caso antes: dois pontos de folga com erro padrão de 1,5
 * ponto não travava nada) e apertado demais se um dia o jogo ficar mais calmo. Três
 * erros padrão deixa a chance de reprovar à toa em cerca de 1 em 370.
 */
const ERROS_PADRAO_DE_FOLGA = 3;
const FREQUENCIA_MINIMA = 0.18;
const FREQUENCIA_MAXIMA = 0.30;
/** Uma vez a cada 50 milhões de giros ainda é um jackpot. Mais raro que isso é enfeite. */
const GIROS_MAXIMOS_PRO_MAIOR_PREMIO = 50_000_000;
/** Contribuição mínima de qualquer símbolo, em pontos de RTP. */
const CONTRIBUICAO_MINIMA = 0.5;

let falhas = 0;
const ok = (m: string) => console.log(`ok    ${m}`);
const falhar = (m: string) => {
  falhas += 1;
  console.log(`FALHOU: ${m}`);
};

const pct = (v: number, casas = 4) => `${(v * 100).toFixed(casas)}%`;

/* --- 1. fórmula contra simulação --- */
const teorico = theoreticalRtp();
let apostado = 0;
let devolvido = 0;
let giroComPremio = 0;
/* Soma dos quadrados do retorno, pra tirar o desvio padrão da própria simulação. */
let somaDosQuadrados = 0;
for (let i = 0; i < GIROS; i += 1) {
  const r = spin(APOSTA);
  const retorno = r.totalWin / APOSTA;
  apostado += APOSTA;
  devolvido += r.totalWin;
  somaDosQuadrados += retorno * retorno;
  if (r.totalWin > 0) giroComPremio += 1;
}
const simulado = devolvido / apostado;
const frequencia = giroComPremio / GIROS;
const variancia = somaDosQuadrados / GIROS - simulado * simulado;
const desvio = Math.sqrt(Math.max(0, variancia));
const erroPadrao = desvio / Math.sqrt(GIROS);
const folga = ERROS_PADRAO_DE_FOLGA * erroPadrao;

console.log(`\nRTP por fórmula fechada  ${pct(teorico, 4)}`);
console.log(`RTP por ${GIROS.toLocaleString('pt-BR')} giros  ${pct(simulado, 4)}`);
console.log(`frequência de vitória    ${pct(frequencia, 2)}  (um giro em ${(1 / frequencia).toFixed(1)})`);
console.log(`desvio padrão do retorno ${desvio.toFixed(3)}x a aposta`);
console.log(`erro padrão da média     ${pct(erroPadrao, 4)}  (folga de ${ERROS_PADRAO_DE_FOLGA} deles: ${pct(folga, 4)})\n`);

const diferenca = Math.abs(simulado - teorico);
diferenca <= folga
  ? ok(
      `fórmula e simulação concordam: diferença de ${((simulado - teorico) * 100).toFixed(4)} pontos, ` +
        `dentro dos ${ERROS_PADRAO_DE_FOLGA} erros padrão (${pct(folga, 4)})`,
    )
  : falhar(
      `fórmula diz ${pct(teorico)} e a simulação diz ${pct(simulado)} — diferença de ` +
        `${(diferenca / erroPadrao).toFixed(1)} erros padrão. Ou a fórmula não descreve o motor, ` +
        'ou o motor não faz o que ela diz.',
    );

/* --- 2. o RTP está na faixa decidida --- */
Math.abs(teorico - RTP_ALVO) <= TOLERANCIA_DO_ALVO
  ? ok(`RTP em ${pct(teorico)}, dentro de ${pct(RTP_ALVO, 0)} ± ${pct(TOLERANCIA_DO_ALVO, 1)}`)
  : falhar(
      `RTP em ${pct(teorico)}, fora de ${pct(RTP_ALVO, 0)} ± ${pct(TOLERANCIA_DO_ALVO, 1)}. ` +
        'Se a mudança foi de propósito, o alvo desta conferência tem que mudar junto — e isso é decisão de produto.',
    );

/* --- 3. a frequência de vitória é de slot --- */
frequencia >= FREQUENCIA_MINIMA && frequencia <= FREQUENCIA_MAXIMA
  ? ok(`vitória em ${pct(frequencia, 2)} dos giros, dentro de ${pct(FREQUENCIA_MINIMA, 0)}–${pct(FREQUENCIA_MAXIMA, 0)}`)
  : falhar(`vitória em ${pct(frequencia, 2)} dos giros, fora de ${pct(FREQUENCIA_MINIMA, 0)}–${pct(FREQUENCIA_MAXIMA, 0)}`);

/* --- 4. a escada de prêmios --- */
const porRaridade = [...SLOT_SYMBOLS].sort((a, b) => b.weight - a.weight);
let escadaOk = true;
for (let i = 1; i < porRaridade.length; i += 1) {
  const comum = porRaridade[i - 1];
  const raro = porRaridade[i];
  for (const n of [3, 4, 5] as const) {
    if (raro.payout[n] <= comum.payout[n]) {
      falhar(`${raro.label} é mais raro que ${comum.label} e não paga mais em ${n} iguais`);
      escadaOk = false;
    }
  }
}
for (const s of SLOT_SYMBOLS) {
  if (!(s.payout[3] < s.payout[4] && s.payout[4] < s.payout[5])) {
    falhar(`${s.label}: 3, 4 e 5 iguais não estão em ordem crescente`);
    escadaOk = false;
  }
}
if (escadaOk) ok('a escada de prêmios sobe: mais raro paga mais, e 3 < 4 < 5 em todos');

/* --- 5. o maior prêmio é alcançável --- */
const pesoTotal = SLOT_SYMBOLS.reduce((t, s) => t + s.weight, 0);
const maior = SLOT_SYMBOLS.reduce((a, b) => (a.payout[5] > b.payout[5] ? a : b));
const pMaior = maior.weight / pesoTotal;
/* Cinco iguais numa linha; as cinco linhas dão aproximadamente cinco chances. */
const umEmQuantos = 1 / (pMaior ** 5 * PAYLINES.length);
umEmQuantos <= GIROS_MAXIMOS_PRO_MAIOR_PREMIO
  ? ok(
      `o maior prêmio (${maior.label} 5 iguais, ${maior.payout[5]}x) sai uma vez a cada ` +
        `${Math.round(umEmQuantos).toLocaleString('pt-BR')} giros`,
    )
  : falhar(
      `o maior prêmio sai uma vez a cada ${Math.round(umEmQuantos).toLocaleString('pt-BR')} giros — ` +
        'nesse ritmo ele não é prêmio, é enfeite',
    );

/* --- 6. nenhum símbolo é inútil --- */
let todosContribuem = true;
for (const s of SLOT_SYMBOLS) {
  const p = s.weight / pesoTotal;
  const contribuicao =
    (p ** 3 * (1 - p) * s.payout[3] + p ** 4 * (1 - p) * s.payout[4] + p ** 5 * s.payout[5]) *
    PAYLINES.length *
    100;
  if (contribuicao < CONTRIBUICAO_MINIMA) {
    falhar(`${s.label} contribui só ${contribuicao.toFixed(3)} ponto de RTP — está lá só de enfeite`);
    todosContribuem = false;
  }
}
if (todosContribuem) ok(`todos os 9 símbolos contribuem pelo menos ${CONTRIBUICAO_MINIMA} ponto de RTP`);

console.log(
  falhas === 0
    ? `\nOK: o caça-níqueis devolve ${pct(teorico)}, e devolve do jeito que um slot devolve.`
    : `\n${falhas} PROBLEMA(S)`,
);
process.exit(falhas === 0 ? 0 : 1);
