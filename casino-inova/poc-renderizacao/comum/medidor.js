/**
 * O MEDIDOR DE QUADROS.
 *
 * Não mede "FPS médio", que é o número que mais engana em jogo: um segundo com 59
 * quadros de 10 ms e um de 400 ms dá 60 FPS de média e é uma travada que qualquer pessoa
 * vê. O que importa é a DISTRIBUIÇÃO do tempo de quadro — e principalmente a cauda.
 *
 * Por isso ele guarda todos os intervalos e reporta:
 *   p50  — o quadro típico;
 *   p95  — o quadro ruim que acontece uma vez a cada vinte;
 *   p99  — a travada;
 *   perdidos — quantas VIRADAS DE TELA foram perdidas;
 *   pior — o maior de todos.
 *
 * SOBRE "QUADRO PERDIDO", que a primeira versão desta POC contou errado.
 *
 * A conta óbvia — "passou de 16,67 ms" — não serve. Um renderizador preso ao sincronismo
 * da tela entrega intervalos empilhados EXATAMENTE em cima de 16,67: metade cai em 16,68
 * e metade em 16,66, por ruído de relógio. A primeira medição do braço Skia deu p50 de
 * 16,7 ms, p95 de 16,8 ms e "57,7% dos quadros fora do orçamento" ao mesmo tempo — três
 * números que não podem ser todos verdade, e o culpado era o limiar em cima da linha.
 *
 * Quadro perdido é quando uma VIRADA DE TELA passou em branco: um intervalo de 33 ms com
 * a tela a 60 Hz é um quadro perdido, um de 50 ms são dois. É o que a pessoa enxerga. Um
 * intervalo de 16,7 ms não é perdido nenhum — é o quadro certo, no tempo certo.
 *
 * O primeiro quadro é descartado sempre: ele carrega a compilação do shader, a subida da
 * textura e o primeiro layout, e não é representativo de nada.
 */
export function criarMedidor() {
  const intervalos = [];
  let anterior = null;
  let primeiro = true;

  return {
    quadro(agora) {
      if (anterior !== null) {
        if (primeiro) primeiro = false;
        else intervalos.push(agora - anterior);
      }
      anterior = agora;
    },
    resultado() {
      if (intervalos.length === 0) return null;
      const ordenados = [...intervalos].sort((a, b) => a - b);
      const pct = (p) => ordenados[Math.min(ordenados.length - 1, Math.floor((p / 100) * ordenados.length))];
      const orcamento = 1000 / 60;
      /*
       * Quantas viradas de tela este intervalo comeu. `round` e não `floor`: 16,68 ms
       * arredonda pra 1 virada (nenhuma perdida) e 33,2 ms pra 2 (uma perdida).
       */
      const perdidosDoIntervalo = (x) => Math.max(0, Math.round(x / orcamento) - 1);
      const perdidos = intervalos.reduce((s, x) => s + perdidosDoIntervalo(x), 0);
      const engasgos = intervalos.filter((x) => perdidosDoIntervalo(x) > 0).length;
      return {
        quadros: intervalos.length,
        p50: +pct(50).toFixed(2),
        p95: +pct(95).toFixed(2),
        p99: +pct(99).toFixed(2),
        pior: +ordenados[ordenados.length - 1].toFixed(2),
        media: +(intervalos.reduce((s, x) => s + x, 0) / intervalos.length).toFixed(2),
        /* Viradas de tela que passaram em branco, somadas. */
        perdidos,
        /* Quantos por cento dos quadros deixaram ao menos uma virada passar. */
        perdidosPorCento: +((engasgos / intervalos.length) * 100).toFixed(1),
        /* Quantos quadros por segundo a cena realmente entregou, pelo tempo total. */
        fps: +(1000 / (intervalos.reduce((s, x) => s + x, 0) / intervalos.length)).toFixed(1),
      };
    },
  };
}

/** A memória que o navegador admite estar usando, quando ele admite. */
export function memoriaAgora() {
  const m = performance.memory;
  return m ? Math.round(m.usedJSHeapSize / 1048576) : null;
}

/**
 * MOSTRA O RESULTADO NA PRÓPRIA TELA.
 *
 * Existe porque o veredito que importa não sai deste contêiner. Aqui não há GPU: o
 * Chromium cai no SwiftShader e o que se mede é custo de CPU. O número que decide tem que
 * ser colhido no aparelho de verdade — e num iPhone não dá pra rodar Playwright, então a
 * página tem que saber se contar.
 *
 * Abrir a URL no Safari do celular e ler o que aparece é o protocolo inteiro.
 */
export function mostrarNaTela(resultado, extras = {}) {
  const caixa = document.createElement('div');
  caixa.setAttribute('role', 'status');
  caixa.style.cssText = [
    'position:fixed', 'left:12px', 'right:12px', 'bottom:12px', 'z-index:9999',
    'background:rgba(6,19,8,0.94)', 'color:#e8dfd0', 'border:1px solid #cc9b65',
    'border-radius:12px', 'padding:12px 14px', 'font:13px/1.5 ui-monospace,monospace',
    'white-space:pre-wrap', 'box-shadow:0 8px 28px rgba(0,0,0,0.5)',
  ].join(';');

  const linhas = [
    `renderizador   ${resultado.renderizador}`,
    `ajustes        ${resultado.ajustes ?? '—'}`,
    `tela           ${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio || 1}x`,
    '',
    `quadro típico  ${resultado.p50} ms   (orçamento 16,67)`,
    `p95            ${resultado.p95} ms`,
    `p99            ${resultado.p99} ms`,
    `pior quadro    ${resultado.pior} ms`,
    `entregue       ${resultado.fps} quadros por segundo`,
    `viradas perdidas ${resultado.perdidos}  (${resultado.perdidosPorCento}% dos quadros)`,
    `memória JS     ${resultado.memoriaMB ?? '—'} MB`,
  ];
  for (const [k, v] of Object.entries(extras)) linhas.push(`${k.padEnd(14)} ${v}`);
  linhas.push('', 'toque para rodar de novo');
  caixa.textContent = linhas.join('\n');
  caixa.addEventListener('click', () => location.reload());
  document.body.appendChild(caixa);
}

/** O que está desenhando de verdade — software ou GPU. A resposta muda a leitura toda. */
export function quemEstaDesenhando() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return 'sem WebGL 2';
    const d = gl.getExtension('WEBGL_debug_renderer_info');
    return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  } catch { return 'não deu pra saber'; }
}
