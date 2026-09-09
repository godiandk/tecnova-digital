import { randomUUID } from 'node:crypto';

import { DatabaseService } from '../../../database/database.service';
import { RodadasRepository } from './rodadas.repository';
import { VERSAO_DO_PROTOCOLO, versaoDaRegra } from './versoes';

/**
 * DÁ PRA RESPONDER "O QUE ACONTECEU NESTA RODADA?" SÓ COM O BANCO?
 *
 *   DATABASE_URL=...casino_inova_test npx ts-node src/modules/games/core/verifica-replay.ts
 *
 * Esta é a conferência que justifica as duas tabelas existirem. Ela joga uma rodada
 * inteira, JOGA FORA TUDO QUE ESTÁ EM MEMÓRIA, reconstrói a rodada lendo só o Postgres,
 * e compara. Se a reconstrução não bater, as tabelas não servem pra auditoria — servem
 * pra ocupar disco.
 *
 * Depois ela simula o servidor caindo no meio da rodada e voltando, que é o caso em que
 * um sistema mal feito faz o pior estrago possível: inventa uma rodada nova por cima de
 * apostas que já existem, ou paga duas vezes.
 *
 * Não usa o Nest: instancia o repositório direto contra o banco de teste. É de propósito
 * — o que está sendo conferido é o que o Postgres guarda, não a fiação do framework.
 */

let falhas = 0;
const ok = (m: string) => console.log(`ok    ${m}`);
const falhar = (m: string) => {
  falhas += 1;
  console.log(`FALHOU: ${m}`);
};
/**
 * Igualdade ESTRUTURAL, e não por texto.
 *
 * A primeira versão desta conferência comparava com `JSON.stringify`, e reprovou três
 * vezes com os dados certos. O motivo é uma propriedade do JSONB que vale a pena não
 * esquecer: **ele não guarda o texto que você mandou, guarda a estrutura**. Na volta, as
 * chaves vêm reordenadas (o Postgres ordena por tamanho e depois alfabeticamente),
 * espaço em branco some e chave repetida colapsa.
 *
 * `{ apostado: 700, risco: 600 }` volta como `{ risco: 600, apostado: 700 }` — o mesmo
 * objeto, texto diferente. Então comparar JSONB por texto reprova sempre, e — pior —
 * qualquer código que um dia dependa da ORDEM das chaves de um payload vai quebrar em
 * silêncio. Aqui a comparação é estrutural, e a lição fica escrita.
 */
function igual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => igual(item, b[i]));
  }
  if (typeof a !== 'object') return false;
  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  const chaves = Object.keys(x);
  if (chaves.length !== Object.keys(y).length) return false;
  return chaves.every((k) => Object.prototype.hasOwnProperty.call(y, k) && igual(x[k], y[k]));
}

