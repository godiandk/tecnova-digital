import { DecisiveOutcome } from './banca-francesa.engine';

/**
 * O PLACAR DA BANCA FRANCESA — o dela, não o do bacará.
 *
 * O placar antigo reusava as cinco estradas do bacará, traduzindo os resultados:
 * `grande` virava "banca", `pequeno` virava "jogador" e `ases` virava "empate". A
 * tradução parecia razoável (dois lados que se alternam mais um resultado raro), e
 * apagava tudo que a Banca Francesa tem de próprio:
 *
 *   - Os DADOS somem. O placar de um jogo de dados mostrava bolinha vermelha e azul.
 *   - A SOMA some. É a soma que decide a rodada, e ela não aparecia em lugar nenhum.
 *   - Os NULOS somem. Mais de setenta por cento dos lançamentos são nulos (153 de 216),
 *     e o placar fingia que eles não existiam — quem contasse pelo placar acharia que a
 *     mesa decide todo lance.
 *   - E "empate" para as ASES é errado de duas maneiras: ases não é empate (é a aposta
 *     que paga 61 por 1) e o bacará desenha empate como um risco em cima da célula
 *     anterior, então a jogada mais rara e mais valiosa da mesa aparecia como um traço.
 *
 * Aqui o placar é dos dados: cada lançamento com as três faces, a soma e a
 * classificação — inclusive nulo. Os contadores dizem quantas vezes cada coisa saiu.
 *
 * O AVISO CONTINUA VALENDO, e a tela o repete: isto é histórico, não previsão. Os dados
 * não têm memória. Trinta nulos seguidos não deixam o próximo lance mais nem menos
 * provável de decidir — a chance é 63 em 216 sempre, no primeiro lance e no trigésimo
 * primeiro.
 */

/** O que uma soma de três dados vale nesta mesa. `nulo` é o que não decide. */
export type ResultadoDoLancamento = DecisiveOutcome | 'nulo';

/** Um lançamento, com os dados na ordem em que eles saem do copo: azul, verde, vermelho. */
export interface LancamentoNoPlacar {
  /** Identificador único do lançamento — é por ele que a tela sabe o que já mostrou. */
  rollId: string;
  dice: [number, number, number];
  sum: number;
  outcome: ResultadoDoLancamento;
  createdAt: string;
}

export interface PlacarDaBanca {
  /** O lançamento anterior, com os dados nomeados pela cor — nulo antes do primeiro. */
  previous: {
    rollId: string;
    dice: { blue: number; green: number; red: number };
    sum: number;
    outcome: ResultadoDoLancamento;
    createdAt: string;
  } | null;
  /** Do mais recente pro mais antigo. */
  history: Array<{
    rollId: string;
    dice: [number, number, number];
    sum: number;
    outcome: ResultadoDoLancamento;
  }>;
  counts: {
    ases: number;
    pequeno: number;
    grande: number;
    nulos: number;
    /** Todos os lançamentos guardados, decisivos e nulos. */
    totalRolls: number;
  };
}

/** Quantos lançamentos o placar guarda. Doze colunas de doze, como a mesa física. */
export const LANCAMENTOS_GUARDADOS = 144;

/**
 * Monta o placar a partir dos lançamentos guardados.
 *
 * Recebe a lista na ordem em que aconteceu (o mais antigo primeiro) e devolve o
 * histórico invertido, porque é assim que a tela lê: o que acabou de sair fica na
 * frente.
 */
export function montarPlacar(lancamentos: LancamentoNoPlacar[]): PlacarDaBanca {
  const ultimo = lancamentos[lancamentos.length - 1];
  const conta = (o: ResultadoDoLancamento) => lancamentos.filter((l) => l.outcome === o).length;

  return {
    previous: ultimo
      ? {
          rollId: ultimo.rollId,
          /*
           * Os dados vêm NOMEADOS PELA COR aqui, e como lista no histórico. Não é
           * inconsistência: no último lançamento a cor importa (é o que está na mesa, e
           * é como a pessoa vai conferir olhando), e no histórico o que importa é a
           * sequência — uma lista de 144 objetos com três chaves cada seria três vezes
           * maior sem dizer mais nada.
           */
          dice: { blue: ultimo.dice[0], green: ultimo.dice[1], red: ultimo.dice[2] },
          sum: ultimo.sum,
          outcome: ultimo.outcome,
          createdAt: ultimo.createdAt,
        }
      : null,
    history: [...lancamentos]
      .reverse()
      .map(({ rollId, dice, sum, outcome }) => ({ rollId, dice, sum, outcome })),
    counts: {
      ases: conta('ases'),
      pequeno: conta('pequeno'),
      grande: conta('grande'),
      nulos: conta('nulo'),
      totalRolls: lancamentos.length,
    },
  };
}
