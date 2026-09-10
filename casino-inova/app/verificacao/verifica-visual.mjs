/**
 * CONFERÊNCIA VISUAL — a tela de hoje contra a tela aprovada.
 *
 * As conferências que já existem dizem "cabe na tela" e "dá pra alcançar com o dedo".
 * Nenhuma delas percebe que a placa andou três pixels, que uma cor virou outra, ou que um
 * botão sumiu num tamanho de tela só. Isso hoje é descoberto por alguém olhando — e
 * descoberto semanas depois, quando ninguém mais sabe qual mudança causou.
 *
 * Ela captura as telas, compara com a base aprovada e diz QUANTO mudou e ONDE.
 *
 * DUAS COISAS QUE FAZEM ISTO SOBREVIVER (ou não):
 *
 * 1. MÁSCARA POR SELETOR, e não por retângulo chutado. Saldo, relógio e nome de jogador
 *    mudam a cada execução e não são layout. As regiões a ignorar são achadas na hora,
 *    pelo rótulo de acessibilidade — então elas continuam certas quando a tela muda de
 *    tamanho, que é justamente quando um retângulo fixo passaria a apagar a coisa errada.
 *
 * 2. TOLERÂNCIA QUE NÃO É ZERO. Reamostragem de fonte e antisserrilhado mudam alguns
 *    pixels por execução em qualquer navegador. Exigir zero faria a conferência acusar
 *    sempre, e conferência que acusa sempre é desligada — o pior desfecho possível.
 *
 * COMO RODAR (com o servidor no ar e o site publicado em app/dist):
 *
 *   node verificacao/verifica-visual.mjs              compara com a base
 *   node verificacao/verifica-visual.mjs --aprovar    grava a base a partir de agora
 *
 * `--aprovar` é uma decisão, não um atalho: ela diz "a tela de agora está certa". Só use
 * depois de OLHAR as imagens de diagnóstico e concordar com cada diferença.
 */
