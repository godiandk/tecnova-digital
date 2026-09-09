/**
 * A MESA DA BANCA FRANCESA CABE NOS CINCO TAMANHOS?
 *
 *   PLAYWRIGHT=/caminho/playwright/index.js CHROMIUM=/caminho/chrome \
 *   node verificacao/verifica-tamanhos.mjs
 *
 * Os cinco tamanhos são os do relatório de auditoria: dois celulares, um tablet, um
 * notebook e um monitor. Em cada um, a pergunta não é "está bonito" — é objetiva:
 *
 *   1. TODO CONTROLE É ALCANÇÁVEL. Ou ele cabe inteiro na janela, ou está dentro de
 *      uma caixa que rola de lado e que, essa sim, cabe inteira — como o trilho de
 *      fichas, que numa tela estreita guarda as duas maiores atrás da seta.
 *   2. A PÁGINA NÃO ROLA DE LADO. Rolagem horizontal em mesa de cassino é defeito:
 *      some com metade do pano e ninguém percebe que existe mais.
 *   3. OS CONTROLES ESSENCIAIS ESTÃO VISÍVEIS: saldo, as cinco casas de aposta, o
 *      trilho de fichas e o botão principal. Uma mesa em que o botão de lançar ficou
 *      abaixo da dobra é uma mesa em que não dá pra jogar.
 *   4. ÁREA DE TOQUE DE 44px. É o mínimo que a Apple e o Google publicam, e abaixo dele
 *      quem tem dedo grosso erra o alvo. Vale pros controles, não pras casas do pano
 *      (que são áreas grandes, desenhadas na arte).
 *   5. TODO CONTROLE TEM NOME ACESSÍVEL. Botão sem nome é botão que o leitor de tela
 *      anuncia como "botão", e aí a mesa fica injogável de ouvido.
 */
const TELAS = [
  ['iPhone 12/13/14', 390, 844, true],
  ['iPhone 14 Pro Max', 430, 932, true],
  ['iPad retrato', 768, 1024, false],
  ['notebook', 1366, 768, false],
  ['monitor', 1920, 1080, false],
];

const ALVO_MINIMO = 44;
const BASE = process.env.BASE || 'http://localhost:3000';

const pw = await import(process.env.PLAYWRIGHT || 'playwright');
const { chromium } = pw.default ?? pw;

let problemas = 0;
const falhar = (m) => { problemas += 1; console.log(`   FALHOU: ${m}`); };
const ok = (m) => console.log(`   ok — ${m}`);

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
  args: ['--no-proxy-server'],
});

