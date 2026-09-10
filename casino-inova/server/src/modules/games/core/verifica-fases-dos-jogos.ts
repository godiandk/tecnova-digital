import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { PROXIMAS_FASES, aceitaAposta, podeIrPara, rodadaDecidida } from './fases';
import { VERSAO_DA_REGRA } from './versoes';
import type { FaseDaRodada } from '../../../protocolo';

/**
 * OS DEZ JOGOS PASSAM PELA MÁQUINA DE FASES?
 *
 *   npx ts-node src/modules/games/core/verifica-fases-dos-jogos.ts
 *
 * A máquina em `fases.ts` existia desde sempre, e um jogo de dez a usava. Nos outros
 * nove, "não dá pra apostar depois do fechamento" era resolvido de um jeito diferente em
 * cada um — ou não era. Esta conferência é a trava que impede a situação de voltar.
 *
 * Ela confere três coisas, e a terceira é a que dá trabalho de manter honesta:
 *
 * 1. A MÁQUINA EM SI recusa transição impossível. É a base de tudo: se ela aceitasse
 *    qualquer coisa, os jogos passariam por ela sem ganhar nada.
 * 2. TODO JOGO ESTÁ LIGADO nela. Uma varredura dos serviços: quem move dinheiro tem que
 *    registrar rodada. É uma conferência de TEXTO, e isso é uma limitação de propósito —
 *    ela não prova que o jogo usa a máquina direito, prova que ele não a ignora. O
 *    "direito" é provado pela conferência de replay e pelas conferências de cada jogo.
 * 3. O CAMINHO DE CADA JOGO é possível. Um jogo de um lance vai direto do sorteio pra
 *    apuração; um jogo com turno passa por ACOES_DOS_JOGADORES. Os dois caminhos são
 *    conferidos aqui contra a máquina, então tirar uma transição de `fases.ts` quebra
 *    esta conferência antes de quebrar o jogo em produção.
 */

let falhas = 0;
const ok = (m: string) => console.log(`ok    ${m}`);
const falhar = (m: string) => {
  falhas += 1;
  console.log(`FALHOU: ${m}`);
};

/* ------------------------------------------------------------------ *
 * 1. A máquina recusa o impossível.
 * ------------------------------------------------------------------ */
const TODAS = Object.keys(PROXIMAS_FASES) as FaseDaRodada[];

const impossiveis: Array<[FaseDaRodada, FaseDaRodada]> = [
  /* Apostar depois de fechar: o defeito que a máquina existe pra impedir. */
  ['APOSTAS_FECHADAS', 'APOSTAS_ABERTAS'],
  /* Pagar sem apurar: pagaria por um resultado que ninguém conferiu. */
  ['SORTEIO', 'PAGAMENTO'],
  /* Sortear sem fechar as apostas: dá pra apostar sabendo o resultado. */
  ['APOSTAS_ABERTAS', 'SORTEIO'],
  /* Reabrir uma rodada já fechada em vez de começar outra. */
  ['RODADA_FECHADA', 'APURACAO'],
  /* Voltar do pagamento pro sorteio: sortearia de novo com dinheiro já pago. */
  ['PAGAMENTO', 'SORTEIO'],
];
let recusouTodas = true;
for (const [de, para] of impossiveis) {
  if (podeIrPara(de, para)) {
    falhar(`a máquina aceita ${de} -> ${para}, e não devia`);
    recusouTodas = false;
  }
}
if (recusouTodas) ok(`a máquina recusa as ${impossiveis.length} transições impossíveis conferidas`);

aceitaAposta('APOSTAS_ABERTAS') &&
TODAS.filter((f) => f !== 'APOSTAS_ABERTAS').every((f) => !aceitaAposta(f))
  ? ok('aposta só entra em APOSTAS_ABERTAS, e em mais nenhuma fase')
  : falhar('alguma fase que não é APOSTAS_ABERTAS está aceitando aposta');

(['APURACAO', 'PAGAMENTO', 'RODADA_FECHADA'] as FaseDaRodada[]).every(rodadaDecidida) &&
!rodadaDecidida('APOSTAS_ABERTAS') &&
!rodadaDecidida('SORTEIO')
  ? ok('a rodada é dada como decidida só depois da apuração')
  : falhar('rodadaDecidida está marcando fase errada');

/* Nenhuma fase pode ser um beco sem saída, exceto por desenho. */
const semSaida = TODAS.filter((f) => PROXIMAS_FASES[f].length === 0);
semSaida.length === 0
  ? ok('nenhuma fase é beco sem saída')
  : falhar(`fases sem saída: ${semSaida.join(', ')}`);

/* ------------------------------------------------------------------ *
 * 2. Todo jogo que move dinheiro registra rodada.
 * ------------------------------------------------------------------ */
const JOGOS = 'src/modules/games';
const pastas = readdirSync(JOGOS, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !['core', 'shared'].includes(d.name))
  .map((d) => d.name);

pastas.length === 10
  ? ok(`os 10 jogos foram encontrados: ${pastas.join(', ')}`)
  : falhar(`achei ${pastas.length} jogos em vez de 10: ${pastas.join(', ')}`);

