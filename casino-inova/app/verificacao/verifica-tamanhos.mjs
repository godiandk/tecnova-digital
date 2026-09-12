/**
 * OS DEZ JOGOS CABEM NOS CINCO TAMANHOS?
 *
 *   PLAYWRIGHT=/caminho/playwright/index.js CHROMIUM=/caminho/chrome \
 *   node verificacao/verifica-tamanhos.mjs
 *
 *   JOGOS=roleta,slots node verificacao/verifica-tamanhos.mjs    só alguns
 *   TELAS=390,1920      node verificacao/verifica-tamanhos.mjs    só algumas larguras
 *
 * ANTES ESTA CONFERÊNCIA OLHAVA UM JOGO SÓ — a Banca Francesa. Provar responsividade em
 * um dos dez e concluir que o aplicativo é responsivo é o tipo de conclusão que a
 * auditoria chamou de "provado em um, assumido em nove". Agora são os dez.
 *
 * Os cinco tamanhos são os do relatório: dois celulares, um tablet, um notebook e um
 * monitor. Em cada um, a pergunta não é "está bonito" — é objetiva:
 *
 *   1. TODO CONTROLE É ALCANÇÁVEL. Ou ele cabe inteiro na janela, ou está dentro de
 *      uma caixa que rola de lado e que, essa sim, cabe inteira — como o trilho de
 *      fichas, que numa tela estreita guarda as duas maiores atrás da seta.
 *   2. A PÁGINA NÃO ROLA DE LADO. Rolagem horizontal em mesa de cassino é defeito:
 *      some com metade do pano e ninguém percebe que existe mais.
 *   3. O SALDO ESTÁ VISÍVEL. Jogar sem ver quanto se tem é a definição de mesa injusta.
 *   4. ÁREA DE TOQUE DE 44px. É o mínimo que a Apple e o Google publicam, e abaixo dele
 *      quem tem dedo grosso erra o alvo. Vale pros controles, não pras casas do pano
 *      (que são áreas grandes, desenhadas na arte).
 *   5. TODO CONTROLE TEM NOME ACESSÍVEL. Botão sem nome é botão que o leitor de tela
 *      anuncia como "botão", e aí a mesa fica injogável de ouvido.
 *   6. NENHUMA EXCEÇÃO NO CONSOLE. Tela que estoura num tamanho e não em outro é o
 *      defeito mais fácil de não perceber.
 *
 * E, onde o jogo tem uma contagem que a gente sabe de cor (as cinco casas da Banca, as
 * cinco fichas do trilho), ela também é conferida — mas só onde é sabida. Inventar um
 * número esperado pra cada jogo faria a conferência reprovar por opinião.
 */
const TELAS = [
  ['iPhone 12/13/14', 390, 844, true],
  ['iPhone 14 Pro Max', 430, 932, true],
  ['iPad retrato', 768, 1024, false],
  ['notebook', 1366, 768, false],
  ['monitor', 1920, 1080, false],
];

/**
 * Os dez jogos, com o rótulo pelo qual se entra.
 *
 * `sozinho: true` marca as mesas que perguntam antes se é contra a casa ou com gente —
 * hoje só a Banca Francesa. `espera` só existe onde a contagem é conhecida de fato.
 */
const JOGOS = [
  { chave: 'slots', rotulo: 'Caça-Níqueis — contra a casa, em destaque' },
  { chave: 'banca-francesa', rotulo: 'Banca Francesa — mesa com gente', sozinho: true, espera: { casas: 5, fichas: 5 } },
  { chave: 'truco', rotulo: 'Truco — mesa com gente' },
  { chave: 'domino', rotulo: 'Dominó — mesa com gente' },
  { chave: 'poker', rotulo: 'Poker — mesa com gente' },
  { chave: 'roleta', rotulo: 'Roleta — contra a casa', espera: { fichas: 5 } },
  { chave: 'blackjack', rotulo: 'Blackjack — contra a casa' },
  { chave: 'bacara', rotulo: 'Bacará — contra a casa' },
  { chave: 'bac-bo', rotulo: 'Bac Bo — contra a casa', espera: { fichas: 5 } },
  { chave: 'stock-market', rotulo: 'Stock Market — contra a casa' },
];

