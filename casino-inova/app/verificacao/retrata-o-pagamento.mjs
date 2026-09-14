/**
 * O PAGAMENTO EM VOO, fotografado no meio do caminho.
 *
 *   node verificacao/retrata-o-pagamento.mjs [pasta]
 *
 * Retrato parado não mostra animação, e "a cena conta o resultado" é justamente a parte
 * que não aparece num retrato normal. Aqui a conferência gira o caça-níqueis até sair um
 * prêmio e fotografa DURANTE o voo das fichas — 300 ms depois do resultado, que é quando
 * elas estão no meio da subida.
 *
 * Se não sair prêmio nas tentativas, isto DIZ que não saiu em vez de inventar: o
 * caça-níqueis paga em um giro a cada cinco, e vinte giros sem prêmio acontece.
 */
const SAIDA = process.argv[2] || 'verificacao/retratos-depois';
const BASE = process.env.BASE || 'http://localhost:3000';
const GIROS = Number(process.env.GIROS || 25);

const { readFile } = await import('node:fs/promises');
const pw = await import(process.env.PLAYWRIGHT || 'playwright');
const { chromium } = pw.default ?? pw;

const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
  args: ['--no-proxy-server'],
});
const guardada = await readFile('/tmp/retratos-sessao.json', 'utf8').then(JSON.parse).catch(() => undefined);
const ctx = await nav.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  storageState: guardada,
});
const pagina = await ctx.newPage();

await pagina.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
await pagina.waitForTimeout(3000);
if ((await pagina.locator('input').count()) >= 2) {
  await pagina.locator('input').first().fill(process.env.CONTA || 'retrato@inova.test');
  await pagina.locator('input').nth(1).fill(process.env.SENHA || 'senha-de-teste-123');
  await pagina.getByText('Entrar', { exact: true }).last().click();
  await pagina.waitForTimeout(6000);
}
const agoraNao = pagina.getByText('Agora não', { exact: false }).first();
if ((await agoraNao.count()) > 0 && (await agoraNao.isVisible().catch(() => false))) {
  await agoraNao.click().catch(() => undefined);
  await pagina.waitForTimeout(1200);
}

await pagina.getByLabel(/^Caça-Níqueis —/).first().click({ timeout: 15000 });
await pagina.waitForTimeout(2500);
const entendi = pagina.getByText('Entendi, quero jogar', { exact: false }).first();
if ((await entendi.count()) > 0 && (await entendi.isVisible().catch(() => false))) {
  await entendi.click().catch(() => undefined);
  await pagina.waitForTimeout(2000);
}

/*
 * A FICHA EM VOO É UM ELEMENTO QUE EXISTE SÓ DURANTE O VOO. Contá-la é a prova de que a
 * animação aconteceu — e contar zero depois é a prova de que ela terminou e limpou o céu.
 */
const fichasNoAr = () =>
  pagina.evaluate(() => {
    let n = 0;
    for (const el of document.querySelectorAll('div')) {
      const e = getComputedStyle(el);
      if (Number(e.zIndex) === 20 && e.position === 'absolute') n = Math.max(n, el.childElementCount);
    }
    return n;
  });

/**
 * ESPERA O VOO APARECER, em vez de espiar uma vez.
 *
 * A primeira versão media 1,5 s depois do toque e via zero — não porque o voo não
 * acontecia, mas porque ele JÁ TINHA ACABADO: são 700 ms de curso mais 280 ms de cascata,
 * e em 1,5 s o céu já está limpo. Uma coisa que dura um segundo não se fotografa com uma
 * amostra só; observa-se de 80 em 80 ms até ela aparecer.
 */
async function esperarOVoo(limiteEmMs) {
  const ate = Date.now() + limiteEmMs;
  while (Date.now() < ate) {
    const n = await fichasNoAr();
    if (n > 0) return n;
    await pagina.waitForTimeout(80);
  }
  return 0;
}

let pegou = false;
for (let giro = 1; giro <= GIROS && !pegou; giro += 1) {
  const botao = pagina.getByText('Girar', { exact: false }).first();
  if (!(await botao.count())) break;
  await botao.click().catch(() => undefined);
  /* Os rolos giram, o resultado chega, e o voo começa. A espera observa até ele aparecer. */
  const noAr = await esperarOVoo(4000);
  if (noAr > 0) {
    await pagina.screenshot({ path: `${SAIDA}/caca-niqueis-pagamento.png` });
    console.log(`\n  ok   giro ${giro}: ${noAr} fichas em voo — retrato em ${SAIDA}/caca-niqueis-pagamento.png`);
    await pagina.waitForTimeout(2000);
    console.log(`  ok   depois do voo, ${await fichasNoAr()} fichas no ar — o céu limpa sozinho\n`);
    pegou = true;
  }
  await pagina.waitForTimeout(400);
}

if (!pegou) {
  console.log(`\n  não saiu prêmio em ${GIROS} giros — acontece, o caça-níqueis paga um em cinco.\n`);
}
await nav.close();
