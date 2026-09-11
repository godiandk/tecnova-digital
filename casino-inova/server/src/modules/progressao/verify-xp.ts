import {
  NIVEL_MAXIMO,
  R_DE_REFERENCIA,
  XP_MAXIMO_POR_DIA,
  XP_MAXIMO_POR_RODADA,
  XP_NA_FICHA_MAIOR,
  somarXp,
  xpDaRodada,
  xpDoNivel,
} from './niveis';
import { NIVEIS_DE_MESA } from '../games/shared/niveis-de-mesa';

/**
 * Confere a barra de nível.
 *
 *   npx ts-node src/modules/progressao/verify-xp.ts
 *
 * As perguntas que importam não são "a conta soma": são se a barra empurra alguém pra
 * algum lugar. Um sistema de nível é uma alavanca — ele diz, sem falar, o que o jogo
 * quer que você faça. Então, em ordem de gravidade:
 *
 * 1. NÍVEL NÃO SE COMPRA. Quem gastou dinheiro e subiu de mesa não ganha XP mais rápido
 *    do que quem joga na mesa de entrada. Esta é a primeira conferência porque é a única
 *    cuja falha transformaria a barra num placar de quanto a pessoa pagou.
 * 2. Ganhar e perder valem EXATAMENTE o mesmo. A barra não pode andar mais devagar pra
 *    quem está perdendo (empurrão pra continuar caçando o prejuízo) nem mais rápido
 *    (jogo que recompensa perder).
 * 3. Apostar o mínimo não pode ser estratégia dominante — e nem apostar o teto.
 * 4. O teto diário fecha a porta do robô: quem tem tempo infinito não chega mais longe.
 * 5. Subir de nível não perde nem inventa XP, e nenhuma rodada compra um nível.
 * 6. O nível 10.000 é alcançável por quem joga muito, e não por quem joga um pouco.
 */
let problemas = 0;
const falhar = (m: string) => { problemas += 1; console.log(`FALHOU: ${m}`); };

const BRONZE = NIVEIS_DE_MESA[0].minimo;      // 50
const ECLIPSE = NIVEIS_DE_MESA[11].minimo;    // 5 quatrilhões

// --- 1. nível não se compra: a mesma aposta RELATIVA vale o mesmo em todo degrau ---
{
  console.log('1. NÍVEL NÃO SE COMPRA');
  let divergiu = 0;
  for (const multiplo of [1, 2, 5, 10, 20]) {
    const valores = NIVEIS_DE_MESA.map((n) => xpDaRodada(n.minimo * multiplo, n.minimo));
    const primeiro = valores[0];
    if (valores.some((v) => v !== primeiro)) {
      divergiu += 1;
      falhar(`apostar ${multiplo}x o mínimo deu XP diferente conforme o degrau: ${valores.join(', ')}`);
    }
  }
  if (divergiu === 0) {
    console.log(`   as 5 fichas do trilho valem o mesmo XP nos 12 degraus (${xpDaRodada(BRONZE, BRONZE)} a ${xpDaRodada(BRONZE * 20, BRONZE)} XP)`);
  }

  /*
   * A prova com número absurdo: o Eclipse aposta 5 quatrilhões de fichas — cem trilhões
   * de vezes o que o Bronze aposta — e a barra dos dois anda igual.
   */
  const bronze = xpDaRodada(BRONZE, BRONZE);
  const eclipse = xpDaRodada(ECLIPSE, ECLIPSE);
  if (bronze !== eclipse) falhar(`Bronze no mínimo deu ${bronze} XP e Eclipse no mínimo deu ${eclipse}`);
  console.log(`   Bronze apostando ${BRONZE} fichas: ${bronze} XP. Eclipse apostando ${ECLIPSE.toLocaleString('pt-BR')}: ${eclipse} XP. Iguais.`);

  /*
   * O ATALHO QUE ISTO FECHA, dito de frente. Se o divisor fosse o mínimo DA MESA em que
   * a pessoa sentou (e não o do degrau dela), quem pode descer um degrau apostaria as
   * mesmas fichas na mesa dez vezes mais barata e a barra andaria muito mais.
   */
  const naMinhaMesa = xpDaRodada(NIVEIS_DE_MESA[2].minimo * 2, NIVEIS_DE_MESA[2].minimo);
  const umDegrauAbaixo = xpDaRodada(NIVEIS_DE_MESA[2].minimo * 2, NIVEIS_DE_MESA[1].minimo);
  console.log(`   [o atalho] as mesmas fichas medidas pelo degrau de baixo dariam ${umDegrauAbaixo} XP em vez de ${naMinhaMesa}`);
  if (umDegrauAbaixo <= naMinhaMesa) {
    falhar('o atalho do degrau de baixo não existe mais na fórmula — esta conferência ficou sem sentido e precisa ser revista');
  }
  /*
   * QUEM GARANTE QUE A CHAMADA PASSA O NÚMERO CERTO, já que isto aqui só prova a fórmula:
   *   - o compilador garante que o número EXISTE — `recordRound` exige o saldo de antes,
   *     sem valor padrão, então um jogo novo que o esqueça não compila;
   *   - `verify-tournaments` prova o caminho inteiro rodando contra o banco: os dez jogos
   *     passam por `recordRound`, e lá o Bronze e o degrau alto ganham o mesmo XP;
   *   - e o guarda em `somarExperienciaDaRodada` pega em produção o número que não se
   *     sustenta (saldo menor que a própria aposta), pagando o piso e registrando aviso.
   */
  console.log('   por isso quem chama passa o mínimo do DEGRAU DA PESSOA, nunca o da mesa.');
}

