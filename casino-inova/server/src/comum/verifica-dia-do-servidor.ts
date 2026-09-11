import { diaDoMes, diaDoServidor, diaSeguinte, diasDoMes, diasEntre, mesDoDia } from './dia-do-servidor';

/**
 * Confere a régua do dia.
 *
 *   npx ts-node src/comum/verifica-dia-do-servidor.ts
 *
 * O que se confere aqui não é aritmética de data — é que a régua não encolhe. Um dia
 * com 23 horas, um fevereiro com 28 num ano de 29, ou uma virada de ano contada errado
 * quebram uma sequência de trinta dias que alguém levou um mês construindo.
 */
let problemas = 0;
const falhar = (m: string) => { problemas += 1; console.log(`FALHOU: ${m}`); };

// --- o dia não depende do fuso de quem pergunta ---
{
  // 3 de março de 2024, 23h30 em Brasília = 4 de março, 02h30 em UTC. O dia do jogo é 4.
  const instante = new Date('2024-03-04T02:30:00.000Z');
  const dia = diaDoServidor(instante);
  if (dia !== '2024-03-04') falhar(`o dia devia ser 2024-03-04 em UTC e veio ${dia}`);
  console.log(`23h30 de 3/mar em Brasília é o dia ${dia} do jogo — a virada é às 21h no Brasil, e isso vai escrito na tela`);

  // Um minuto antes da virada UTC ainda é o dia anterior.
  if (diaDoServidor(new Date('2024-03-03T23:59:59.999Z')) !== '2024-03-03') falhar('a virada da meia-noite UTC saiu do lugar');
}

// --- horário de verão não encolhe nem estica um dia ---
{
  /*
   * 17 de fevereiro de 2024 foi o fim do horário de verão em vários lugares do mundo.
   * Em UTC não existe esse dia de 23 ou 25 horas — todos têm 24. Esta conferência
   * percorre um ano inteiro hora a hora e exige que a diferença entre dias consecutivos
   * seja SEMPRE 1. Num fuso com horário de verão, isto daria 0 ou 2 em algum ponto.
   */
  let errados = 0;
  let anterior = diaDoServidor(new Date(Date.UTC(2024, 0, 1)));
  for (let h = 1; h <= 366 * 24; h += 1) {
    const hoje = diaDoServidor(new Date(Date.UTC(2024, 0, 1) + h * 3_600_000));
    if (hoje !== anterior) {
      if (diasEntre(anterior, hoje) !== 1) { errados += 1; falhar(`de ${anterior} pra ${hoje} deu ${diasEntre(anterior, hoje)} dia(s)`); }
      anterior = hoje;
    }
  }
  console.log(`um ano inteiro, hora a hora: toda virada de dia andou exatamente 1 dia (${errados} erros)`);
}

// --- fevereiro, ano bissexto e virada de ano ---
{
  const casos: Array<[string, number]> = [
    ['2024-02-10', 29], // bissexto
    ['2023-02-10', 28],
    ['2000-02-10', 29], // século divisível por 400 É bissexto
    ['2100-02-10', 28], // século não divisível por 400 NÃO é
    ['2025-01-15', 31],
    ['2025-04-15', 30],
  ];
  for (const [dia, esperado] of casos) {
    const tem = diasDoMes(dia);
    if (tem !== esperado) falhar(`${dia}: mês de ${tem} dias, esperado ${esperado}`);
  }
  console.log('fevereiro: 2024 tem 29, 2023 tem 28, 2000 tem 29 e 2100 tem 28 — a regra dos séculos está certa');

  if (diaSeguinte('2024-02-28') !== '2024-02-29') falhar('29 de fevereiro de 2024 sumiu');
  if (diaSeguinte('2023-02-28') !== '2023-03-01') falhar('fevereiro de 2023 ganhou um dia 29');
  if (diaSeguinte('2024-12-31') !== '2025-01-01') falhar('a virada de ano não virou');
  if (diasEntre('2024-12-31', '2025-01-01') !== 1) falhar('a virada de ano não conta como um dia');
  console.log('virada de ano e 29 de fevereiro: um dia cada, sem buraco e sem dia inventado');
}

// --- diferença de dias, nos dois sentidos ---
{
  if (diasEntre('2024-03-01', '2024-03-01') !== 0) falhar('o mesmo dia devia dar zero');
  if (diasEntre('2024-03-01', '2024-02-29') !== -1) falhar('ontem devia dar -1');
  if (diasEntre('2024-01-01', '2024-12-31') !== 365) falhar('2024 devia ter 366 dias (365 de intervalo)');
  if (Number.isFinite(diasEntre('nao-e-data', '2024-01-01'))) falhar('data inválida devia dar NaN, e não um número qualquer');
  console.log('diferença de dias: zero, negativa, um ano bissexto inteiro e data inválida — todas certas');
}

// --- mês e dia do mês, que é o que o calendário da recompensa desenha ---
{
  if (diaDoMes('2024-02-29') !== 29) falhar('dia do mês errado');
  if (mesDoDia('2024-02-29') !== '2024-02') falhar('mês errado');
  if (mesDoDia('2024-02-29') === mesDoDia('2024-03-01')) falhar('fevereiro e março deram o mesmo mês');
  console.log('dia do mês e mês: o calendário sabe quando o mês virou');
}

console.log(problemas === 0 ? '\nTUDO OK — uma régua só, de 24 horas, igual pra todo mundo.' : `\n${problemas} PROBLEMA(S).`);
process.exit(problemas === 0 ? 0 : 1);
