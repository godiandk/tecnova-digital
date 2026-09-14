/**
 * CADA JOGO CABE NA TELA? — a rolagem E o corte, medidos, não estimados.
 *
 *   node verificacao/mede-rolagem.mjs
 *
 * O diagnóstico disse "sete telas rolam" e a conferência de apresentação conta nove. Nenhum
 * dos dois diz o que importa pra consertar: QUANTO sobra. Uma tela que passa 30 pixels se
 * resolve apertando um vão; uma que passa 400 precisa de outra disposição.
 *
 * A medida é feita na tela em jogo (a conferência dá o toque que distribui/gira/aposta),
 * porque é aí que a mesa está mais cheia — medir a mesa vazia mede o caso fácil.
 */
const BASE = process.env.BASE || 'http://localhost:3000';
const CONTA = process.env.CONTA || 'retrato@inova.test';
const SENHA = process.env.SENHA || 'senha-de-teste-123';
const SESSAO = process.env.SESSAO || '/tmp/retratos-sessao.json';

const { readFile, writeFile } = await import('node:fs/promises');
const pw = await import(process.env.PLAYWRIGHT || 'playwright');
const { chromium } = pw.default ?? pw;

const JOGOS = [
  'Caça-Níqueis', 'Roleta', 'Blackjack', 'Bacará', 'Banca Francesa',
  'Bac Bo', 'Stock Market', 'Truco', 'Dominó', 'Poker',
];

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
  args: ['--no-proxy-server'],
});
const guardada = await readFile(SESSAO, 'utf8').then(JSON.parse).catch(() => undefined);
const contexto = await nav.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  storageState: guardada,
});
const pagina = await contexto.newPage();

await pagina.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
await pagina.waitForTimeout(3000);
const campos = pagina.locator('input');
if ((await campos.count()) >= 2) {
  await campos.first().fill(CONTA);
  await campos.nth(1).fill(SENHA);
  await pagina.getByText('Entrar', { exact: true }).last().click();
  await pagina.waitForTimeout(6000);
  await writeFile(SESSAO, JSON.stringify(await contexto.storageState()));
}

async function fecharORecado() {
  const agoraNao = pagina.getByText('Agora não', { exact: false }).first();
  if ((await agoraNao.count()) > 0 && (await agoraNao.isVisible().catch(() => false))) {
    await agoraNao.click().catch(() => undefined);
    await pagina.waitForTimeout(1200);
  }
}
await fecharORecado();