// --- 2. o resultado da rodada não entra na conta ---
{
  console.log('\n2. GANHAR E PERDER VALEM IGUAL');
  // `xpDaRodada` não tem parâmetro de resultado pra passar — a prova é estrutural.
  if (xpDaRodada.length !== 2) falhar(`xpDaRodada recebe ${xpDaRodada.length} argumentos; se um deles for o resultado, a barra premia ganhar`);
  if (xpDaRodada(500, BRONZE) !== xpDaRodada(500, BRONZE)) falhar('a mesma aposta deu XP diferente');
  for (const [apostado, porque] of [[0, 'zero'], [-100, 'negativa'], [Number.NaN, 'inválida'], [Infinity, 'infinita']] as const) {
    if (xpDaRodada(apostado, BRONZE) !== 0) falhar(`aposta ${porque} devia dar zero XP`);
  }
  for (const [minimo, porque] of [[0, 'zero'], [-50, 'negativo'], [Number.NaN, 'inválido']] as const) {
    if (xpDaRodada(500, minimo) !== 0) falhar(`mínimo ${porque} devia dar zero XP em vez de conta impossível`);
  }
  console.log('   o XP sai só do apostado e do degrau — nenhum caminho passa o retorno');
}

// --- 3. nem o mínimo nem o teto são estratégia dominante ---
{
  console.log('\n3. NENHUMA APOSTA É DOMINANTE');
  const noMinimo = xpDaRodada(BRONZE, BRONZE);
  const naFichaMaior = xpDaRodada(BRONZE * R_DE_REFERENCIA, BRONZE);

  // Por RODADA a ficha maior ganha — senão a barra seria um cartaz dizendo "aposte o mínimo".
  console.log(`   por rodada: mínimo ${noMinimo} XP,  ficha maior ${naFichaMaior} XP  (${(naFichaMaior / noMinimo).toFixed(1)}x)`);
  if (naFichaMaior <= noMinimo) falhar('apostar a ficha maior não rende mais por rodada — apostar o mínimo seria dominante');
  if (naFichaMaior !== XP_NA_FICHA_MAIOR) falhar(`a ficha maior devia valer ${XP_NA_FICHA_MAIOR} XP e valeu ${naFichaMaior} — a âncora da curva saiu do lugar`);

  /*
   * Por FICHA o mínimo ainda rende mais — é matemática, não escolha: toda função côncava
   * tem retorno por unidade decrescente. O que se confere é que a vantagem é PEQUENA.
   * A fórmula antiga (`1 + raiz(aposta/10)`) dava 29x, e aí apostar o mínimo era melhor
   * nos dois eixos ao mesmo tempo — a definição de estratégia dominante.
   */
  const vantagem = (noMinimo / 1) / (naFichaMaior / R_DE_REFERENCIA);
  console.log(`   por ficha: o mínimo rende ${vantagem.toFixed(1)}x mais que a ficha maior (a fórmula antiga dava 29x)`);
  if (vantagem > 5) falhar(`vantagem de ${vantagem.toFixed(1)}x por ficha pro mínimo — perto demais de dominante`);

  // E quem joga pequeno anda: a aposta mínima não pode valer zero.
  if (noMinimo < 1) falhar('a aposta mínima não dá XP nenhum — quem joga com pouco ficaria parado');

  const absurdo = xpDaRodada(BRONZE * 1_000_000_000, BRONZE);
  if (absurdo !== XP_MAXIMO_POR_RODADA) falhar(`aposta absurda deu ${absurdo} XP, o teto é ${XP_MAXIMO_POR_RODADA}`);
  console.log(`   apostar um bilhão de vezes o mínimo dá ${absurdo} XP — o teto. Daí pra cima, apostar mais não anda com a barra.`);
}

