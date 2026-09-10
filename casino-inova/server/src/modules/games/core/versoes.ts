/**
 * AS VERSÕES QUE FICAM GRAVADAS NA RODADA.
 *
 * Uma rodada guardada hoje precisa continuar interpretável daqui a um ano, depois de a
 * regra mudar. A única forma de conseguir isso é gravar, junto com a rodada, COM QUAL
 * REGRA ela foi decidida — porque quem lê depois não tem como adivinhar, e o código de
 * hoje não estará mais lá pra contar.
 *
 * Sem isso, o replay passa a depender eternamente do código atual: no dia em que a
 * regra mudar, toda rodada velha passa a ser reconstruída com a regra nova, em silêncio,
 * e o resultado reconstruído deixa de ser o que aconteceu. É o pior tipo de defeito de
 * auditoria — o que dá uma resposta confiante e errada.
 *
 * SÃO DUAS COISAS DIFERENTES, e por isso são dois números:
 *
 * - `VERSAO_DA_REGRA` é por jogo, e sobe quando o COMPORTAMENTO muda: o que sai, o que
 *   paga, o que é nulo, qual é o teto. Não sobe por refatoração, nome de variável nem
 *   correção de tela.
 * - `VERSAO_DO_PROTOCOLO` é do formato dos eventos, e sobe quando o FORMATO muda: um
 *   campo que sai, um que muda de sentido, um tipo de evento renomeado. Acrescentar
 *   campo novo que quem lê pode ignorar não sobe versão.
 *
 * A regra pra mexer aqui: subiu a versão, o comentário abaixo diz o que mudou. Uma lista
 * de números sem história é tão inútil quanto não ter versão nenhuma.
 */

/**
 * O formato dos eventos gravados em `eventos_da_rodada`.
 *
 * 1 — primeiro formato: `{ rodada_id, seq, tipo, usuario_id, em, dados }`.
 */
export const VERSAO_DO_PROTOCOLO = 1;

/**
 * A versão da regra de cada jogo.
 *
 * AS CHAVES SÃO OS `GAME_ID` DE VERDADE, lidos dos `*.config.ts` — e não os nomes das
 * pastas nem uma tradução deles. A pasta do bacará se chama `baccarat` e o jogo se chama
 * `bacara`; a da roleta se chama `roulette` e o jogo, `roleta`. Chutar aqui derruba o
 * jogo na primeira rodada, com a mensagem lá de baixo — o que é o comportamento certo,
 * mas é melhor não precisar dele. A conferência `verifica-fases-dos-jogos.ts` compara
 * esta lista com os `GAME_ID` do código e reprova se divergirem.
 *
 * banca-francesa 2 — a rodada solo passou a existir: o lançamento nulo mantém as apostas
 *                    de pé e não cobra nada, e a cobrança acontece só no lançamento
 *                    decisivo. Antes cada lançamento era uma rodada.
 * slots          2 — tabela recalibrada: RTP de 89,1673% pra 95,9715%, com pesos e
 *                    prêmios novos (ver docs/matematica-dos-slots.md).
 * os demais      1 — primeira versão registrada.
 */
export const VERSAO_DA_REGRA: Record<string, number> = {
  'banca-francesa': 2,
  slots: 2,
  'bac-bo': 1,
  bacara: 1,
  blackjack: 1,
  domino: 1,
  poker: 1,
  roleta: 1,
  'stock-market': 1,
  truco: 1,
};

/**
 * A versão da regra no formato que vai pro banco: `jogo@n`.
 *
 * Guardar as duas coisas juntas numa string, em vez de duas colunas, é de propósito:
 * quem lê uma rodada de seis meses atrás precisa saber "qual regra", e "banca-francesa@1"
 * responde sozinho. Um número solto na coluna obrigaria a saber de qual jogo ele é, e a
 * primeira consulta feita às pressas esqueceria disso.
 */
export function versaoDaRegra(jogo: string): string {
  const n = VERSAO_DA_REGRA[jogo];
  if (n === undefined) {
    throw new Error(
      `Jogo "${jogo}" não tem versão de regra declarada em versoes.ts. ` +
        'Toda rodada gravada precisa dizer com qual regra foi decidida.',
    );
  }
  return `${jogo}@${n}`;
}