async function principal() {
  const db = new DatabaseService();
  await db.onModuleInit();
  const rodadas = new RodadasRepository(db);

  /*
   * Um jogador de mentira, só pra as chaves estrangeiras fecharem.
   *
   * Sem e-mail e sem saldo de propósito: e-mail mora em `credentials` e saldo é a soma
   * do extrato. Esta conferência não é sobre carteira — é sobre a rodada ser
   * reconstruível — e inventar colunas que a tabela não tem só esconderia isso.
   */
  const usuarioId = `u-replay-${randomUUID()}`;
  await db.query(
    `INSERT INTO users (id, name) VALUES ($1, 'Conferência do replay') ON CONFLICT (id) DO NOTHING`,
    [usuarioId],
  );

  /* ------------------------------------------------------------------ *
   * 1. Uma rodada inteira, do jeito que a Banca Francesa faz.
   * ------------------------------------------------------------------ */
  const rodadaId = randomUUID();
  await rodadas.abrir({ id: rodadaId, jogo: 'banca-francesa', mesa: null, estado: 'APOSTAS_ABERTAS' });

  const apostas = [
    { casa: 'grande', valor: 500 },
    { casa: 'linha-pequeno', valor: 200 },
  ];
  await rodadas.anotar(rodadaId, { tipo: 'APOSTAS_CONFIRMADAS', usuarioId, dados: { apostas } });
  await rodadas.mudarEstado(rodadaId, 'APOSTAS_FECHADAS', { apostasFechadas: true });

  /* Dois nulos antes de decidir — é o caminho que mais quebra implementação. */
  const nulos = [
    { rollId: randomUUID(), dados: [2, 3, 4], soma: 9 },
    { rollId: randomUUID(), dados: [6, 3, 2], soma: 11 },
  ];
  for (const nulo of nulos) {
    await rodadas.anotar(rodadaId, { tipo: 'LANCAMENTO_NULO', usuarioId, dados: nulo });
    await rodadas.mudarEstado(rodadaId, 'APOSTAS_ABERTAS');
  }

  const decisivo = { rollId: randomUUID(), dados: [5, 5, 5], soma: 15, resultado: 'grande' };
  await rodadas.anotar(rodadaId, { tipo: 'LANCAMENTO_DECISIVO', usuarioId, dados: decisivo });
  const liquidacao = {
    apostado: 700,
    risco: 600,
    retorno: 1300,
    porCasa: [
      { casa: 'grande', valor: 500, ganhou: true, retorno: 1000 },
      { casa: 'linha-pequeno', valor: 200, ganhou: false, retorno: 100 },
    ],
  };
  await rodadas.anotar(rodadaId, { tipo: 'LIQUIDADA', usuarioId, dados: liquidacao });
  await rodadas.mudarEstado(rodadaId, 'RODADA_FECHADA', {
    decidida: true,
    fechada: true,
    resultado: { dados: decisivo.dados, soma: decisivo.soma, resultado: decisivo.resultado },
  });

  /* ------------------------------------------------------------------ *
   * 2. Joga a memória fora e reconstrói só do banco.
   * ------------------------------------------------------------------ */
  const reconstruida = await rodadas.reconstruir(rodadaId);
  if (!reconstruida) {
    falhar('a rodada não foi encontrada no banco — não há o que conferir');
    process.exit(1);
  }

  const { rodada, eventos } = reconstruida;
  rodada.id === rodadaId ? ok('a rodada foi achada pelo id') : falhar('id diferente');
  rodada.jogo === 'banca-francesa' ? ok('o jogo está gravado') : falhar(`jogo ${rodada.jogo}`);
  rodada.estado === 'RODADA_FECHADA'
    ? ok('o estado final está gravado')
    : falhar(`estado final ${rodada.estado}`);

  rodada.versaoDaRegra === versaoDaRegra('banca-francesa')
    ? ok(`a versão da regra ficou gravada (${rodada.versaoDaRegra}) — daqui a seis meses ainda dá pra saber com qual regra esta rodada foi decidida`)
    : falhar(`versão da regra ${rodada.versaoDaRegra}`);
  rodada.versaoDoProtocolo === VERSAO_DO_PROTOCOLO
    ? ok(`a versão do protocolo ficou gravada (${rodada.versaoDoProtocolo})`)
    : falhar(`versão do protocolo ${rodada.versaoDoProtocolo}`);

  igual(rodada.resultado, { dados: [5, 5, 5], soma: 15, resultado: 'grande' })
    ? ok('o resultado reconstruído é idêntico ao original')
    : falhar(`resultado ${JSON.stringify(rodada.resultado)}`);

  /* ------------------------------------------------------------------ *
   * 3. Os eventos, e a ORDEM deles.
   * ------------------------------------------------------------------ */
  const tiposEsperados = [
    'APOSTAS_CONFIRMADAS',
    'LANCAMENTO_NULO',
    'LANCAMENTO_NULO',
    'LANCAMENTO_DECISIVO',
    'LIQUIDADA',
  ];
  igual(eventos.map((e) => e.tipo), tiposEsperados)
    ? ok(`os ${eventos.length} eventos voltaram na ordem exata em que aconteceram`)
    : falhar(`ordem dos eventos: ${eventos.map((e) => e.tipo).join(' -> ')}`);

  const seqs = eventos.map((e) => e.seq);
  igual(seqs, [1, 2, 3, 4, 5])
    ? ok('a sequência é 1, 2, 3, 4, 5 — sem buraco e sem repetição')
    : falhar(`sequência ${seqs.join(', ')}`);

  /* ------------------------------------------------------------------ *
   * 4. O dinheiro.
   * ------------------------------------------------------------------ */
  const liquidada = eventos.find((e) => e.tipo === 'LIQUIDADA');
  igual(liquidada?.dados, liquidacao)
    ? ok('o dinheiro reconstruído é idêntico: apostado 700, risco 600, retorno 1.300')
    : falhar(`liquidação reconstruída ${JSON.stringify(liquidada?.dados)}`);

  const confirmadas = eventos.find((e) => e.tipo === 'APOSTAS_CONFIRMADAS');
  igual((confirmadas?.dados as { apostas: unknown }).apostas, apostas)
    ? ok('as apostas reconstruídas são idênticas às originais')
    : falhar(`apostas ${JSON.stringify(confirmadas?.dados)}`);

  const nulosLidos = eventos.filter((e) => e.tipo === 'LANCAMENTO_NULO');
  igual(nulosLidos.map((e) => e.dados), nulos)
    ? ok('os dois lançamentos nulos estão lá, com os dados que saíram')
    : falhar('os lançamentos nulos não bateram');

  /* ------------------------------------------------------------------ *
   * 5. Privacidade: só entra o que precisa.
   * ------------------------------------------------------------------ */
  const tudo = JSON.stringify(eventos);
  const proibido = ['@', 'senha', 'token', 'password', 'authorization', 'bearer', 'cookie'];
  const achado = proibido.filter((termo) => tudo.toLowerCase().includes(termo.toLowerCase()));
  achado.length === 0
    ? ok('nenhum dado sensível foi parar no log de eventos')
    : falhar(`o log guardou o que não devia: ${achado.join(', ')}`);

  /* ------------------------------------------------------------------ *
   * 6. A ORDEM SOBREVIVE À CONCORRÊNCIA.
   *
   * Dez eventos gravados ao mesmo tempo, por conexões diferentes. Se `seq` fosse um
   * contador em memória, ou saísse de um `SELECT MAX` sem trava, dois pegariam o mesmo
   * número — e a chave primária recusaria um deles, perdendo o evento.
   * ------------------------------------------------------------------ */
  const rodadaConcorrente = randomUUID();
  await rodadas.abrir({ id: rodadaConcorrente, jogo: 'banca-francesa', estado: 'APOSTAS_ABERTAS' });
  const numeros = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      rodadas.anotar(rodadaConcorrente, { tipo: 'TESTE', dados: { i } }),
    ),
  );
  const ordenados = [...numeros].sort((a, b) => a - b);
  igual(ordenados, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    ? ok('dez gravações ao mesmo tempo tiraram dez números diferentes, de 1 a 10')
    : falhar(`números concorrentes: ${ordenados.join(', ')}`);

  /* ------------------------------------------------------------------ *
   * 7. O SERVIDOR CAIU NO MEIO. Ele volta e não pode inventar nada.
   * ------------------------------------------------------------------ */
  const presa = randomUUID();
  await rodadas.abrir({ id: presa, jogo: 'banca-francesa', estado: 'APOSTAS_ABERTAS' });
  await rodadas.anotar(presa, { tipo: 'APOSTAS_CONFIRMADAS', usuarioId, dados: { apostas } });
  await rodadas.mudarEstado(presa, 'APOSTAS_FECHADAS', { apostasFechadas: true });
  /* --- aqui o processo morre --- */

  const abertas = await rodadas.abertas('banca-francesa');
  const achou = abertas.find((r) => r.id === presa);
  achou
    ? ok('depois do reinício, a rodada presa aparece na lista das que não fecharam')
    : falhar('a rodada presa sumiu — o servidor voltaria sem saber que ela existe');
  achou?.estado === 'APOSTAS_FECHADAS'
    ? ok(`e ela volta na fase em que parou (${achou.estado}), não numa fase inventada`)
    : falhar(`voltou em ${achou?.estado}`);
  achou?.fechadaEm === null
    ? ok('ela não está marcada como fechada — porque não foi')
    : falhar('a rodada presa apareceu como fechada');

  /* Reabrir a MESMA rodada não pode criar uma segunda nem apagar a primeira. */
  await rodadas.abrir({ id: presa, jogo: 'banca-francesa', estado: 'APOSTAS_ABERTAS' });
  const depoisDeReabrir = await rodadas.reconstruir(presa);
  depoisDeReabrir?.rodada.estado === 'APOSTAS_FECHADAS' && depoisDeReabrir.eventos.length === 1
    ? ok('reabrir a mesma rodada não inventou outra nem apagou o que já estava lá')
    : falhar(
        `reabrir estragou a rodada: estado ${depoisDeReabrir?.rodada.estado}, ` +
          `${depoisDeReabrir?.eventos.length} evento(s)`,
      );

  /* E a liquidação, se chegar duas vezes, não pode virar dois pagamentos no registro. */
  await rodadas.anotar(presa, { tipo: 'LIQUIDADA', usuarioId, dados: liquidacao });
  await rodadas.mudarEstado(presa, 'RODADA_FECHADA', { decidida: true, fechada: true });
  const primeiraVez = await rodadas.reconstruir(presa);
  await rodadas.mudarEstado(presa, 'RODADA_FECHADA', { decidida: true, fechada: true });
  const segundaVez = await rodadas.reconstruir(presa);
  primeiraVez?.rodada.fechadaEm === segundaVez?.rodada.fechadaEm
    ? ok('fechar duas vezes não move a hora do fechamento — o primeiro carimbo é o que vale')
    : falhar('o carimbo de fechamento foi reescrito na segunda vez');
  segundaVez?.eventos.filter((e) => e.tipo === 'LIQUIDADA').length === 1
    ? ok('e há uma liquidação registrada, não duas')
    : falhar('apareceu mais de uma liquidação');

  /* --- limpeza: a conferência não deixa lixo na base --- */
  await db.query('DELETE FROM rodadas WHERE id = ANY($1)', [[rodadaId, rodadaConcorrente, presa]]);
  await db.query('DELETE FROM users WHERE id = $1', [usuarioId]);
  await db.onModuleDestroy();

  console.log(
    falhas === 0
      ? '\nOK: uma rodada antiga pode ser reconstruída inteira, só com o banco.'
      : `\n${falhas} PROBLEMA(S)`,
  );
  process.exit(falhas === 0 ? 0 : 1);
}

principal().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