// --- 4. o teto diário fecha a porta do robô ---
{
  console.log('\n4. O TETO DIÁRIO');
  const porRodada = (m: number) => xpDaRodada(BRONZE * m, BRONZE);
  const rodadasAteOTeto = (m: number) => Math.ceil(XP_MAXIMO_POR_DIA / porRodada(m));
  const roboNoMinimo = rodadasAteOTeto(1);
  const humanoNaMaior = rodadasAteOTeto(R_DE_REFERENCIA);
  console.log(`   apostando o mínimo: ${roboNoMinimo.toLocaleString('pt-BR')} rodadas até o teto de ${XP_MAXIMO_POR_DIA.toLocaleString('pt-BR')} XP`);
  console.log(`   apostando a ficha maior: ${humanoNaMaior.toLocaleString('pt-BR')} rodadas`);
  console.log('   os dois param no MESMO lugar: o robô economiza ficha e não sobe de nível mais rápido.');
  if (roboNoMinimo < 1_000) falhar(`${roboNoMinimo} rodadas no mínimo chegam ao teto — barato demais pra automação`);

  // O teto tem que ser maior que um dia de jogo humano, ou ele viraria multa pra quem joga.
  const duasHorasNaMaior = 2 * 60 * 10 * porRodada(R_DE_REFERENCIA); // ~10 rodadas por minuto
  if (XP_MAXIMO_POR_DIA < duasHorasNaMaior) {
    falhar(`o teto (${XP_MAXIMO_POR_DIA}) é menor que duas horas de jogo (${duasHorasNaMaior}) — puniria quem joga muito`);
  }
  console.log(`   duas horas de jogo na ficha maior dão ~${duasHorasNaMaior.toLocaleString('pt-BR')} XP: o teto só aperta depois disso.`);
}

// --- 5. subir de nível não perde nem inventa XP, e nenhuma rodada compra um nível ---
{
  console.log('\n5. A CONTA FECHA');
  let nivel = 1, xp = 0, somado = 0;
  for (let i = 0; i < 20_000; i += 1) {
    const ganho = xpDaRodada(BRONZE * (1 + (i % 37)), BRONZE);
    somado += ganho;
    const p = somarXp(nivel, xp, ganho);
    if (p.xp < 0) falhar('XP ficou negativo depois de subir de nível');
    if (p.xp >= xpDoNivel(p.level)) falhar(`sobrou XP acima do exigido: ${p.xp} de ${xpDoNivel(p.level)} no nível ${p.level}`);
    nivel = p.level; xp = p.xp;
  }
  let gasto = 0;
  for (let n = 1; n < nivel; n += 1) gasto += xpDoNivel(n);
  console.log(`   20.000 rodadas: ${somado.toLocaleString('pt-BR')} XP -> nível ${nivel}, com ${xp} na barra`);
  console.log(`   conferindo: ${gasto.toLocaleString('pt-BR')} gastos + ${xp} na barra = ${(gasto + xp).toLocaleString('pt-BR')}`);
  if (gasto + xp !== somado) falhar(`sumiram ${somado - (gasto + xp)} XP no caminho`);

  // NENHUMA rodada, de nenhum tamanho, sobe um nível sozinha.
  if (XP_MAXIMO_POR_RODADA >= xpDoNivel(1)) {
    falhar(`uma rodada no teto (${XP_MAXIMO_POR_RODADA}) passa do primeiro nível (${xpDoNivel(1)}) — uma aposta compraria um nível`);
  }
  console.log(`   o teto por rodada (${XP_MAXIMO_POR_RODADA}) é menor que o nível mais barato (${xpDoNivel(1)}): nenhuma aposta compra um nível.`);

  /*
   * XP GRANDE DE UMA VEZ. Nenhuma APOSTA chega perto disto (o teto por rodada é 60), mas
   * outras fontes chegam: prêmio de torneio, recompensa diária, ajuste de suporte. É por
   * elas que `somarXp` sobe em laço e não num `if` — com `if`, quem recebesse um prêmio
   * grande subiria UM nível e ficaria com a barra estourada, cheia muito além do fim,
   * até a rodada seguinte.
   */
  const p = somarXp(1, 0, 10_000_000);
  console.log(`   [trava] 10 milhões de XP de uma vez levam ao nível ${p.level} (subiu ${p.subiuNiveis}), com ${p.xp} na barra`);
  if (p.xp >= xpDoNivel(p.level)) {
    falhar(`sobrou ${p.xp} XP de ${xpDoNivel(p.level)} no nível ${p.level} — a barra ficou estourada, subiu um nível só`);
  }
  if (p.level > NIVEL_MAXIMO) falhar(`nível ${p.level} passou do topo da escada (${NIVEL_MAXIMO})`);

  /*
   * O TOPO. Um número que nenhum jogador vai ver, posto aqui porque é justamente o que
   * ninguém testa à mão: XP maior que a escada inteira.
   */
  const todaAEscada = (() => { let s2 = 0; for (let n = 1; n < NIVEL_MAXIMO; n += 1) s2 += xpDoNivel(n); return s2; })();
  const topo = somarXp(1, 0, todaAEscada * 10);
  console.log(`   [topo] XP dez vezes maior que a escada inteira para no nível ${topo.level}, noTopo=${topo.noTopo}, barra ${topo.xp}/${topo.xpToNextLevel}`);
  if (topo.level !== NIVEL_MAXIMO) falhar(`XP infinito devia parar no ${NIVEL_MAXIMO} e parou no ${topo.level}`);
  if (!topo.noTopo) falhar('chegou no nível máximo e `noTopo` continuou falso — a tela não teria como saber');
  if (topo.xp !== 0 || topo.xpToNextLevel !== 0) falhar(`no topo a barra devia estar zerada e veio ${topo.xp}/${topo.xpToNextLevel}`);
  const jaNoTopo = somarXp(NIVEL_MAXIMO, 0, 1_000_000);
  if (jaNoTopo.level !== NIVEL_MAXIMO || jaNoTopo.subiuNiveis !== 0) falhar('quem já está no topo subiu de nível');
}