console.log('\n  quanto cada jogo passa da tela, em pixels (390 x 844)\n');
const medidas = [];
for (const jogo of JOGOS) {
  try {
    await pagina.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
    await pagina.waitForTimeout(2200);
    await fecharORecado();

    const cartao = pagina.getByLabel(new RegExp(`^${jogo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} —`)).first();
    try { await cartao.click({ timeout: 8000 }); }
    catch { await fecharORecado(); await cartao.click({ timeout: 12000 }); }
    await pagina.waitForTimeout(2200);

    for (const modo of [/^Sozinho/, /^Contra o computador/, /^1 x 1/, /^Cara a cara/, /^Contra a casa/]) {
      const opcao = pagina.getByLabel(modo).first();
      if ((await opcao.count()) > 0 && (await opcao.isVisible().catch(() => false))) {
        await opcao.click().catch(() => undefined);
        await pagina.waitForTimeout(3200);
        break;
      }
    }
    const entendi = pagina.getByText('Entendi, quero jogar', { exact: false }).first();
    if ((await entendi.count()) > 0 && (await entendi.isVisible().catch(() => false))) {
      await entendi.click().catch(() => undefined);
      await pagina.waitForTimeout(2000);
    }
    for (const porta of ['Começar partida', 'Distribuir', 'Girar', 'Apostar']) {
      const botao = pagina.getByText(porta, { exact: false }).first();
      if ((await botao.count()) > 0 && (await botao.isVisible().catch(() => false))) {
        await botao.click().catch(() => undefined);
        await pagina.waitForTimeout(4000);
        break;
      }
    }

    /*
     * A MEDIDA É DO MAIOR ROLÁVEL DA TELA, e não só do `body`.
     *
     * Num aplicativo React Native Web quem rola é um `div` interno com `overflow: auto` —
     * o `body` fica do tamanho da janela e mediria zero sempre. Aqui a varredura pega todo
     * elemento que rola e devolve o que mais passa.
     */
    const sobra = await pagina.evaluate(() => {
      let maior = 0;
      let quem = '';
      for (const el of document.querySelectorAll('*')) {
        const passa = el.scrollHeight - el.clientHeight;
        if (passa > maior && el.clientHeight > 200) {
          const estilo = getComputedStyle(el);
          if (/(auto|scroll)/.test(estilo.overflowY)) { maior = passa; quem = el.className.slice(0, 40); }
        }
      }
      return { maior, quem };
    });
    /*
     * E O QUE FICOU FORA DA TELA — porque "não rola" não é o mesmo que "cabe".
     *
     * Tirando a rolagem do bacará, a medida de transbordo foi a zero e a tela ficou PIOR:
     * o conteúdo passou a ser cortado nas duas pontas, com o título por cima do saldo e o
     * botão "Apostar" metade fora da borda de baixo. Zero de rolagem com corte é o pior
     * dos dois mundos, e a medida anterior aprovava isso.
     *
     * Então mede-se também o que é TOCÁVEL: todo elemento com papel de botão que esteja,
     * inteiro ou em parte, fora da janela. Um botão que não cabe é um botão que não existe.
     */
    const fora = await pagina.evaluate(() => {
      const perdidos = [];
      for (const el of document.querySelectorAll('[role="button"], [aria-label]')) {
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) continue;
        const estilo = getComputedStyle(el);
        if (estilo.visibility === 'hidden' || estilo.display === 'none') continue;
        /*
         * O QUE ESTÁ DENTRO DE UMA GAVETA NÃO ESTÁ PERDIDO.
         *
         * O trilho de fichas do Bac Bo e da banca francesa é uma gaveta horizontal COM
         * SETAS — decisão registrada em `TrilhoDeFichas`: numa mesa de cassino ninguém
         * desliza um trilho, então a seta é quem avisa que existe mais ficha do lado de
         * fora. A ficha de 100 mil estando fora da janela é o desenho funcionando, não um
         * corte. Sem esta linha a medida acusava três jogos por fazerem a coisa certa.
         */
        let emGaveta = false;
        for (let pai = el.parentElement; pai; pai = pai.parentElement) {
          const paiEstilo = getComputedStyle(pai);
          if (/(auto|scroll)/.test(paiEstilo.overflowX) || /(auto|scroll)/.test(paiEstilo.overflowY)) {
            emGaveta = true;
            break;
          }
        }
        if (emGaveta) continue;
        if (r.top < -1 || r.left < -1 || r.bottom > window.innerHeight + 1 || r.right > window.innerWidth + 1) {
          perdidos.push((el.getAttribute('aria-label') || el.textContent || '?').trim().slice(0, 28));
        }
      }
      return [...new Set(perdidos)];
    });
    medidas.push([jogo, sobra.maior, fora]);
    console.log(
      `  ${jogo.padEnd(16)} ${String(sobra.maior).padStart(5)} px` +
        (fora.length ? `   fora da tela: ${fora.join(', ')}` : ''),
    );
  } catch (erro) {
    console.log(`  ${jogo.padEnd(16)}   ??  (${String(erro).split('\n')[0].slice(0, 60)})`);
  }
}

const cabem = medidas.filter(([, px, fora]) => px === 0 && fora.length === 0);
console.log(`\n  ${cabem.length} de ${medidas.length} jogos cabem na tela: sem rolar E sem cortar\n`);
const cortados = medidas.filter(([, , fora]) => fora.length > 0);
if (cortados.length) {
  console.log('  com coisa fora da tela:');
  for (const [jogo, , fora] of cortados) console.log(`    ${jogo}: ${fora.join(', ')}`);
  console.log('');
}
await nav.close();
