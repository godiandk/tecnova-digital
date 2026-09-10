/**
 * A MEDIÇÃO DA POC.
 *
 *   PLAYWRIGHT=/caminho/playwright/index.js CHROMIUM=/caminho/chrome node medir.mjs
 *
 * Sobe um servidor de arquivos, abre cada braço nos tamanhos escolhidos, espera a cena
 * inteira rodar e colhe o que a página mediu por dentro. Mede também o que a página não
 * sabe: quantos bytes foram baixados, e quanto tempo até a cena começar a andar.
 *
 * DUAS COISAS QUE ELA NÃO MEDE, e é honesto dizer as duas antes de mostrar qualquer número:
 *
 * 1. QUALIDADE VISUAL. Nenhum número aqui diz se a antecipação do quinto rolo emociona.
 *    Por isso ela tira retratos dos dois braços no MESMO instante da cena, pra a comparação
 *    ser lado a lado e não de memória.
 *
 * 2. DESEMPENHO EM APARELHO DE VERDADE. Este contêiner NÃO TEM GPU — foi verificado, não
 *    suposto: não existe `/dev/dri`, e o Chromium cai no SwiftShader (rasterizador de
 *    software, sobre 4 núcleos) mesmo quando a aceleração é pedida à força. O número que
 *    sai daqui é CUSTO DE CPU POR QUADRO, não quadros por segundo de celular. Serve pra
 *    comparar quanto trabalho cada braço pede por quadro; NÃO serve pra dizer "vai rodar a
 *    60 no iPhone". Isso só o aparelho responde, e o roteiro pra isso está no relatório.
 *
 *    E a distorção do software tem direção conhecida: ele castiga taxa de preenchimento e
 *    MSAA muito mais do que uma GPU castiga. Ler o resultado sem isso em mente inverte a
 *    conclusão.
 */
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const RAIZ = new URL('.', import.meta.url).pathname;
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.wasm': 'application/wasm',
  '.wav': 'audio/wav', '.map': 'application/json', '.ttf': 'font/ttf',
};

const servidor = createServer(async (req, res) => {
  let caminho = join(RAIZ, normalize(decodeURIComponent(req.url.split('?')[0])));
  /* `/` e `/pasta/` viram `index.html`, como qualquer servidor de arquivos faz. */
  if (caminho.endsWith('/')) caminho = join(caminho, 'index.html');
  try {
    const dados = await readFile(caminho);
    res.writeHead(200, { 'content-type': TIPOS[extname(caminho)] ?? 'application/octet-stream' });
    res.end(dados);
  } catch {
    res.writeHead(404).end('não achei');
  }
});
await new Promise((ok) => servidor.listen(0, ok));
const PORTA = servidor.address().port;

const pw = await import(process.env.PLAYWRIGHT || 'playwright');
const { chromium } = pw.default ?? pw;
const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
  args: ['--no-proxy-server', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});

/** Onde estamos rodando de verdade — pra o relatório não poder mentir sobre isso. */
async function ondeEstamosRodando() {
  const p = await nav.newPage();
  await p.setContent('<canvas id=c></canvas>');
  const r = await p.evaluate(`(() => {
    const gl = document.getElementById('c').getContext('webgl2');
    if (!gl) return { renderizador: 'sem webgl' };
    const d = gl.getExtension('WEBGL_debug_renderer_info');
    return { renderizador: d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
  })()`);
  await p.close();
  return { ...r, porSoftware: /swiftshader|llvmpipe|software/i.test(r.renderizador) };
}
const AMBIENTE = await ondeEstamosRodando();

const TELAS = [
  ['celular', 390, 844, 2],
  ['monitor', 1920, 1080, 1],
];

/**
 * Os braços.
 *
 * O Pixi aparece TRÊS vezes de propósito. A primeira medição comparou um Pixi com MSAA de
 * quatro amostras e contador em `Text` contra um Skia sem MSAA e com glifo direto, e
 * chamou a diferença de "o Skia é mais rápido". Não era: era o preço de duas escolhas de
 * implementação. Separar as três versões é o que transforma a POC de opinião em medida.
 */
const BRACOS = [
  ['pixi', '/pixi/index.html', 'MSAA 4x + Text (o jeito ingênuo)'],
  ['pixi-sem-msaa', '/pixi/index.html?aa=0', 'sem MSAA + Text'],
  ['pixi-afinado', '/pixi/index.html?aa=0&texto=bitmap', 'sem MSAA + BitmapText (o jeito de jogo)'],
  ['skia', '/skia/index.html', 'CanvasKit, suavização analítica'],
];
const SAIDA = join(RAIZ, 'resultados');
await mkdir(SAIDA, { recursive: true });