import { execFile } from 'node:child_process';
import { mkdir, readdir, rm, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

const executar = promisify(execFile);

const APROVAR = process.argv.includes('--aprovar');
const BASE = process.env.BASE || 'http://localhost:3000';
const AQUI = new URL('.', import.meta.url).pathname;
const PASTA_DA_BASE = join(AQUI, 'base-visual');
const PASTA_DE_AGORA = join(AQUI, 'visual-agora');
const COMPARADOR = join(AQUI, 'compara-retratos.py');

/**
 * Quanto pode mudar sem ser defeito, em por cento dos pixels olhados.
 *
 * Não é um número bonito: é o teto do ruído de reamostragem que o próprio navegador
 * produz entre duas execuções idênticas. Acima disso, alguma coisa mudou de verdade.
 */
const TOLERANCIA = 0.15;

/*
 * `densidade` fica explícita, e vale 1 nas duas.
 *
 * Não é economia de bytes: `boundingBox()` devolve pixels de CSS e o retrato sai em
 * pixels do aparelho. Com densidade 2, toda máscara cairia na metade do caminho do que
 * deveria apagar — apagando layout de verdade e deixando o saldo aparecendo. Fixando em
 * 1, os dois sistemas de coordenada são o mesmo, e a máscara vai onde foi pedida.
 *
 * O que a densidade 2 revelaria (nitidez de fonte, arredondamento de meio pixel) não é o
 * que esta conferência procura, e é medido em outro lugar.
 */
const TELAS = [
  ['celular', 390, 844, true, 1],
  ['monitor', 1920, 1080, false, 1],
];

/**
 * O que ignorar em toda tela, por rótulo de acessibilidade.
 *
 * Cada linha aqui é uma coisa que muda sozinha e não é layout. Nenhuma delas é "essa
 * parte dá trabalho de estabilizar": cada uma é conteúdo genuinamente variável.
 */
const IGNORAR_SEMPRE = [
  /*
   * A ficha do saldo. O rótulo dela é "Comprar fichas" e não "saldo" — foi assim que a
   * primeira versão desta conferência achou ZERO regiões pra ignorar numa tela que tem o
   * saldo em cima: o seletor foi escrito de cabeça, e não lido da tela.
   */
  (p) => p.locator('[aria-label="Comprar fichas"]'),
  /* A barra de nível: muda a cada mão jogada. */
  (p) => p.locator('[aria-label^="Nível"]'),
  /* Ganhos recentes: nome, valor e "há 5 h" de outra pessoa, ao vivo. Sem rótulo. */
  (p) => p.getByText(/ganhou/i),
  /* Qualquer tempo relativo ou contagem regressiva. */
  (p) => p.getByText(/\bhá \d|faltam|\d+\s*(s|min)\b/i),
];

async function main() {
  await mkdir(PASTA_DE_AGORA, { recursive: true });
  await mkdir(PASTA_DA_BASE, { recursive: true });
  /* Limpa a captura anterior: retrato velho sobrando vira comparação fantasma. */
  for (const f of await readdir(PASTA_DE_AGORA)) await rm(join(PASTA_DE_AGORA, f));

  const pw = await import(process.env.PLAYWRIGHT || 'playwright');
  const { chromium } = pw.default ?? pw;
  const nav = await chromium.launch({
    executablePath: process.env.CHROMIUM || undefined,
    args: ['--no-proxy-server'],
  });

  const capturados = [];
  for (const [nomeDaTela, largura, altura, celular, densidade] of TELAS) {
    const pagina = await nav.newPage({
      viewport: { width: largura, height: altura },
      isMobile: celular,
      hasTouch: celular,
      deviceScaleFactor: densidade,
      /*
       * Movimento reduzido LIGADO. Não é preferência: é o que faz a tela ficar parada
       * o suficiente pra ser fotografada duas vezes com o mesmo resultado. Sem isso, a
       * conferência estaria medindo em que quadro da animação o retrato caiu.
       */
      reducedMotion: 'reduce',
    });

    await entrar(pagina);

    for (const [nomeDoLugar, irAte] of LUGARES) {
      try {
        await irAte(pagina);
      } catch (erro) {
        console.log(`  PULOU   ${nomeDoLugar} (${nomeDaTela}): ${String(erro).split('\n')[0].slice(0, 90)}`);
        continue;
      }
      const arquivo = `${nomeDoLugar}-${nomeDaTela}.png`;
      const mascaras = await acharAsMascaras(pagina, densidade);
      await pagina.screenshot({ path: join(PASTA_DE_AGORA, arquivo) });
      capturados.push({ arquivo, mascaras });
      /*
       * Quantas máscaras foram achadas sai no relatório de propósito. Zero máscaras numa
       * tela que TEM saldo na barra não é "tela limpa": é seletor que parou de casar, e
       * daí a conferência passa a acusar diferença toda execução por causa de um número
       * que muda — até alguém desligá-la.
       */
      console.log(`  capturou  ${arquivo} (${mascaras.length} região(ões) ignorada(s))`);
    }
    await pagina.close();
  }

  await nav.close();

  if (APROVAR) {
    for (const { arquivo } of capturados) {
      await copyFile(join(PASTA_DE_AGORA, arquivo), join(PASTA_DA_BASE, arquivo));
    }
    console.log(`\n${capturados.length} retratos aprovados como base em ${PASTA_DA_BASE}\n`);
    return 0;
  }

  console.log('');
  let problemas = 0;
  let semBase = 0;
  for (const { arquivo, mascaras } of capturados) {
    const daBase = join(PASTA_DA_BASE, arquivo);
    if (!existsSync(daBase)) {
      semBase += 1;
      console.log(`  SEM BASE  ${arquivo} — rode com --aprovar depois de conferir a olho`);
      continue;
    }
    const argumentos = [
      COMPARADOR, daBase, join(PASTA_DE_AGORA, arquivo),
      join(PASTA_DE_AGORA, `diff-${arquivo}`),
    ];
    for (const m of mascaras) argumentos.push('--mascara', m.join(','));

    const { stdout } = await executar('python3', argumentos).catch((e) => ({ stdout: e.stdout ?? '100 erro' }));
    const [porCento, ...aviso] = stdout.trim().split(' ');
    const mudou = Number(porCento);

    if (aviso.length) {
      problemas += 1;
      console.log(`  MUDOU     ${arquivo} — ${aviso.join(' ')}`);
    } else if (mudou > TOLERANCIA) {
      problemas += 1;
      console.log(`  MUDOU     ${arquivo} — ${mudou}% dos pixels (veja diff-${arquivo})`);
    } else {
      console.log(`  ok        ${arquivo} — ${mudou}%`);
    }
  }

  if (semBase) {
    console.log(`\n${semBase} tela(s) sem base. A primeira execução é sempre assim:`);
    console.log('  olhe os retratos em verificacao/visual-agora/ e, se estiverem certos,');
    console.log('  rode de novo com --aprovar.');
  }
  const comparadas = capturados.length - semBase;
  if (problemas > 0) {
    console.log(`\n${problemas} tela(s) mudaram. Olhe as imagens de diagnóstico antes de aprovar.\n`);
  } else if (comparadas > 0) {
    console.log(`\n${comparadas} tela(s) conferidas, nenhuma mudou sem querer.\n`);
  } else {
    /* Sem nenhuma base, não há o que afirmar — e afirmar mesmo assim seria mentira. */
    console.log('\nNada foi comparado: ainda não existe base aprovada.\n');
  }
  return problemas === 0 ? 0 : 1;
}

/** As caixas das coisas que mudam sozinhas, em pixels do RETRATO (não de CSS). */
async function acharAsMascaras(pagina, escala) {
  const caixas = [];
  for (const achar of IGNORAR_SEMPRE) {
    for (const alvo of await achar(pagina).all()) {
      const caixa = await alvo.boundingBox().catch(() => null);
      if (!caixa) continue;
      /* Uma folga de 2 px em volta: a borda de um elemento antisserrilha. */
      caixas.push([
        Math.max(0, Math.floor(caixa.x * escala) - 2),
        Math.max(0, Math.floor(caixa.y * escala) - 2),
        Math.ceil(caixa.width * escala) + 4,
        Math.ceil(caixa.height * escala) + 4,
      ]);
    }
  }
  return caixas;
}

async function entrar(pagina) {
  await pagina.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
  await pagina.waitForTimeout(3000);
  await pagina.locator('input').first().fill(process.env.CONTA || 'wly.vianna@gmail.com');
  await pagina.locator('input').nth(1).fill(process.env.SENHA || 'senha-de-teste-123');
  await pagina.getByText('Entrar', { exact: true }).last().click();
  await pagina.waitForTimeout(6000);
}

/**
 * Onde fotografar.
 *
 * Só telas que PARAM. Uma mesa no meio de uma rodada muda a cada execução por definição,
 * e fotografá-la mediria em que instante o retrato caiu — não o layout. Mesa em rodada
 * é assunto da POC de renderização e do medidor de quadros, não daqui.
 */
const LUGARES = [
  ['lobby', async (p) => {
    await p.goto(BASE, { waitUntil: 'networkidle' });
    await p.waitForTimeout(2500);
  }],
  ['perfil', async (p) => {
    await p.getByLabel('Perfil', { exact: true }).first().click({ timeout: 8000 });
    await p.waitForTimeout(1800);
  }],
  /* A aba se chama "Caixa" na tela, não "Loja" — o rótulo aqui é o que a pessoa lê. */
  /*
   * "Caixa" EXATO. Com `/Caixa|Comprar fichas/` o primeiro casamento era a ficha do saldo
   * no alto da tela, que não abre nada — e a conferência ficava oito segundos tentando
   * clicar nela antes de desistir.
   */
  ['caixa', async (p) => {
    await p.getByLabel('Caixa', { exact: true }).first().click({ timeout: 8000 });
    await p.waitForTimeout(1800);
  }],
  ['torneios', async (p) => {
    await p.getByLabel('Torneios', { exact: true }).first().click({ timeout: 8000 });
    await p.waitForTimeout(2000);
  }],
];

process.exit(await main());
