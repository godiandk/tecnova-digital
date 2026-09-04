import { classificar, lancar, resolveBets, theoreticalRtp, DecisiveOutcome } from './banca-francesa.engine';
import { BET_TYPES, FACES, LANCAMENTOS_MAXIMOS_COM_JANELA, WINNING_SUMS } from './banca-francesa.config';
import { podeIrPara } from '../core/fases';

/**
 * Confere a janela de aposta entre lançamentos.
 *
 *   npx ts-node src/modules/games/banca-francesa/verify-janela.ts
 *
 * Depois de um lançamento NULO (4, 8 a 13, 17, 18) as apostas reabrem por 12 segundos:
 * dá pra aumentar, mudar de lugar ou retirar tudo antes do próximo lance. É uma regra
 * de mesa de verdade, e é também o lugar exato onde um jogo desonesto se esconderia —
 * "os dados estão quentes", "depois de três nulos vem Grande". Então a pergunta que
 * este script responde não é se a janela funciona, é se ela MENTE:
 *
 * 1. O que é nulo é exatamente o que a regra diz — nem uma soma a mais.
 * 2. Lançar em pedaços dá a mesma distribuição que lançar de uma vez. Partir a rodada
 *    em chamadas de rede não é o mesmo que mexer no dado, e isso precisa ser medido,
 *    não presumido.
 * 3. O RESULTADO NÃO DEPENDE DOS NULOS QUE VIERAM ANTES. É a pergunta que decide se a
 *    janela é honesta: se depois de três nulos alguma coisa ficasse mais provável,
 *    quem esperasse teria vantagem — e quem apostasse cedo, desvantagem. O dado não
 *    tem memória, e aqui isso é medido face a face em vez de prometido.
 * 4. O teto de segurança está longe do jogo normal: ele existe pra mesa esquecida não
 *    lançar pra sempre, não pra encurtar rodada de ninguém.
 */
let problemas = 0;
const falhar = (m: string) => { problemas += 1; console.log(`FALHOU: ${m}`); };

/** Qui-quadrado com 2 graus de liberdade (ases, pequeno, grande), corte de 99,9%. */
const CORTE_QUI_2GL = 13.82;

function quiQuadrado(observado: Record<DecisiveOutcome, number>, total: number): number {
  const esperado: Record<DecisiveOutcome, number> = {
    ases: (total * 1) / 63,
    pequeno: (total * 31) / 63,
    grande: (total * 31) / 63,
  };
  return (['ases', 'pequeno', 'grande'] as const).reduce(
    (soma, tipo) => soma + ((observado[tipo] - esperado[tipo]) ** 2) / esperado[tipo],
    0,
  );
}

// --- 1. O que é nulo é exatamente o que a regra diz ---
{
  const decisivas = new Map<DecisiveOutcome, number>([['ases', 0], ['pequeno', 0], ['grande', 0]]);
  const somasNulas = new Set<number>();
  let combinacoes = 0;
  let nulas = 0;

  for (let a = 1; a <= FACES; a += 1) {
    for (let b = 1; b <= FACES; b += 1) {
      for (let c = 1; c <= FACES; c += 1) {
        combinacoes += 1;
        const soma = a + b + c;
        const resultado = classificar(soma);
        if (resultado) decisivas.set(resultado, (decisivas.get(resultado) ?? 0) + 1);
        else { nulas += 1; somasNulas.add(soma); }
      }
    }
  }

  if (combinacoes !== 216) falhar(`três dados de 6 faces dão 216 combinações, contei ${combinacoes}`);
  if (decisivas.get('ases') !== 1) falhar(`Ases devia sair de 1 combinação (1-1-1), contei ${decisivas.get('ases')}`);
  if (decisivas.get('pequeno') !== 31) falhar(`Pequeno devia sair de 31 combinações, contei ${decisivas.get('pequeno')}`);
  if (decisivas.get('grande') !== 31) falhar(`Grande devia sair de 31 combinações, contei ${decisivas.get('grande')}`);
  if (nulas !== 153) falhar(`deviam sobrar 153 combinações nulas, contei ${nulas}`);

  const esperadasNulas = [4, 8, 9, 10, 11, 12, 13, 17, 18];
  const achadas = [...somasNulas].sort((x, y) => x - y);
  if (achadas.join(',') !== esperadasNulas.join(',')) {
    falhar(`as somas nulas deviam ser ${esperadasNulas.join(', ')}; são ${achadas.join(', ')}`);
  }
  // E nenhuma soma pode estar dos dois lados ao mesmo tempo.
  for (const soma of achadas) {
    const emAlgumArco = ([...Object.values(WINNING_SUMS)] as number[][]).some((lista) => lista.includes(soma));
    if (emAlgumArco) falhar(`a soma ${soma} é nula e ao mesmo tempo está num arco de aposta`);
  }

  console.log(`nulos: 153 das 216 combinações não decidem, e são exatamente as somas ${esperadasNulas.join(', ')} — ok`);
}