console.log(`ambiente: ${AMBIENTE.renderizador}`);
console.log(AMBIENTE.porSoftware
  ? '  ATENÇÃO: renderização POR SOFTWARE. Os tempos abaixo são custo de CPU por quadro,\n'
    + '  não previsão de quadros por segundo em aparelho. Ver o relatório.\n'
  : '  aceleração por hardware disponível.\n');

const tudo = [];
for (const [nomeDaTela, largura, altura, densidade] of TELAS) {
  for (const [braco, caminho, comoEsta] of BRACOS) {
    const pagina = await nav.newPage({
      viewport: { width: largura, height: altura },
      deviceScaleFactor: densidade,
    });
    let baixado = 0;
    const porArquivo = {};
    pagina.on('response', async (r) => {
      let n = Number(r.headers()['content-length'] || 0);
      if (!n) { try { n = (await r.body()).length; } catch { n = 0; } }
      baixado += n;
      if (n > 1024) porArquivo[r.url().replace(/^http:\/\/[^/]+/, '').split('?')[0]] = n;
    });
    const erros = [];
    pagina.on('pageerror', (e) => erros.push(String(e).slice(0, 300)));
    pagina.on('console', (m) => {
      const t = m.text();
      /* O 404 do favicon é do navegador, não da cena. */
      if (m.type() === 'error' && !/favicon/.test(t)) erros.push(t.slice(0, 300));
    });

    const t0 = Date.now();
    await pagina.goto(`http://127.0.0.1:${PORTA}${caminho}`, { waitUntil: 'load', timeout: 60000 });
    /* "Pronto" é quando o primeiro quadro da cena foi desenhado, não quando o HTML caiu. */
    await pagina.waitForFunction('window.__resultado || performance.now() > 1500', null, { timeout: 60000 });
    const ateAndar = Date.now() - t0;

    const r = await pagina.waitForFunction('window.__resultado', null, { timeout: 60000 })
      .then((h) => h.jsonValue());

    tudo.push({
      braco, comoEsta, tela: nomeDaTela, largura, altura, densidade,
      ateAndarMs: ateAndar, baixadoKB: Math.round(baixado / 1024), porArquivo, erros, ...r,
    });
    console.log(
      `${braco.padEnd(14)} ${nomeDaTela.padEnd(8)} ` +
      `p50 ${String(r.p50).padStart(6)} · p95 ${String(r.p95).padStart(6)} · ` +
      `p99 ${String(r.p99).padStart(6)} · pior ${String(r.pior).padStart(7)} ms · ` +
      `${String(r.fps).padStart(5)} q/s · ` +
      `${String(r.perdidos).padStart(4)} viradas perdidas · ` +
      `${String(r.quadros).padStart(4)} quadros · ${String(Math.round(baixado / 1024)).padStart(5)} KB · ` +
      `até andar ${String(ateAndar).padStart(5)} ms` +
      (erros.length ? `  ERROS: ${erros[0]}` : ''),
    );
    await pagina.close();
  }
}

/*
 * SEGUNDA PASSADA: OS RETRATOS, COM O TEMPO DA CENA CONGELADO.
 *
 * Separada da medição de propósito. Na medição o tempo tem que correr de verdade, senão
 * não é desempenho; no retrato o tempo tem que estar PARADO no mesmo ponto nos dois
 * braços, senão não é comparação. Tentar as duas coisas na mesma passada foi o que
 * produziu os primeiros retratos desencontrados — meio segundo de animação de diferença,
 * um contador em 3.233 e o outro em 2.746, lado a lado como se fosse o mesmo instante.
 */
const INSTANTES = [
  [2000, 'girando'],
  [4000, 'primeira-linha'],
  [5600, 'big-win'],
];
for (const [nomeDaTela, largura, altura, densidade] of TELAS) {
  for (const [braco, caminho] of BRACOS) {
    for (const [quando, comoChamar] of INSTANTES) {
      const pagina = await nav.newPage({
        viewport: { width: largura, height: altura },
        deviceScaleFactor: densidade,
      });
      const juncao = caminho.includes('?') ? '&' : '?';
      await pagina.goto(`http://127.0.0.1:${PORTA}${caminho}${juncao}t=${quando}`, { waitUntil: 'load', timeout: 60000 });
      /* Três quadros desenhados: o primeiro carrega shader e textura, e não vale retrato. */
      await pagina.waitForFunction('window.__quadrosDesenhados >= 3', null, { timeout: 60000 });
      await pagina.screenshot({ path: join(SAIDA, `${comoChamar}-${nomeDaTela}-${braco}.png`) });
      await pagina.close();
    }
  }
}

await writeFile(join(SAIDA, 'medidas.json'), JSON.stringify({ ambiente: AMBIENTE, medidas: tudo }, null, 2));
await nav.close();
servidor.close();
console.log(`\nmedidas em ${join(SAIDA, 'medidas.json')} e retratos ao lado`);
