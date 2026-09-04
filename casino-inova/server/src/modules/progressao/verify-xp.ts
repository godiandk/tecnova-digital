import { XP_MAXIMO_POR_RODADA, somarXp, xpDaRodada, xpDoNivel } from './niveis';

/**
 * Confere a barra de nível.
 *
 *   npx ts-node src/modules/progressao/verify-xp.ts
 *
 * As perguntas que importam não são "a conta soma": são se a barra empurra alguém pra
 * algum lugar. Um sistema de nível é uma alavanca — ele diz, sem falar, o que o jogo
 * quer que você faça. Então:
 *
 * 1. Ganhar e perder valem EXATAMENTE o mesmo. A barra não pode andar mais devagar pra
 *    quem está perdendo (empurrão pra continuar caçando o prejuízo) nem mais rápido
 *    (jogo que recompensa perder).
 * 2. Apostar 100 vezes mais não dá 100 vezes mais XP. Se desse, a barra viraria um
 *    cartaz dizendo "aposte alto".
 * 3. Quem joga pequeno anda. Uma barra que só se mexe com aposta grande é uma barra que
 *    exclui quem está jogando com pouco.
 * 4. Subir de nível não perde nem inventa XP.
 */
let problemas = 0;
const falhar = (m: string) => { problemas += 1; console.log(`FALHOU: ${m}`); };

// --- 1. o resultado da rodada não entra na conta ---
{
  // `xpDaRodada` recebe só o apostado — não existe parâmetro de resultado pra passar.
  // A prova aqui é que a mesma aposta dá o mesmo XP, e o teste do funil (recordRound)
  // é quem garante que ninguém passa o retorno por engano.
  const apostado = 500;
  if (xpDaRodada(apostado) !== xpDaRodada(apostado)) falhar('a mesma aposta deu XP diferente');
  if (xpDaRodada(0) !== 0) falhar('aposta zero devia dar zero XP');
  if (xpDaRodada(-100) !== 0) falhar('aposta negativa devia dar zero XP');
  if (xpDaRodada(Number.NaN) !== 0) falhar('aposta inválida devia dar zero XP');
  console.log('resultado: o XP sai só do apostado — ganhar e perder valem igual — ok');
}

// --- 2. apostar muito mais não dá muito mais ---
{
  const pequeno = xpDaRodada(100);
  const cem_vezes = xpDaRodada(10_000);
  const razao = cem_vezes / pequeno;
  console.log(`\naposta 100 -> ${pequeno} XP;  aposta 10.000 (100x) -> ${cem_vezes} XP  (${razao.toFixed(1)}x)`);
  if (razao > 15) falhar(`apostar 100x mais deu ${razao.toFixed(1)}x mais XP — a barra estaria empurrando pra apostar alto`);

  const absurdo = xpDaRodada(1_000_000_000);
  if (absurdo !== XP_MAXIMO_POR_RODADA) falhar(`aposta absurda deu ${absurdo} XP, o teto é ${XP_MAXIMO_POR_RODADA}`);
  console.log(`  aposta de 1 bilhão -> ${absurdo} XP (o teto). Passando daqui, apostar mais não anda com a barra.`);
}

// --- 3. quem joga pequeno anda ---
{
  const minimo = xpDaRodada(50); // o mínimo da mesa Bronze
  if (minimo < 1) falhar('a aposta mínima não dá XP nenhum — quem joga pequeno ficaria parado');
  let nivel = 1, xp = 0, rodadas = 0;
  while (nivel === 1 && rodadas < 100_000) { const p = somarXp(nivel, xp, minimo); nivel = p.level; xp = p.xp; rodadas += 1; }
  console.log(`\njogando sempre o mínimo (50 fichas): ${minimo} XP por rodada, nível 2 em ${rodadas} rodadas`);
  if (rodadas > 500) falhar(`${rodadas} rodadas no mínimo pra subir um nível — longe demais pra a barra significar alguma coisa`);

  let n2 = 1, x2 = 0, r2 = 0;
  while (n2 === 1 && r2 < 100_000) { const p = somarXp(n2, x2, xpDaRodada(500)); n2 = p.level; x2 = p.xp; r2 += 1; }
  console.log(`  jogando 500 por rodada: ${xpDaRodada(500)} XP por rodada, nível 2 em ${r2} rodadas`);
}

// --- 4. subir de nível não perde nem inventa XP ---
{
  let nivel = 1, xp = 0, somado = 0;
  for (let i = 0; i < 20_000; i += 1) {
    const ganho = xpDaRodada(50 + (i % 97) * 40);
    somado += ganho;
    const p = somarXp(nivel, xp, ganho);
    if (p.xp < 0) falhar('XP ficou negativo depois de subir de nível');
    if (p.xp >= xpDoNivel(p.level)) falhar(`sobrou XP acima do exigido: ${p.xp} de ${xpDoNivel(p.level)} no nível ${p.level}`);
    nivel = p.level; xp = p.xp;
  }
  // Tudo que foi somado ou virou nível, ou está sobrando na barra.
  let gasto = 0;
  for (let n = 1; n < nivel; n += 1) gasto += xpDoNivel(n);
  const conferido = gasto + xp;
  console.log(`\n20.000 rodadas: ${somado.toLocaleString('pt-BR')} XP ganhos -> nível ${nivel}, com ${xp} na barra`);
  console.log(`  conferindo: ${gasto.toLocaleString('pt-BR')} gastos em níveis + ${xp} na barra = ${conferido.toLocaleString('pt-BR')}`);
  if (conferido !== somado) falhar(`sumiram ${somado - conferido} XP no caminho`);
}

// --- 5. uma rodada gigante não joga ninguém pro nível 900 ---
{
  const p = somarXp(1, 0, 10_000_000);
  console.log(`\numa rodada com 10 milhões de XP levaria ao nível ${p.level} (subiu ${p.subiuNiveis})`);
  if (p.level > 120) falhar(`nível ${p.level} de uma vez — a trava de segurança não segurou`);
}

console.log(problemas === 0 ? '\nTUDO OK — a barra anda, e não empurra ninguém.' : `\n${problemas} PROBLEMA(S).`);
process.exit(problemas === 0 ? 0 : 1);
