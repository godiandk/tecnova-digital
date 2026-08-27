/**
 * Prova que a roda da roleta para na casa que o servidor sorteou.
 *
 * Por que existe: a animação da roda é a única parte do app que pode MENTIR em silêncio.
 * Se a ordem das casas em RodaDaRoleta.tsx sair de sincronia com a arte, o número
 * escrito continua certo e a roda para na casa errada — ninguém percebe olhando, e o
 * jogo passa a mostrar uma coisa e pagar outra.
 *
 * Como rodar (com o servidor e o expo web de pé):
 *   node verificacao/verifica-roleta.mjs
 *
 * O caminho do Chromium vem do ambiente; num outro computador, aponte CHROMIUM pro
 * navegador local.
 */
import pw from 'playwright';
const { chromium } = pw;

const CASAS = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const PASSO = 360 / CASAS.length;

const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const p = await (await b.newContext({ viewport: { width: 430, height: 900 } })).newPage();
await p.goto(process.env.APP_URL || 'http://localhost:8081', { waitUntil: 'networkidle', timeout: 180000 });
await p.getByText('Criar conta', { exact: true }).first().click();
const c = p.locator('input');
await c.nth(0).fill('Roleta'); await c.nth(1).fill(`r${Date.now()}@inova.local`); await c.nth(2).fill('senha-de-teste-visual');
await p.getByText('Criar conta', { exact: true }).last().click();
await p.waitForTimeout(6000);
await p.locator('img[src*="cartaz-roleta"]').first().click();
await p.waitForTimeout(3000);
for (const r of ['Entendi','Fechar','Começar']) {
  const x = p.getByText(r, { exact: false }).first();
  if (await x.isVisible().catch(()=>false)) { await x.click(); await p.waitForTimeout(600); break; }
}

let ok = 0, falhas = 0;
for (let rodada = 1; rodada <= 5; rodada++) {
  await p.getByText('Girar', { exact: true }).first().click();
  await p.waitForTimeout(5200);

  // O número que o app diz que saiu.
  const texto = await p.getByText(/Caiu no \d+/).first().innerText().catch(() => '');
  const numero = Number((texto.match(/Caiu no (\d+)/) || [])[1]);

  // O ângulo em que a roda de fato parou.
  // Sobe a árvore até achar o elemento que de fato carrega a rotação: o react-native-web
  // embrulha o <img> em divs próprias, então o pai direto tem transform nenhuma.
  const graus = await p.evaluate(() => {
    let no = document.querySelector('img[src*="roda-roleta"]');
    while (no) {
      const t = getComputedStyle(no).transform;
      if (t && t !== 'none') {
        const m = new DOMMatrixReadOnly(t);
        const a = (Math.atan2(m.b, m.a) * 180) / Math.PI;
        if (Math.abs(a) > 0.01) return a;
      }
      no = no.parentElement;
    }
    return 0;
  });

  const esperado = CASAS.indexOf(numero) * PASSO;      // quanto a casa está do topo
  const real = ((-graus % 360) + 360) % 360;            // quanto a roda girou, normalizado
  const erro = Math.min(Math.abs(real - esperado), 360 - Math.abs(real - esperado));

  const passou = erro < PASSO / 2;
  console.log(`rodada ${rodada}: saiu ${numero} · casa esperada a ${esperado.toFixed(1)}° · roda parou a ${real.toFixed(1)}° · erro ${erro.toFixed(2)}° ${passou ? 'OK' : 'ERRADO'}`);
  passou ? ok++ : falhas++;
}
console.log(`\n${ok} certas, ${falhas} erradas — tolerância: meia casa (${(PASSO/2).toFixed(2)}°)`);
await b.close();
process.exit(falhas ? 1 : 0);
