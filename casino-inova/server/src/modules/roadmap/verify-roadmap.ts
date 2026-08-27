import { RoadmapService, RoundRecord, RoadOutcome } from './roadmap.service';

/**
 *   npx ts-node src/modules/roadmap/verify-roadmap.ts
 *
 * Confere a construção das estradas contra casos montados à mão, onde dá pra saber
 * o resultado certo sem rodar código.
 */
const service = new RoadmapService();
let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures += 1;
  console.log(`${ok ? 'OK  ' : 'FALHOU'} ${label}`);
  if (!ok) {
    console.log(`      esperado: ${e}`);
    console.log(`      obtido:   ${a}`);
  }
}

const r = (outcome: RoadOutcome): RoundRecord => ({ outcome });

// --- Big Road: coluna nova a cada troca de vencedor ---
{
  const rounds = [r('banca'), r('banca'), r('jogador'), r('banca')];
  const columns = service.buildBigRoad(rounds);
  check(
    'Big Road agrupa em colunas por vencedor',
    columns.map((column) => `${column[0].outcome}x${column.length}`),
    ['bancax2', 'jogadorx1', 'bancax1'],
  );
}

// --- Empate risca a célula anterior, não abre coluna ---
{
  const rounds = [r('banca'), r('empate'), r('banca')];
  const columns = service.buildBigRoad(rounds);
  check('Empate não abre coluna nova', columns.length, 1);
  check('Empate vira contador na célula anterior', columns[0][0].ties, 1);
  check('Sequência continua depois do empate', columns[0].length, 2);
}

// --- Empate antes de qualquer resultado não quebra ---
{
  const columns = service.buildBigRoad([r('empate'), r('banca')]);
  check('Empate na primeira rodada é ignorado sem quebrar', columns.length, 1);
}

// --- Cauda do dragão: 8 vitórias seguidas dobram à direita na linha 6 ---
{
  const rounds = Array.from({ length: 8 }, () => r('banca'));
  const layout = service.layoutBigRoad(service.buildBigRoad(rounds));
  check(
    'Cauda do dragão vira à direita ao passar de 6',
    layout.map((item) => `${item.column},${item.row}`),
    // 6 primeiras descem na coluna 0 (linhas 0..5), as 2 seguintes andam à direita na linha 5
    ['0,0', '0,1', '0,2', '0,3', '0,4', '0,5', '1,5', '2,5'],
  );
}

// --- Bead Plate: 6 por coluna, empate tem conta própria ---
{
  const rounds = Array.from({ length: 7 }, (_, i) => r(i === 3 ? 'empate' : 'banca'));
  const bead = service.buildBeadPlate(rounds);
  check('Bead Plate quebra a cada 6', [bead[0].length, bead[1].length], [6, 1]);
  check('Bead Plate mostra empate como conta própria', bead[0][3].outcome, 'empate');
}

// --- Big Eye Boy: só começa depois da 1ª entrada da 2ª coluna ---
{
  // banca, jogador -> a 2ª coluna acabou de abrir: ainda não marca nada
  check('Big Eye Boy não marca antes da hora', service.buildBigEyeBoy(service.buildBigRoad([r('banca'), r('jogador')])), []);
}

// --- Big Eye Boy: colunas de mesmo tamanho -> vermelho ---
{
  // B B | J J | B  -> na abertura da 3ª coluna, compara col.2 (len 2) com col.1 (len 2): iguais -> vermelho
  const rounds = [r('banca'), r('banca'), r('jogador'), r('jogador'), r('banca')];
  const marks = service.buildBigEyeBoy(service.buildBigRoad(rounds));
  check('Big Eye Boy: colunas de tamanho igual dão vermelho', marks[marks.length - 1], 'vermelho');
}

// --- Big Eye Boy: colunas de tamanho diferente -> azul ---
{
  // B B | J | B -> na abertura da 3ª coluna, compara col.2 (len 1) com col.1 (len 2): diferentes -> azul
  const rounds = [r('banca'), r('banca'), r('jogador'), r('banca')];
  const marks = service.buildBigEyeBoy(service.buildBigRoad(rounds));
  check('Big Eye Boy: colunas de tamanho diferente dão azul', marks[marks.length - 1], 'azul');
}

// --- Estradas derivadas começam progressivamente mais tarde ---
{
  const rounds = [r('banca'), r('jogador'), r('banca'), r('jogador'), r('banca'), r('jogador')];
  const columns = service.buildBigRoad(rounds);
  const eye = service.buildBigEyeBoy(columns).length;
  const small = service.buildSmallRoad(columns).length;
  const cockroach = service.buildCockroachPig(columns).length;
  check('Big Eye Boy começa antes da Small Road', eye > small, true);
  check('Small Road começa antes da Cockroach Pig', small > cockroach, true);
}

// --- build() devolve tudo junto e os totais batem ---
{
  const rounds = [r('banca'), r('jogador'), r('empate'), r('banca')];
  const built = service.build(rounds);
  check('Totais conferem', built.totals, { banca: 2, jogador: 1, empate: 1, total: 4 });
}

console.log(failures === 0 ? '\nTodas as verificações do placar passaram.' : `\n${failures} verificação(ões) falharam.`);
process.exit(failures === 0 ? 0 : 1);