const ALVO_MINIMO = 44;
const BASE = process.env.BASE || 'http://localhost:3000';

const soEstes = (process.env.JOGOS || '').split(',').map((s) => s.trim()).filter(Boolean);
const jogos = soEstes.length ? JOGOS.filter((j) => soEstes.includes(j.chave)) : JOGOS;
const soLarguras = (process.env.TELAS || '').split(',').map((s) => Number(s.trim())).filter(Boolean);
const telas = soLarguras.length ? TELAS.filter(([, l]) => soLarguras.includes(l)) : TELAS;

const pw = await import(process.env.PLAYWRIGHT || 'playwright');
const { chromium } = pw.default ?? pw;

let problemas = 0;
const falhar = (m) => { problemas += 1; console.log(`      FALHOU: ${m}`); };

/**
 * As casas do pano apertadas, somadas no fim.
 *
 * Elas não reprovam (ver o comentário sobre casa do pano), mas também não podem ficar só
 * numa linha no meio do relatório. Um resumo no fim é o que impede "não reprovou" de
 * virar "não existe".
 */
const casasApertadasPorJogo = new Map();

/** O menor lado que aparece numa lista de "rótulo LARGURAxALTURA". */
const menorDe = (lista) => {
  let menor = Infinity;
  for (const item of lista) {
    const m = item.match(/(\d+)x(\d+)$/);
    if (m) menor = Math.min(menor, Number(m[1]), Number(m[2]));
  }
  return Number.isFinite(menor) ? `${menor}px` : '?';
};

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
  args: ['--no-proxy-server'],
});