// --- 6. o nível 10.000 é longe, e é alcançável ---
{
  console.log('\n6. A DISTÂNCIA ATÉ O 10.000');
  const acumuladoAte = (alvo: number) => { let s = 0; for (let n = 1; n < alvo; n += 1) s += xpDoNivel(n); return s; };
  const perfis: Array<[string, number]> = [
    ['casual   (30 rodadas no mínimo)', 30 * xpDaRodada(BRONZE, BRONZE)],
    ['médio    (150 rodadas em 5x)', 150 * xpDaRodada(BRONZE * 5, BRONZE)],
    ['pesado   (batendo o teto diário)', XP_MAXIMO_POR_DIA],
  ];
  console.log('                                       XP/dia    nível 20    nível 100    nível 1.000   nível 10.000');
  for (const [nome, porDia] of perfis) {
    const dias = (alvo: number) => acumuladoAte(alvo) / porDia;
    const escrever = (d: number) =>
      d < 1 ? `${(d * 24).toFixed(0)} h` : d < 90 ? `${d.toFixed(0)} d` : d < 800 ? `${(d / 30).toFixed(0)} mes` : `${(d / 365).toFixed(0)} anos`;
    console.log(
      `   ${nome.padEnd(34)} ${porDia.toLocaleString('pt-BR').padStart(7)}` +
      `${escrever(dias(20)).padStart(11)}${escrever(dias(100)).padStart(13)}${escrever(dias(1_000)).padStart(15)}${escrever(dias(10_000)).padStart(15)}`,
    );
  }

  const anosDoPesado = acumuladoAte(NIVEL_MAXIMO) / XP_MAXIMO_POR_DIA / 365;
  if (anosDoPesado > 10) falhar(`nem jogando no teto todo dia dá pra chegar ao 10.000 em ${anosDoPesado.toFixed(0)} anos — o nível seria ficção`);
  if (anosDoPesado < 2) falhar(`o 10.000 sai em ${anosDoPesado.toFixed(1)} anos jogando no teto — prestígio demais barato`);
  console.log(`\n   jogando no teto todo santo dia, o 10.000 leva ${anosDoPesado.toFixed(1)} anos.`);
  console.log('   (a curva antiga, 500 + (N-1)x250, pedia 250 milhões de rodadas: quarenta anos sem parar.)');

  // E o começo tem que ser rápido, ou a barra não significa nada na primeira sessão.
  const rodadasAteONivel2 = Math.ceil(xpDoNivel(1) / xpDaRodada(BRONZE, BRONZE));
  console.log(`   e o primeiro nível sai em ${rodadasAteONivel2} rodadas de aposta mínima — a barra anda na primeira sessão.`);
  if (rodadasAteONivel2 > 40) falhar(`${rodadasAteONivel2} rodadas pro nível 2 — longe demais pra a barra significar alguma coisa no começo`);
}

console.log(problemas === 0 ? '\nTUDO OK — a barra anda, não se compra, e o robô não passa na frente.' : `\n${problemas} PROBLEMA(S).`);
process.exit(problemas === 0 ? 0 : 1);
