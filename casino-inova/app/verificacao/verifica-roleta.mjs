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
/*
 * O caminho do playwright vem do ambiente (PLAYWRIGHT) porque ele não é dependência do
 * app: é ferramenta de conferência, e instalar um navegador dentro do projeto pra isso
 * pesaria em toda instalação. Sem ele, esta conferência não roda — e é por isso que ela
 * fica fora do `verify:tudo`, que tem que rodar em qualquer máquina.
 */
const pw = await import(process.env.PLAYWRIGHT || 'playwright');
const { chromium } = pw.default ?? pw;

const CASAS = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const PASSO = 360 / CASAS.length;

const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-proxy-server'] });
const p = await (await b.newContext({ viewport: { width: 430, height: 900 } })).newPage();
await p.goto(process.env.APP_URL || 'http://localhost:8081', { waitUntil: 'networkidle', timeout: 180000 });
await p.waitForTimeout(3500);

/*
 * Entra com uma conta que já existe, em vez de criar uma. O cadastro passou a pedir
 * nome, apelido, data de nascimento e o aceite dos termos — e uma conferência que
 * precisa preencher um formulário de cinco campos quebra a cada mudança de tela, sem
 * que nada da roleta tenha mudado.
 */
const email = process.env.CONTA || 'wly.vianna@gmail.com';
const senha = process.env.SENHA || 'senha-de-teste-123';
await p.locator('input').first().fill(email);
await p.locator('input').nth(1).fill(senha);
await p.getByText('Entrar', { exact: true }).last().click();
await p.waitForTimeout(6000);

await p.getByLabel('Roleta — contra a casa').click();
await p.waitForTimeout(3000);
for (const r of ['Entendi', 'Fechar', 'Começar']) {
  const x = p.getByText(r, { exact: false }).first();
  if (await x.isVisible().catch(() => false)) { await x.click(); await p.waitForTimeout(600); break; }
}

let ok = 0, falhas = 0;
for (let rodada = 1; rodada <= 5; rodada++) {
  /*
   * Uma ficha no pano antes de girar. A mesa não roda a bola sem aposta — como a de
   * verdade não roda: uma rodada sem ficha em jogo suja o placar com um resultado que
   * não custou nada a ninguém.
   */
  await p.getByLabel('Vermelho. Paga 2 vezes', { exact: false }).first().click();
  await p.waitForTimeout(400);
  await p.getByText(/^Girar ·/).first().click();
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

/*
 * E a bola tem que ter CAÍDO na casa, não ficado boiando na pista de fora. Os dois
 * raios foram medidos na arte da roda: as casas pintadas ocupam de 0,464 a 0,714 do
 * raio, e a pista de madeira em volta vai de 0,75 a 0,89.
 */
const raioDaBola = await p.evaluate(() => {
  const roda = document.querySelector('img[src*="roda-roleta"]');
  if (!roda) return null;
  const caixa = roda.getBoundingClientRect();
  const centro = { x: caixa.left + caixa.width / 2, y: caixa.top + caixa.height / 2 };
  /*
   * O RAIO SAI DO `offsetWidth`, e não da caixa desenhada.
   *
   * A roda está girada, e `getBoundingClientRect` de um quadrado girado devolve a caixa
   * ALINHADA AOS EIXOS que o envolve — que cresce até 1,41 vez quando ele está a 45°.
   * Medindo por ela, uma bola parada no lugar certo parecia estar mais pra dentro do que
   * está, e o número dançava de rodada pra rodada conforme o ângulo em que a roda
   * parava. O `offsetWidth` é o tamanho do layout, de antes das transformações, e é
   * constante.
   */
  const diametro = roda.offsetWidth || caixa.width;
  // A bola é o único elemento pequeno e claro dentro da área da roda.
  const candidatos = [...document.querySelectorAll('div')].filter((e) => {
    const r = e.getBoundingClientRect();
    if (r.width < 6 || r.width > 24 || Math.abs(r.width - r.height) > 2) return false;
    const cor = getComputedStyle(e).backgroundColor;
    return /247, 243, 232/.test(cor);
  });
  if (candidatos.length !== 1) return null;
  const r = candidatos[0].getBoundingClientRect();
  const d = Math.hypot(r.left + r.width / 2 - centro.x, r.top + r.height / 2 - centro.y);
  return d / (diametro / 2);
});
if (raioDaBola === null) {
  console.log('não achei a bola pra medir onde ela parou — conferência do raio pulada');
} else {
  const caiu = raioDaBola > 0.44 && raioDaBola < 0.74;
  console.log(`${caiu ? 'OK' : 'ERRADO'}  a bola parou a ${raioDaBola.toFixed(3)} do raio (as casas vão de 0,464 a 0,714; a pista fica em 0,75+)`);
  if (!caiu) falhas += 1;
}
await b.close();
process.exit(falhas ? 1 : 0);