// --- 2. A máquina de fases deixa o nulo reabrir as apostas, e só isso ---
{
  if (!podeIrPara('SORTEIO', 'APOSTAS_ABERTAS')) falhar('o lançamento nulo precisa poder reabrir as apostas');
  if (!podeIrPara('SORTEIO', 'APURACAO')) falhar('o lançamento decisivo ainda precisa poder apurar');
  if (podeIrPara('SORTEIO', 'PAGAMENTO')) falhar('pular a apuração e pagar direto continua proibido');
  if (podeIrPara('APOSTAS_FECHADAS', 'APOSTAS_ABERTAS')) falhar('reabrir aposta sem lançar o dado devia ser proibido');
  console.log('fases: SORTEIO reabre as apostas (nulo) ou apura (decisivo), e nada além disso — ok');
}

// --- 3. Rodadas lançadas em pedaços, do jeito que a mesa faz agora ---
const RODADAS = 500_000;
const porNulosAntes = new Map<number, Record<DecisiveOutcome, number>>();
const geral: Record<DecisiveOutcome, number> = { ases: 0, pequeno: 0, grande: 0 };
const lancesPorRodada: number[] = [];
let piorRodada = 0;

for (let i = 0; i < RODADAS; i += 1) {
  let nulosAntes = 0;
  for (;;) {
    const lance = lancar();
    if (lance.outcome) {
      geral[lance.outcome] += 1;
      // Agrupa por quantos nulos vieram antes: 0, 1, 2 e "3 ou mais".
      const balde = Math.min(nulosAntes, 3);
      if (!porNulosAntes.has(balde)) porNulosAntes.set(balde, { ases: 0, pequeno: 0, grande: 0 });
      porNulosAntes.get(balde)![lance.outcome] += 1;
      lancesPorRodada.push(nulosAntes + 1);
      piorRodada = Math.max(piorRodada, nulosAntes + 1);
      break;
    }
    nulosAntes += 1;
  }
}

{
  const qui = quiQuadrado(geral, RODADAS);
  const linha = (['ases', 'pequeno', 'grande'] as const)
    .map((tipo) => `${tipo} ${(100 * geral[tipo] / RODADAS).toFixed(2)}%`)
    .join(', ');
  console.log(`\nlançando em pedaços, ${RODADAS.toLocaleString('pt-BR')} rodadas: ${linha}`);
  console.log(`  esperado: ases 1,59%, pequeno 49,21%, grande 49,21% — qui-quadrado ${qui.toFixed(2)} (corte ${CORTE_QUI_2GL})`);
  if (qui > CORTE_QUI_2GL) falhar(`qui-quadrado ${qui.toFixed(2)} passou do corte — partir a rodada mexeu na distribuição`);
}

// --- 4. O resultado não depende dos nulos que vieram antes ---
{
  console.log('\nresultado por quantidade de nulos antes (é aqui que a janela mentiria):');
  for (const balde of [0, 1, 2, 3]) {
    const contagem = porNulosAntes.get(balde);
    if (!contagem) { falhar(`nenhuma rodada com ${balde} nulos antes — amostra pequena demais`); continue; }
    const total = contagem.ases + contagem.pequeno + contagem.grande;
    const qui = quiQuadrado(contagem, total);
    const nome = balde === 3 ? '3 ou mais' : String(balde);
    const linha = (['ases', 'pequeno', 'grande'] as const)
      .map((tipo) => `${tipo} ${(100 * contagem[tipo] / total).toFixed(2)}%`)
      .join(', ');
    console.log(`  ${nome.padStart(9)} nulos (${total.toLocaleString('pt-BR')} rodadas): ${linha} — qui ${qui.toFixed(2)}`);
    if (qui > CORTE_QUI_2GL) {
      falhar(`com ${nome} nulos antes o qui-quadrado é ${qui.toFixed(2)} — o dado estaria lembrando do que veio antes`);
    }
  }
  console.log('  as quatro linhas batem com a mesma distribuição: esperar não melhora nem piora nada.');
}

