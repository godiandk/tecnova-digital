import { IDADE_MINIMA, idadeEm, lerNascimento } from './idade';

/**
 * Confere a porta dos 18 anos.
 *
 *   npx ts-node src/modules/legal/verifica-idade.ts
 *
 * A conta de idade parece trivial e não é: ela erra em dois lugares clássicos, e os dois
 * mudam a resposta pra pessoas de verdade.
 *
 * 1. O ANIVERSÁRIO DE HOJE. Quem faz 18 hoje TEM 18 — a conta não pode tirar um ano
 *    porque o mês e o dia empataram.
 * 2. O DIA ANTERIOR AO ANIVERSÁRIO. Quem faz 18 amanhã ainda tem 17, e a conta não pode
 *    arredondar pra cima.
 *
 * E as datas que não existem: 31 de fevereiro vira 3 de março em quase toda linguagem,
 * silenciosamente. Aceitar isso guardaria uma data que a pessoa não digitou.
 */
let problemas = 0;
const falhar = (m: string) => { problemas += 1; console.log(`FALHOU: ${m}`); };

const dia = (s: string) => new Date(`${s}T00:00:00.000Z`);

// --- 1. a conta de anos, nos dias que costumam quebrar ---
{
  const casos: Array<[string, string, number]> = [
    ['1990-06-15', '2026-06-15', 36], // aniversário HOJE
    ['1990-06-15', '2026-06-14', 35], // um dia antes
    ['1990-06-15', '2026-06-16', 36], // um dia depois
    ['2008-09-04', '2026-09-04', 18], // faz 18 exatamente hoje
    ['2008-09-05', '2026-09-04', 17], // faz 18 amanhã
    ['2004-02-29', '2026-02-28', 21], // nasceu em 29 de fevereiro, ano sem 29
    ['2004-02-29', '2026-03-01', 22],
    ['2000-01-01', '2026-12-31', 26],
  ];
  for (const [nascimento, hoje, esperado] of casos) {
    const anos = idadeEm(dia(nascimento), dia(hoje));
    if (anos !== esperado) falhar(`nasceu ${nascimento}, hoje ${hoje}: deu ${anos}, esperava ${esperado}`);
  }
  console.log('idade: aniversário de hoje, véspera e 29 de fevereiro — todos certos — ok');
}

// --- 2. quem passa e quem não passa ---
{
  const hoje = new Date();
  const anosAtras = (n: number) => {
    const d = new Date(Date.UTC(hoje.getUTCFullYear() - n, hoje.getUTCMonth(), hoje.getUTCDate()));
    return d.toISOString().slice(0, 10);
  };

  const passa = lerNascimento(anosAtras(IDADE_MINIMA));
  if ('erro' in passa) falhar(`quem faz ${IDADE_MINIMA} hoje foi recusado: ${passa.erro}`);
  else console.log(`\nquem completa ${IDADE_MINIMA} anos HOJE entra — ok`);

  const naoPassa = lerNascimento(anosAtras(IDADE_MINIMA - 1));
  if (!('erro' in naoPassa)) falhar(`quem tem ${IDADE_MINIMA - 1} anos foi aceito`);
  else console.log(`quem tem ${IDADE_MINIMA - 1} anos é recusado: "${naoPassa.erro}" — ok`);

  const crianca = lerNascimento(anosAtras(9));
  if (!('erro' in crianca)) falhar('uma criança de 9 anos foi aceita');
}

// --- 3. o que não é data ---
{
  const lixo = ['', '  ', 'ontem', '15/06/1990', '1990-6-15', '1990-13-01', '1990-02-31', '3000-01-01', null, 42, {}];
  for (const valor of lixo) {
    const r = lerNascimento(valor as unknown);
    if (!('erro' in r)) falhar(`aceitou "${JSON.stringify(valor)}" como data de nascimento`);
  }
  console.log('\nlixo, formato brasileiro, mês 13, 31 de fevereiro e data no futuro — todos recusados — ok');

  // 31 de fevereiro é o caso traiçoeiro: quase toda linguagem transforma em 3 de março.
  const fevereiro31 = lerNascimento('1990-02-31');
  if (!('erro' in fevereiro31)) falhar('31 de fevereiro passou — a data virou 3 de março em silêncio');
}

console.log(problemas === 0 ? '\nTUDO OK — a porta dos 18 anos fecha onde deve.' : `\n${problemas} PROBLEMA(S).`);
process.exit(problemas === 0 ? 0 : 1);