/** A medição, feita dentro da página. É a mesma para os dez jogos. */
const MEDIR = (minimoDoAlvo) => {
  const janela = { l: document.documentElement.clientWidth, a: document.documentElement.clientHeight };
  /*
   * SÓ O QUE É CONTROLE DE VERDADE.
   *
   * A primeira versão também pegava `[role="radiogroup"] > *`, e isso trazia o
   * ENVOLTÓRIO do trilho de fichas junto — uma `div` de layout de 7.438 px de largura
   * dentro de uma tela de 390. Ela reprovava a roleta com "controle fora da tela" enquanto
   * as cinco fichas estavam, medidas uma a uma, em 24..363: no lugar certo e do tamanho
   * certo. Estava reprovando uma caixa que ninguém toca e que não pinta nada.
   *
   * Controle é o que tem papel de controle. Ficha já é `role="radio"`; não precisa do
   * envoltório pra ser encontrada.
   */
  const controles = [...document.querySelectorAll('[role="button"],[role="radio"],button')];

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
   * e aí o controle continua reprovado.
   */
  const rolaDeLado = (e) => {
    for (let p = e.parentElement; p; p = p.parentElement) {
      const est = getComputedStyle(p);
      if (/auto|scroll/.test(est.overflowX) && p.scrollWidth > p.clientWidth + 1) return p;
    }
    return null;
  };
  const cabeNaJanela = (r) => r.left >= -1 && r.right <= janela.l + 1;

  const vazando = [];
  const pequenos = [];
  const casasApertadas = [];
  const semNome = [];
  for (const e of controles) {
    const r = e.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const rotulo = e.getAttribute('aria-label') || e.textContent?.trim() || '';
    if (!rotulo) semNome.push(e.tagName.toLowerCase());
    if (!cabeNaJanela(r)) {
      const gaveta = rolaDeLado(e);
      const alcancavel = gaveta !== null && cabeNaJanela(gaveta.getBoundingClientRect());
      if (!alcancavel) vazando.push(`${rotulo || e.tagName} (${Math.round(r.left)}..${Math.round(r.right)})`);
    }
    /*
     * CASA DO PANO NÃO É BOTÃO, e os 44 px não valem pra ela do mesmo jeito.
     *
     * A casa é uma área desenhada na arte da mesa: a "Grande" da Banca Francesa, o número
     * 17 da roleta. A forma dela vem do jogo, não do nosso layout — uma roleta tem doze
     * colunas de números, e exigir 44 px em cada uma pediria 528 px de largura numa tela
     * de 390. Não dá pra "consertar" sem deixar de ser roleta.
     *
     * Mas também não dá pra fingir que 26 px é confortável. Então elas são contadas à
     * parte e SAEM NO RELATÓRIO, com o menor tamanho: quem lê decide se a mesa precisa de
     * outro arranjo naquele tamanho de tela. O que não acontece é a conferência reprovar
     * a roleta por ser roleta — nem varrer o número pra baixo do tapete.
     */
    const ehCasaDoPano = /^Apostar (em|no|na) /.test(rotulo) || /paga \d+ vezes?/i.test(rotulo);
    if (Math.min(r.width, r.height) < minimoDoAlvo - 0.5) {
      const onde = ehCasaDoPano ? casasApertadas : pequenos;
      onde.push(`${rotulo || e.tagName} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
  }

  const texto = document.body.innerText;
  return {
    rolagemHorizontal: document.documentElement.scrollWidth - janela.l,
    vazando,
    pequenos,
    casasApertadas,
    semNome,
    controles: controles.length,
    /* O saldo é o número grande na barra de cima; a ficha dele tem rótulo próprio. */
    temSaldo: document.querySelector('[aria-label="Comprar fichas"]') !== null
      || /\d{1,3}(\.\d{3})+/.test(texto),
    casas: controles
      .map((e) => e.getAttribute('aria-label') || '')
      .filter((r) => /^Apostar (em|no|na) /.test(r)).length,
    fichas: document.querySelectorAll('[role="radio"]').length,
  };
};

for (const [nomeDaTela, largura, altura, celular] of telas) {
  console.log(`\n=== ${nomeDaTela} — ${largura}x${altura} ===`);

  for (const jogo of jogos) {
    const pagina = await nav.newPage({
      viewport: { width: largura, height: altura },
      isMobile: celular,
      hasTouch: celular,
      /* Sem animação: a mesa tem que ser fotografada parada, senão se mede o meio de uma. */
      reducedMotion: 'reduce',
    });
    const excecoes = [];
    pagina.on('pageerror', (e) => excecoes.push(String(e).slice(0, 120)));

    try {
      await pagina.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
      await pagina.waitForTimeout(2500);
      await pagina.locator('input').first().fill(process.env.CONTA || 'wly.vianna@gmail.com');
      await pagina.locator('input').nth(1).fill(process.env.SENHA || 'senha-de-teste-123');
      await pagina.getByText('Entrar', { exact: true }).last().click();
      await pagina.waitForTimeout(5000);

      /*
       * A RECOMPENSA DIÁRIA ABRE POR CIMA DO SALÃO no primeiro acesso do dia, e ela cobre
       * os cartões dos jogos. Sem fechar, TODO jogo falhava com "não consegui abrir" — o
       * clique acertava o modal. Fechar com "Agora não" é o que um jogador faz.
       */
      const agoraNao = pagina.getByText('Agora não', { exact: false }).first();
      if ((await agoraNao.count()) > 0 && (await agoraNao.isVisible().catch(() => false))) {
        await agoraNao.click().catch(() => undefined);
        await pagina.waitForTimeout(1500);
      }

      await pagina.getByLabel(jogo.rotulo).click({ timeout: 15000 });
      await pagina.waitForTimeout(1800);
      if (jogo.sozinho) {
        /*
         * O PRIMEIRO MODO DA LISTA. Era só `/^Sozinho/`, e o dominó chama os modos de
         * "1 x 1" e "2 x 2" — lá a medição parava na tela de modo em vez de medir a mesa.
         */
        for (const modo of [/^Sozinho/, /^Contra o computador/, /^1 x 1/, /^Cara a cara/, /^Contra a casa/]) {
          const opcao = pagina.getByLabel(modo).first();
          if ((await opcao.count()) > 0 && (await opcao.isVisible().catch(() => false))) {
            await opcao.click({ timeout: 10000 }).catch(() => undefined);
            await pagina.waitForTimeout(4000);
            break;
          }
        }
      } else {
        await pagina.waitForTimeout(3000);
      }

      /*
       * FECHA O TUTORIAL ANTES DE MEDIR.
       *
       * Na primeira visita a cada jogo sobe um "Como jogar" cobrindo a tela inteira. A
       * primeira versão desta conferência mediu POR BAIXO dele e produziu uma lista de
       * defeitos que não eram defeitos — controles medidos num estado que a pessoa vê uma
       * vez na vida, com a mesa nem terminada de montar atrás.
       *
       * Medir a tela errada com muita precisão continua sendo medir a tela errada.
       */
      const entendi = pagina.getByRole('button', { name: /Entendi, quero jogar/i }).first();
      if (await entendi.count()) {
        await entendi.click({ timeout: 8000 }).catch(() => {});
        await pagina.waitForTimeout(1500);
      }
    } catch (erro) {
      falhar(`${jogo.chave}: não consegui abrir — ${String(erro).split('\n')[0].slice(0, 90)}`);
      await pagina.close();
      continue;
    }

    const m = await pagina.evaluate(MEDIR, ALVO_MINIMO);
    const queixas = [];

    if (excecoes.length) queixas.push(`exceção: ${excecoes[0]}`);
    if (m.rolagemHorizontal > 1) queixas.push(`rola ${m.rolagemHorizontal}px de lado`);
    if (m.vazando.length) queixas.push(`${m.vazando.length} fora da tela: ${m.vazando.slice(0, 2).join(', ')}`);
    if (!m.temSaldo) queixas.push('não achei o saldo');
    if (m.pequenos.length) queixas.push(`${m.pequenos.length} abaixo de ${ALVO_MINIMO}px: ${m.pequenos.slice(0, 3).join(', ')}`);
    if (m.semNome.length) queixas.push(`${m.semNome.length} sem nome acessível`);
    if (jogo.espera?.casas !== undefined && m.casas !== jogo.espera.casas) {
      queixas.push(`${m.casas} casas de aposta em vez de ${jogo.espera.casas}`);
    }
    if (jogo.espera?.fichas !== undefined && m.fichas < jogo.espera.fichas) {
      queixas.push(`${m.fichas} fichas em vez de ${jogo.espera.fichas}`);
    }

    /* Informativo, não reprovação — ver o comentário sobre casa do pano acima. */
    if (m.casasApertadas.length) {
      const antes = casasApertadasPorJogo.get(jogo.chave) ?? [];
      casasApertadasPorJogo.set(jogo.chave, [...antes, `${largura}px: ${m.casasApertadas.length} casas, menor ${menorDe(m.casasApertadas)}`]);
    }
    const notaDasCasas = m.casasApertadas.length
      ? `  (${m.casasApertadas.length} casas do pano abaixo de ${ALVO_MINIMO}px, menor ${menorDe(m.casasApertadas)})`
      : '';

    if (queixas.length === 0) {
      console.log(`   ok   ${jogo.chave.padEnd(15)} ${String(m.controles).padStart(3)} controles${notaDasCasas}`);
    } else {
      console.log(`   --   ${jogo.chave}${notaDasCasas}`);
      queixas.forEach(falhar);
    }
    await pagina.close();
  }
}

await nav.close();

if (casasApertadasPorJogo.size) {
  console.log('\n--- casas do pano abaixo do alvo de toque (não reprovam; ver o porquê no cabeçalho) ---');
  for (const [jogo, linhas] of casasApertadasPorJogo) {
    console.log(`   ${jogo.padEnd(15)} ${linhas.join(' · ')}`);
  }
  console.log('   São áreas desenhadas na arte da mesa, com a forma que o jogo tem. Ficam');
  console.log('   registradas para quem for decidir se aquele tamanho de tela pede outro arranjo.');
}

console.log(problemas === 0
  ? `\nOK: os ${jogos.length} jogos cabem, não rolam de lado e são alcançáveis nos ${telas.length} tamanhos.`
  : `\n${problemas} PROBLEMA(S)`);
process.exit(problemas === 0 ? 0 : 1);