/*
 * --- 5. O RTP continua o mesmo, medido nas rodadas lançadas em pedaços ---
 *
 * A FOLGA DE CADA APOSTA VEM DA CONTA DELA, não de um número escolhido a dedo. Uma
 * folga fixa reprova o Ases e passa pano no resto: ele paga 62x e sai 1 vez em 63,
 * então o RTP medido dele balança sozinho quase 1,1 ponto percentual com 500 mil
 * rodadas, enquanto o do Pequeno balança 0,14 e o da linha, 0,07. Foi exatamente o que
 * aconteceu na primeira versão deste script — 97,70% contra 98,41% no Ases, reprovado
 * por uma folga de 0,5 pp que era apertada demais pra ele e frouxa demais pros outros.
 *
 * Aqui a folga é 5 desvios-padrão da própria aposta. O desvio sai da estrutura de
 * pagamento medida no motor (quanto volta ganhando, quanto volta perdendo) e da chance
 * de ganhar: sd = (ganhando - perdendo) × raiz(p(1-p)/N). Cinco sigmas dão menos de 1
 * em 1,7 milhão de reprovar sem defeito, e ainda assim apertam onde dá pra apertar.
 */
{
  console.log('\nRTP medido nas rodadas acima, contra a fórmula (folga = 5 desvios-padrão da própria aposta):');
  const CHANCE_DE_GANHAR: Record<string, number> = {
    ases: 1 / 63,
    pequeno: 31 / 63,
    grande: 31 / 63,
    'linha-pequeno': 31 / 63,
    'linha-grande': 31 / 63,
  };

  for (const tipo of BET_TYPES) {
    const aposta = 100;
    let devolvido = 0;
    for (const [resultado, vezes] of Object.entries(geral) as [DecisiveOutcome, number][]) {
      devolvido += resolveBets(resultado, [{ type: tipo, amount: aposta }])[0].totalReturn * vezes;
    }
    const medido = devolvido / (aposta * RODADAS);
    const formula = theoreticalRtp(tipo);

    // Quanto volta ganhando e quanto volta perdendo, perguntado ao motor em vez de escrito aqui.
    const arco = tipo === 'ases' ? 'ases' : tipo.includes('pequeno') ? 'pequeno' : 'grande';
    const outroArco: DecisiveOutcome = arco === 'grande' ? 'pequeno' : 'grande';
    const ganhando = resolveBets(arco as DecisiveOutcome, [{ type: tipo, amount: aposta }])[0].totalReturn / aposta;
    const perdendo = resolveBets(outroArco, [{ type: tipo, amount: aposta }])[0].totalReturn / aposta;

    const p = CHANCE_DE_GANHAR[tipo];
    const desvio = (ganhando - perdendo) * Math.sqrt((p * (1 - p)) / RODADAS);
    const folga = 5 * desvio;
    const erro = Math.abs(medido - formula);

    console.log(
      `  ${tipo.padEnd(14)} medido ${(100 * medido).toFixed(2)}%  fórmula ${(100 * formula).toFixed(2)}%` +
      `  (diferença ${(100 * erro).toFixed(2)} pp, folga ${(100 * folga).toFixed(2)} pp)`,
    );
    if (erro > folga) {
      falhar(`${tipo}: medido ${(100 * medido).toFixed(2)}% contra ${(100 * formula).toFixed(2)}% da fórmula — ${(erro / desvio).toFixed(1)} desvios, longe demais pra ser sorte`);
    }
  }
}

// --- 6. O teto de segurança está longe do jogo normal ---
{
  const media = lancesPorRodada.reduce((s, n) => s + n, 0) / lancesPorRodada.length;
  const esperada = 216 / 63; // 3,43 lançamentos por rodada
  console.log(`\nlançamentos por rodada: média ${media.toFixed(2)} (esperada ${esperada.toFixed(2)}), pior caso em ${RODADAS.toLocaleString('pt-BR')} rodadas: ${piorRodada}`);
  if (Math.abs(media - esperada) > 0.05) falhar(`a média de lançamentos deu ${media.toFixed(2)}, esperava ${esperada.toFixed(2)}`);
  if (piorRodada >= LANCAMENTOS_MAXIMOS_COM_JANELA) {
    falhar(`uma rodada bateu o teto de ${LANCAMENTOS_MAXIMOS_COM_JANELA} — o teto está apertado demais e encurta jogo de verdade`);
  }
  console.log(`  o teto é ${LANCAMENTOS_MAXIMOS_COM_JANELA}: rede de segurança pra mesa esquecida, não limite de jogo.`);
}

console.log(problemas === 0 ? '\nTUDO OK — a janela entre lançamentos não mexe no jogo.' : `\n${problemas} PROBLEMA(S).`);
process.exit(problemas === 0 ? 0 : 1);
