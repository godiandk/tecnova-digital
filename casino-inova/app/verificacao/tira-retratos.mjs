/**
 * RETRATOS DA MESA — a evidência visual que o relatório de auditoria pede.
 *
 *   PLAYWRIGHT=/caminho/playwright/index.js CHROMIUM=/caminho/chrome \
 *   node verificacao/tira-retratos.mjs [pasta]
 *
 * Não é conferência: é prova. As conferências dizem "cabe" e "alcança"; estas imagens
 * mostram A MESA COMO ELA FICA, num celular e num monitor, com aposta na mesa e com o
 * resultado na tela. Quem lê o relatório não precisa subir o ambiente pra ver.
 */
const SAIDA = process.argv[2] || 'retratos';
const BASE = process.env.BASE || 'http://localhost:3000';
const TELAS = [
  ['celular', 390, 844, true],
  ['monitor', 1920, 1080, false],
];

const { mkdir } = await import('node:fs/promises');
const pw = await import(process.env.PLAYWRIGHT || 'playwright');
const { chromium } = pw.default ?? pw;

await mkdir(SAIDA, { recursive: true });
const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
  args: ['--no-proxy-server'],
});

for (const [nome, largura, altura, celular] of TELAS) {
  const pagina = await nav.newPage({
    viewport: { width: largura, height: altura },
    isMobile: celular,
    hasTouch: celular,
  });
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

  /*
   * 1. A MESA VAZIA — e vazia de verdade.
   *
   * A rodada solo fica guardada no servidor, então ao entrar de novo a mesa volta com as
   * fichas da vez passada (que é o comportamento certo, e é o que a conferência de
   * reconexão prova). Pro retrato, isso dava uma "mesa vazia" com duas pilhas em cima.
   * Aqui a mesa é limpa ANTES do primeiro clique.
   */
  for (const rotulo of [/Tirar minhas fichas/i, /Limpar a mesa/i]) {
    const botao = pagina.getByRole('button', { name: rotulo }).first();
    /* Desligado quer dizer "não há o que limpar" — que já é o estado que queremos. */
    if ((await botao.count()) && (await botao.isEnabled())) {
      await botao.click();
      await pagina.waitForTimeout(800);
    }
  }
  await pagina.screenshot({ path: `${SAIDA}/${nome}-1-mesa-vazia.png` });

  /* 2. com aposta encostada nas duas casas que mais mudam de tamanho */
  await pagina.getByLabel(/^Apostar (em|no|na) .*Ases/i).first().click();
  await pagina.waitForTimeout(400);
  await pagina.getByLabel(/^Apostar (em|no|na) .*Grande/i).first().click();
  await pagina.waitForTimeout(900);
  await pagina.screenshot({ path: `${SAIDA}/${nome}-2-com-aposta.png` });

  /* 3. depois de lançar: o dado parado na face e o placar embaixo */
  const confirmar = pagina.getByRole('button', { name: /Confirmar/i }).first();
  if (await confirmar.count()) {
    await confirmar.click();
    await pagina.waitForTimeout(1200);
  }
  const lancar = pagina.getByRole('button', { name: /Lançar|Jogar novamente/i }).first();
  if (await lancar.count()) {
    await lancar.click();
    await pagina.waitForTimeout(9000);
  }
  await pagina.screenshot({ path: `${SAIDA}/${nome}-3-depois-do-lance.png` });

  console.log(`ok   ${nome}: três retratos em ${SAIDA}/`);
  await pagina.close();
}

await nav.close();