const semMaquina: string[] = [];
const semIdDaRodadaNoExtrato: string[] = [];
for (const jogo of pastas) {
  const arquivos = readdirSync(join(JOGOS, jogo)).filter((f) => f.endsWith('.service.ts'));
  const texto = arquivos.map((f) => readFileSync(join(JOGOS, jogo, f), 'utf8')).join('\n');
  const moveDinheiro = texto.includes('walletService.debit');
  if (!moveDinheiro) continue;

  /* A Banca Francesa usa o repositório direto porque a rodada dela dura vários lances. */
  const usaMaquina = texto.includes('MaquinaDeRodada') || texto.includes('RodadasRepository');
  if (!usaMaquina) semMaquina.push(jogo);

  /*
   * O débito tem que carregar o id da rodada. Sem isso o extrato sabe QUANTO saiu e não
   * sabe DE QUE RODADA — que é a metade que faltava pra investigar uma reclamação.
   */
  /*
   * A chamada pode estar em uma linha ou quebrada em sete — o blackjack tem das duas. O
   * que a conferência exige é que o ARGUMENTO exista e nomeie uma rodada; a forma de
   * escrever é do gosto de quem escreveu.
   */
  const debitos = texto.match(/walletService\.debit\((?:[^()]|\([^()]*\))*\)/gs) ?? [];
  const semRodada = debitos.filter((d) => !/rodada/i.test(d));
  if (semRodada.length > 0) {
    semIdDaRodadaNoExtrato.push(`${jogo} (${semRodada.length})`);
  }
}
semMaquina.length === 0
  ? ok('todo jogo que move dinheiro registra a rodada')
  : falhar(`estes movem dinheiro sem registrar rodada: ${semMaquina.join(', ')}`);
semIdDaRodadaNoExtrato.length === 0
  ? ok('todo débito carrega o id da rodada pro extrato')
  : falhar(`débito sem id da rodada em: ${semIdDaRodadaNoExtrato.join(', ')}`);

/* ------------------------------------------------------------------ *
 * 2b. Todo GAME_ID tem versão de regra declarada.
 *
 * Sem isto, um jogo só descobre que a versão dele não existe na PRIMEIRA RODADA de
 * verdade, com um erro 500 no rosto do jogador. Já aconteceu aqui: as chaves tinham sido
 * escritas a partir do nome da PASTA (`baccarat`, `roulette`) e os jogos se chamam
 * `bacara` e `roleta`.
 * ------------------------------------------------------------------ */
{
  const semVersao: string[] = [];
  for (const jogo of pastas) {
    const arquivos = readdirSync(join(JOGOS, jogo)).filter((f) => f.endsWith('.ts'));
    const texto = arquivos.map((f) => readFileSync(join(JOGOS, jogo, f), 'utf8')).join('\n');
    const achado = texto.match(/GAME_ID\s*=\s*'([a-z-]+)'/);
    if (!achado) continue;
    if (VERSAO_DA_REGRA[achado[1]] === undefined) semVersao.push(`${jogo} (GAME_ID "${achado[1]}")`);
  }
  semVersao.length === 0
    ? ok('todo GAME_ID tem versão de regra declarada em versoes.ts')
    : falhar(`sem versão de regra declarada: ${semVersao.join(', ')}`);
}

/* ------------------------------------------------------------------ *
 * 3. O caminho de cada tipo de jogo existe na máquina.
 * ------------------------------------------------------------------ */
const CAMINHOS: Array<[string, FaseDaRodada[]]> = [
  [
    'jogo de um lance (roleta, slots, bacará, bac bo, stock market)',
    ['ESPERANDO_JOGADORES', 'RODADA_ABERTA', 'APOSTAS_ABERTAS', 'APOSTAS_FECHADAS', 'SORTEIO', 'APURACAO', 'PAGAMENTO', 'RODADA_FECHADA'],
  ],
  [
    'jogo com turno (blackjack, poker, truco, dominó)',
    ['APOSTAS_ABERTAS', 'APOSTAS_FECHADAS', 'SORTEIO', 'ACOES_DOS_JOGADORES', 'APURACAO', 'PAGAMENTO', 'RODADA_FECHADA'],
  ],
  [
    'banca francesa: o lançamento nulo volta pra aposta sem fechar a rodada',
    ['APOSTAS_ABERTAS', 'APOSTAS_FECHADAS', 'SORTEIO', 'APOSTAS_ABERTAS', 'APOSTAS_FECHADAS', 'SORTEIO', 'APURACAO', 'PAGAMENTO', 'RODADA_FECHADA'],
  ],
  ['a mesa recomeça depois de fechar', ['RODADA_FECHADA', 'RODADA_ABERTA', 'APOSTAS_ABERTAS']],
];
for (const [nome, caminho] of CAMINHOS) {
  const quebra = caminho.slice(1).findIndex((f, i) => !podeIrPara(caminho[i], f));
  quebra === -1
    ? ok(`o caminho do ${nome} é possível na máquina`)
    : falhar(`o caminho do ${nome} quebra em ${caminho[quebra]} -> ${caminho[quebra + 1]}`);
}

console.log(
  falhas === 0
    ? '\nOK: os dez jogos passam pela mesma máquina de fases, e ela recusa o impossível.'
    : `\n${falhas} PROBLEMA(S)`,
);
process.exit(falhas === 0 ? 0 : 1);