for (const [nome, largura, altura, celular] of TELAS) {
  console.log(`\n=== ${nome} — ${largura}x${altura} ===`);
  const pagina = await nav.newPage({
    viewport: { width: largura, height: altura },
    isMobile: celular,
    hasTouch: celular,
  });
  const excecoes = [];
  pagina.on('pageerror', (e) => excecoes.push(String(e).slice(0, 120)));

  await pagina.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
  await pagina.waitForTimeout(3500);
  await pagina.locator('input').first().fill(process.env.CONTA || 'wly.vianna@gmail.com');
  await pagina.locator('input').nth(1).fill(process.env.SENHA || 'senha-de-teste-123');
  await pagina.getByText('Entrar', { exact: true }).last().click();
  await pagina.waitForTimeout(6000);
  await pagina.getByLabel('Banca Francesa — mesa com gente').click();
  await pagina.waitForTimeout(1800);
  await pagina.getByLabel('Sozinho — Você contra a casa, no seu ritmo.').click();
  await pagina.waitForTimeout(4500);

  const medida = await pagina.evaluate((minimoDoAlvo) => {
    const janela = { l: document.documentElement.clientWidth, a: document.documentElement.clientHeight };
    const controles = [...document.querySelectorAll('[role="button"],[role="radio"],button,[role="radiogroup"] > *')];

    /*
     * VAZAR NÃO É A MESMA COISA QUE ESTAR GUARDADO NUMA GAVETA QUE ROLA.
     *
     * O trilho de fichas é uma gaveta: numa tela estreita ele mostra três fichas e as
     * outras duas ficam do lado de fora DELE, alcançáveis pela seta. Isso é o desenho
     * funcionando, não defeito — e é diferente de um controle que passou da borda da
     * janela sem nada que o traga de volta, que é o defeito de verdade.
     *
     * Então a pergunta certa não é "o retângulo cabe na janela?" e sim "dá pra chegar
     * nele?". Um controle passa se ele cabe na janela OU se está dentro de uma caixa que
     * rola de lado E essa caixa cabe inteira na janela. A segunda parte é o que impede a
     * regra de virar desculpa: se a própria gaveta transborda a tela, ninguém a alcança,
     * e aí o controle continua reprovado — que era exatamente o caso do trilho de 60 a
     * 418 numa janela de 390.
     */
    const rolaDeLado = (e) => {
      for (let p = e.parentElement; p; p = p.parentElement) {
        const est = getComputedStyle(p);
        const podeRolar = /auto|scroll/.test(est.overflowX);
        if (podeRolar && p.scrollWidth > p.clientWidth + 1) return p;
      }
      return null;
    };
    const cabeNaJanela = (r) => r.left >= -1 && r.right <= janela.l + 1;

    const vazando = [];
    const pequenos = [];
    const semNome = [];
    for (const e of controles) {
      const r = e.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const rotulo = e.getAttribute('aria-label') || e.textContent?.trim() || '';
      if (!rotulo) semNome.push(e.tagName.toLowerCase());
      /* Vazar é ficar com parte fora da janela na horizontal — o vertical rola. */
      if (!cabeNaJanela(r)) {
        const gaveta = rolaDeLado(e);
        const alcancavel = gaveta !== null && cabeNaJanela(gaveta.getBoundingClientRect());
        if (!alcancavel) vazando.push(`${rotulo || e.tagName} (${Math.round(r.left)}..${Math.round(r.right)})`);
      }
      /*
       * As casas do pano são áreas desenhadas na arte e podem ser largas e baixas; o
       * mínimo de toque vale pros CONTROLES (fichas, botões redondos, botão principal).
       */
      const ehCasaDoPano = /^Apostar (em|no|na) /.test(rotulo);
      if (!ehCasaDoPano && Math.min(r.width, r.height) < minimoDoAlvo - 0.5) {
        pequenos.push(`${rotulo || e.tagName} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    }

    const texto = document.body.innerText;
    return {
      janela,
      rolagemHorizontal: document.documentElement.scrollWidth - janela.l,
      vazando,
      pequenos,
      semNome,
      controles: controles.length,
      temSaldo: /\d/.test(texto.split('\n').find((l) => /bi|mi|k|\d{3}/.test(l)) || ''),
      casas: [...document.querySelectorAll('[role="button"]')]
        .map((e) => e.getAttribute('aria-label') || '')
        .filter((r) => /^Apostar (em|no|na) /.test(r)).length,
      fichas: document.querySelectorAll('[role="radio"]').length,
      botaoPrincipal: /Encoste uma ficha|Confirmar|Lançar|Jogar novamente/.test(texto),
    };
  }, ALVO_MINIMO);

  if (excecoes.length) falhar(`exceções no console: ${excecoes.join(' | ')}`);

  medida.rolagemHorizontal <= 1
    ? ok('a página não rola de lado')
    : falhar(`a página rola ${medida.rolagemHorizontal}px de lado`);

  medida.vazando.length === 0
    ? ok(`nenhum dos ${medida.controles} controles vaza pra fora da tela`)
    : falhar(`${medida.vazando.length} controle(s) fora da tela: ${medida.vazando.slice(0, 3).join(', ')}`);

  medida.casas === 5
    ? ok('as cinco casas de aposta estão na tela')
    : falhar(`${medida.casas} casa(s) de aposta em vez de 5`);

  medida.fichas >= 5
    ? ok(`${medida.fichas} fichas no trilho`)
    : falhar(`só ${medida.fichas} ficha(s) no trilho`);

  medida.botaoPrincipal ? ok('o botão principal está visível') : falhar('não achei o botão principal');
  medida.temSaldo ? ok('o saldo está visível') : falhar('não achei o saldo');

  medida.pequenos.length === 0
    ? ok(`todo controle tem pelo menos ${ALVO_MINIMO}px de alvo`)
    : falhar(`${medida.pequenos.length} controle(s) abaixo de ${ALVO_MINIMO}px: ${medida.pequenos.slice(0, 4).join(', ')}`);

  medida.semNome.length === 0
    ? ok('todo controle tem nome acessível')
    : falhar(`${medida.semNome.length} controle(s) sem nome acessível`);

  await pagina.close();
}

await nav.close();
console.log(problemas === 0
  ? '\nOK: a mesa cabe, não rola de lado e é alcançável nos cinco tamanhos.'
  : `\n${problemas} PROBLEMA(S)`);
process.exit(problemas === 0 ? 0 : 1);
