/**
 * OS ARCOS DA BANCA FRANCESA BATEM COM A ARTE?
 *
 *   node verificacao/verifica-arcos-da-banca.mjs
 *
 * `src/data/arcosDaBanca.ts` diz onde estão os dois arcos de cada casa, os discos da
 * linha, a plaqueta dos Ases, as palavras, os algarismos, o brasão e a tigela. Esta
 * conferência REFAZ a medição inteira na imagem e compara número a número. Ela reprova
 * (exit 1) se qualquer fração divergir mais que 0,004 — que é 7,7 px na largura e 4,3 px
 * na altura da arte de 1920x1080.
 *
 * POR QUE ELA MEDE DE NOVO EM VEZ DE COMPARAR COM UMA CÓPIA DA TABELA. Uma conferência
 * que confere a tabela contra ela mesma só prova que alguém copiou igual. Esta aqui
 * refaz a máscara de dourado, segue os traços coluna a coluna e reajusta as elipses,
 * partindo dos pixels. Se a arte for trocada, ela acusa; se alguém "arrumar" um número
 * no .ts sem medir, ela acusa.
 *
 * ── POR QUE EXISTE UM PNG AQUI DENTRO ────────────────────────────────────────────────
 *
 * A arte é `.webp`, e o Node não sabe abrir WebP sem biblioteca. Instalar uma só pra
 * conferência seria dependência nova, e conferência que precisa de instalação é
 * conferência que ninguém roda. Então a arte foi convertida UMA VEZ, em Python, pra
 * `banca-francesa-1920x1080.png` — PNG sem perda, os MESMOS pixels (conferido:
 * `np.array_equal` entre o webp decodificado e o png decodificado dá True). O PNG é
 * decodificado aqui à mão com o `zlib` do próprio Node, no mesmo esquema de
 * `verifica-barra-de-nivel.mjs`.
 *
 * O preço disso é o PNG pesar 2,5 MB, contra 470 KB do webp: é o custo de uma foto de
 * feltro em formato sem perda, não tem como espremer. O que evita ele apodrecer é o
 * PASSO 0 abaixo: os dois arquivos têm o sha256 anotado, e a conferência confere os
 * dois. Se alguém trocar a arte e esquecer do PNG (ou o contrário), ela reprova dizendo
 * exatamente o que fazer.
 *
 * Pra regerar o PNG depois de trocar a arte:
 *
 *   python3 -c "from PIL import Image; \
 *     Image.open('assets/images/tampos-16x9/computador/banca-francesa.webp') \
 *          .convert('RGB').save('verificacao/banca-francesa-1920x1080.png', compress_level=9)"
 *
 * e depois refaça as medidas e atualize os dois sha256 daqui.
 *
 * ── O QUE ELA NÃO REPROVA ────────────────────────────────────────────────────────────
 *
 * No fim ela imprime AVISOS comparando a arte com o que o `mapaDosTampos.ts` diz hoje
 * (as caixas de aposta, `TIGELA_DA_BANCA` e as listas `ARCO_DO_GRANDE`/`ARCO_DO_PEQUENO`).
 * Esses avisos NÃO reprovam, de propósito: o mapa é outro arquivo, a correção dele é
 * decisão de quem integra, e uma conferência que fica vermelha por causa de uma dívida
 * conhecida vira uma conferência que todo mundo aprende a ignorar. Quando o mapa for
 * corrigido, é só transformar os avisos em conferências.
 */
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const WEBP = join(AQUI, '..', 'assets', 'images', 'tampos-16x9', 'computador', 'banca-francesa.webp');
const PNG = join(AQUI, 'banca-francesa-1920x1080.png');
const DADOS = join(AQUI, '..', 'src', 'data', 'arcosDaBanca.ts');
const MAPA = join(AQUI, '..', 'src', 'data', 'mapaDosTampos.ts');

const SHA_WEBP = 'ebee727d1158d3c6298870f53fc89bc9c886236226fbe883a732c46b9b7d40c4';
const SHA_PNG = '7018871a5d45066e48444c94e8387038c3040c43524ba4bf10fb66c85c89890e';

/** Folga de toda fração. 0,004 da arte = 7,7 px de largura, 4,3 px de altura. */
const FOLGA = 0.004;
/** Folga de ângulo. 0,2° no maior raio (0,51 da largura) move a ponta 0,0018 da largura. */
const FOLGA_ANGULO = 0.2;
/** Folga dos erros de ajuste, que estão gravados com 2 casas. */
const FOLGA_ERRO = 0.02;

let falhas = 0;
const ok = (m) => console.log(`ok    ${m}`);
const falhar = (m) => {
  falhas += 1;
  console.log(`FALHOU: ${m}`);
};

function confere(titulo, medido, gravado, folga = FOLGA, unidade = '') {
  const d = Math.abs(medido - gravado);
  if (d <= folga) {
    ok(`${titulo}: arte ${medido.toFixed(5)}${unidade}, arquivo ${gravado.toFixed(5)}${unidade} (dif ${d.toFixed(5)})`);
  } else {
    falhar(
      `${titulo}: a arte diz ${medido.toFixed(5)}${unidade} e o arquivo diz ${gravado.toFixed(5)}${unidade}` +
        ` — dif ${d.toFixed(5)}, passou da folga de ${folga}`,
    );
  }
}

// ══════════════════════════════════════════════════════ PNG à mão (zlib do próprio Node)
function lerPng(caminho) {
  const arquivo = readFileSync(caminho);
  let i = 8;
  let largura = 0;
  let altura = 0;
  let canais = 3;
  const pedacos = [];
  while (i < arquivo.length) {
    const tamanho = arquivo.readUInt32BE(i);
    const tipo = arquivo.toString('ascii', i + 4, i + 8);
    const dados = arquivo.subarray(i + 8, i + 8 + tamanho);
    if (tipo === 'IHDR') {
      largura = dados.readUInt32BE(0);
      altura = dados.readUInt32BE(4);
      const profundidade = dados[8];
      const tipoDeCor = dados[9];
      if (profundidade !== 8 || (tipoDeCor !== 6 && tipoDeCor !== 2)) {
        throw new Error(`${caminho}: só sei ler PNG de 8 bits RGB ou RGBA (veio ${tipoDeCor}/${profundidade})`);
      }
      if (dados[12] !== 0) throw new Error(`${caminho}: PNG entrelaçado, não sei ler`);
      canais = tipoDeCor === 6 ? 4 : 3;
    } else if (tipo === 'IDAT') {
      pedacos.push(dados);
    } else if (tipo === 'IEND') {
      break;
    }
    i += 12 + tamanho;
  }
  const cru = inflateSync(Buffer.concat(pedacos));
  const porLinha = largura * canais;
  const pixels = Buffer.alloc(altura * porLinha);
  for (let y = 0; y < altura; y += 1) {
    const filtro = cru[y * (porLinha + 1)];
    const linha = cru.subarray(y * (porLinha + 1) + 1, (y + 1) * (porLinha + 1));
    for (let x = 0; x < porLinha; x += 1) {
      const a = x >= canais ? pixels[y * porLinha + x - canais] : 0;
      const b = y > 0 ? pixels[(y - 1) * porLinha + x] : 0;
      const c = x >= canais && y > 0 ? pixels[(y - 1) * porLinha + x - canais] : 0;
      let v = linha[x];
      if (filtro === 1) v += a;
      else if (filtro === 2) v += b;
      else if (filtro === 3) v += (a + b) >> 1;
      else if (filtro === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      pixels[y * porLinha + x] = v & 0xff;
    }
  }
  return { largura, altura, canais, pixels };
}

// ═══════════════════════════════════════════════════════════ máscaras e componentes
/** Máscara booleana a partir de um teste (r,g,b). */
function mascara(img, passa) {
  const { largura, altura, canais, pixels } = img;
  const m = new Uint8Array(largura * altura);
  for (let p = 0; p < largura * altura; p += 1) {
    const b = p * canais;
    if (passa(pixels[b], pixels[b + 1], pixels[b + 2])) m[p] = 1;
  }
  return m;
}

/**
 * Componentes conexas (8 vizinhos) dentro da janela [x0,x1) x [y0,y1).
 * Devolve o mapa de rótulos e, pra cada componente, área e os pixels em ordem de
 * varredura (linha por linha, esquerda pra direita) — a mesma ordem do numpy, que é o
 * que faz o "primeiro mínimo" dos cantos da plaqueta cair no mesmo pixel.
 */
function componentes(m, L, A, x0, x1, y0, y1) {
  const rot = new Int32Array(L * A).fill(0);
  const achadas = [];
  const pilha = new Int32Array(L * A);
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const p = y * L + x;
      if (!m[p] || rot[p] !== 0) continue;
      const id = achadas.length + 1;
      let topo = 0;
      pilha[topo++] = p;
      rot[p] = id;
      let area = 0;
      while (topo > 0) {
        const q = pilha[--topo];
        area += 1;
        const qx = q % L;
        const qy = (q / L) | 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            const vx = qx + dx;
            const vy = qy + dy;
            if (vx < x0 || vy < y0 || vx >= x1 || vy >= y1) continue;
            const v = vy * L + vx;
            if (!m[v] || rot[v] !== 0) continue;
            rot[v] = id;
            pilha[topo++] = v;
          }
        }
      }
      achadas.push({ id, area });
    }
  }
  return { rot, achadas };
}

/** Os pixels de um conjunto de rótulos, em ordem de varredura. */
function pixelsDe(rot, L, x0, x1, y0, y1, aceita) {
  const xs = [];
  const ys = [];
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const r = rot[y * L + x];
      if (r !== 0 && aceita(r)) {
        xs.push(x);
        ys.push(y);
      }
    }
  }
  return { xs, ys };
}

// ═══════════════════════════════════════════════════════════════════ ajustes fechados
/** Resolve A·z = b por eliminação de Gauss com pivô parcial. */
function resolve(A, b) {
  const n = b.length;
  const M = A.map((linha, i) => [...linha, b[i]]);
  for (let c = 0; c < n; c += 1) {
    let melhor = c;
    for (let r = c + 1; r < n; r += 1) if (Math.abs(M[r][c]) > Math.abs(M[melhor][c])) melhor = r;
    const t = M[c];
    M[c] = M[melhor];
    M[melhor] = t;
    for (let r = c + 1; r < n; r += 1) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k += 1) M[r][k] -= f * M[c][k];
    }
  }
  const z = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r -= 1) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k += 1) s -= M[r][k] * z[k];
    z[r] = s / M[r][r];
  }
  return z;
}

/** Mínimos quadrados de colunas → coeficientes, pelas equações normais. */
function minimosQuadrados(colunas, alvo) {
  const n = colunas.length;
  const A = Array.from({ length: n }, () => new Array(n).fill(0));
  const b = new Array(n).fill(0);
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      let s = 0;
      for (let k = 0; k < alvo.length; k += 1) s += colunas[i][k] * colunas[j][k];
      A[i][j] = s;
    }
    let s = 0;
    for (let k = 0; k < alvo.length; k += 1) s += colunas[i][k] * alvo[k];
    b[i] = s;
  }
  return resolve(A, b);
}

/** Centra e escala como o numpy do medidor: média fora, dividido pelo maior desvio. */
function normaliza(px, py) {
  const n = px.length;
  const mx = px.reduce((a, v) => a + v, 0) / n;
  const my = py.reduce((a, v) => a + v, 0) / n;
  const dp = (v, m) => Math.sqrt(v.reduce((a, k) => a + (k - m) * (k - m), 0) / n);
  const s = Math.max(dp(px, mx), dp(py, my));
  return { u: px.map((v) => (v - mx) / s), v: py.map((v) => (v - my) / s), mx, my, s };
}

/** Círculo: u²+v²+Du+Ev+F=0. */
function ajustaCirculo(px, py) {
  const { u, v, mx, my, s } = normaliza(px, py);
  const um = u.map(() => 1);
  const alvo = u.map((a, i) => -(a * a + v[i] * v[i]));
  const [D, E, F] = minimosQuadrados([u, v, um], alvo);
  const cu = -D / 2;
  const cv = -E / 2;
  const r = Math.sqrt(cu * cu + cv * cv - F);
  const cx = cu * s + mx;
  const cy = cv * s + my;
  const rr = r * s;
  let soma = 0;
  let pior = 0;
  for (let i = 0; i < px.length; i += 1) {
    const d = Math.abs(Math.hypot(px[i] - cx, py[i] - cy) - rr);
    soma += d;
    if (d > pior) pior = d;
  }
  return { tipo: 'circulo', cx, cy, rx: rr, ry: rr, medio: soma / px.length, pior };
}

/** Distância geométrica ponto→elipse, varrendo 4096 ângulos (igual ao medidor). */
function distanciaElipse(px, py, cx, cy, rx, ry) {
  const n = 4096;
  const ex = new Float64Array(n);
  const ey = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = (2 * Math.PI * i) / n;
    ex[i] = cx + rx * Math.cos(t);
    ey[i] = cy + ry * Math.sin(t);
  }
  const fora = new Float64Array(px.length);
  for (let k = 0; k < px.length; k += 1) {
    let melhor = Infinity;
    for (let i = 0; i < n; i += 1) {
      const dx = px[k] - ex[i];
      const dy = py[k] - ey[i];
      const d = dx * dx + dy * dy;
      if (d < melhor) melhor = d;
    }
    fora[k] = Math.sqrt(melhor);
  }
  return fora;
}

/** Elipse alinhada aos eixos: u²+Cv²+Du+Ev+F=0. */
function ajustaElipse(px, py) {
  const { u, v, mx, my, s } = normaliza(px, py);
  const vv = v.map((k) => k * k);
  const um = u.map(() => 1);
  const alvo = u.map((k) => -(k * k));
  const [C, D, E, F] = minimosQuadrados([vv, u, v, um], alvo);
  const cu = -D / 2;
  const cv = -E / (2 * C);
  const r2 = cu * cu + C * cv * cv - F;
  const cx = cu * s + mx;
  const cy = cv * s + my;
  const rx = Math.sqrt(r2) * s;
  const ry = Math.sqrt(r2 / C) * s;
  const d = distanciaElipse(px, py, cx, cy, rx, ry);
  let soma = 0;
  let pior = 0;
  for (const k of d) {
    soma += k;
    if (k > pior) pior = k;
  }
  return { tipo: 'elipse', cx, cy, rx, ry, medio: soma / px.length, pior };
}

/** Escolhe o modelo que descreve melhor — é o mesmo critério do medidor. */
function escolhe(px, py) {
  const ci = ajustaCirculo(px, py);
  const el = ajustaElipse(px, py);
  const esc = el.medio < ci.medio ? { ...el } : { ...ci };
  let a0 = Infinity;
  let a1 = -Infinity;
  for (let i = 0; i < px.length; i += 1) {
    const t = (Math.atan2((py[i] - esc.cy) / esc.ry, (px[i] - esc.cx) / esc.rx) * 180) / Math.PI;
    if (t < a0) a0 = t;
    if (t > a1) a1 = t;
  }
  esc.a0 = a0;
  esc.a1 = a1;
  esc.x0 = Math.min(...px);
  esc.x1 = Math.max(...px);
  esc.n = px.length;
  esc.circulo = ci;
  esc.elipse = el;
  return esc;
}

// ══════════════════════════════════════════════════════════ varredura e traçado
function corridas(m, L, x, y0, y1) {
  const out = [];
  let y = y0;
  while (y < y1) {
    if (m[y * L + x]) {
      const ini = y;
      while (y < y1 && m[y * L + x]) y += 1;
      out.push([ini, y - ini]);
    } else {
      y += 1;
    }
  }
  return out;
}

/**
 * Segue um traço fino coluna a coluna. Só aceita corrida de até `espMax` px (é o que
 * joga fora letra e algarismo, que são manchas grossas), prevê o próximo y pela
 * inclinação recente e atravessa lacuna extrapolando, até `maxLacuna` colunas seguidas
 * sem achar nada.
 */
function tracar(m, L, y0j, y1j, x0, y0, passo, xFim, espMax, tol, maxLacuna) {
  const pts = [[x0, y0]];
  let incl = 0;
  let falhasSeguidas = 0;
  let grossas = 0;
  let yAnt = y0;
  let x = x0;
  for (;;) {
    x += passo;
    if ((passo > 0 && x > xFim) || (passo < 0 && x < xFim)) break;
    const prev = yAnt + incl * passo;
    const cands = [];
    let teveGrossa = false;
    for (const [ini, tam] of corridas(m, L, x, y0j, y1j)) {
      if (tam > espMax) {
        teveGrossa = true;
        continue;
      }
      cands.push(ini + (tam - 1) / 2);
    }
    if (teveGrossa) grossas += 1;
    let esc = null;
    if (cands.length) {
      let melhor = cands[0];
      for (const c of cands) if (Math.abs(c - prev) < Math.abs(melhor - prev)) melhor = c;
      if (Math.abs(melhor - prev) <= tol) esc = melhor;
    }
    if (esc === null) {
      falhasSeguidas += 1;
      if (falhasSeguidas > maxLacuna) break;
      yAnt = prev;
      continue;
    }
    falhasSeguidas = 0;
    incl = 0.7 * incl + 0.3 * ((esc - yAnt) / passo);
    yAnt = esc;
    pts.push([x, esc]);
  }
  return { pts, grossas };
}

/**
 * Tira o BICO RETO da ponta da casa. O arco é monótono do ápice pra cada lado; o bico
 * vira pro outro lado. Andando do ápice pra fora, para quando o y sobe mais de 1 px — a
 * folga de 1 px absorve o arredondamento de meio pixel do centro da corrida e nada além
 * disso; com 2 px a varredura entra seis colunas no bico (ver o arcosDaBanca.ts).
 */
function apararNoBico(pts, xApice) {
  const ordenado = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const esq = ordenado.filter((p) => p[0] <= xApice);
  const dir = ordenado.filter((p) => p[0] > xApice);
  const fica = [];
  let lim = esq.length ? esq[esq.length - 1][1] : 0;
  for (let i = esq.length - 1; i >= 0; i -= 1) {
    if (esq[i][1] > lim + 1) break;
    lim = Math.min(lim, esq[i][1]);
    fica.push(esq[i]);
  }
  lim = dir.length ? dir[0][1] : 0;
  for (const p of dir) {
    if (p[1] > lim + 1) break;
    lim = Math.min(lim, p[1]);
    fica.push(p);
  }
  fica.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return { arco: fica, noBico: ordenado.length - fica.length };
}

// ══════════════════════════════════════════════════ ler os objetos do TypeScript
/** Tira comentários pra o casamento de chaves não tropeçar num `{` escrito em prosa. */
function semComentarios(fonte) {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

/** Extrai o literal de `export const NOME = { ... }` (ou `[ ... ]`) e o avalia. */
function leObjeto(fonte, nome) {
  const limpo = semComentarios(fonte);
  const marca = new RegExp(`(?:export\\s+)?const\\s+${nome}\\s*(?::[^=]+)?=\\s*`);
  const achou = limpo.match(marca);
  if (!achou) throw new Error(`não achei ${nome}`);
  let i = achou.index + achou[0].length;
  const abre = limpo[i];
  const fecha = abre === '{' ? '}' : ']';
  let nivel = 0;
  let fim = i;
  for (; fim < limpo.length; fim += 1) {
    if (limpo[fim] === abre) nivel += 1;
    else if (limpo[fim] === fecha) {
      nivel -= 1;
      if (nivel === 0) break;
    }
  }
  // eslint-disable-next-line no-new-func
  return new Function(`return (${limpo.slice(i, fim + 1)});`)();
}

// ══════════════════════════════════════════════════════════════════════════ o trabalho
console.log('=== PASSO 0: a arte é a mesma que foi medida? ===');
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const shaWebp = sha(WEBP);
const shaPng = sha(PNG);
if (shaWebp === SHA_WEBP) ok('a arte .webp é a que foi medida');
else
  falhar(
    `a arte .webp MUDOU (sha256 ${shaWebp.slice(0, 16)}…, esperado ${SHA_WEBP.slice(0, 16)}…). ` +
      'Refaça o PNG desta pasta, refaça as medidas e atualize os sha256 e o arcosDaBanca.ts.',
  );
if (shaPng === SHA_PNG) ok('o PNG desta pasta é a cópia sem perda da arte medida');
else
  falhar(
    `o PNG desta pasta MUDOU (sha256 ${shaPng.slice(0, 16)}…, esperado ${SHA_PNG.slice(0, 16)}…). ` +
      'Ver o cabeçalho deste arquivo pra regerar.',
  );

const img = lerPng(PNG);
const L = img.largura;
const A = img.altura;
const OURO = mascara(img, (r, g, b) => r > 85 && r - b > 30 && g > 55);
let dourados = 0;
for (const v of OURO) dourados += v;
console.log(`\narte ${L}x${A}, ${dourados} pixels dourados (${((100 * dourados) / (L * A)).toFixed(2)}%)`);
if (L !== 1920 || A !== 1080) falhar(`a arte deveria ser 1920x1080 e veio ${L}x${A}`);

const fonte = readFileSync(DADOS, 'utf8');
const ARCOS = leObjeto(fonte, 'ARCOS_DA_BANCA');
const CIRCULOS = leObjeto(fonte, 'CIRCULOS_DA_LINHA');
const PONTAS = leObjeto(fonte, 'PONTAS_DAS_CASAS');
const PLAQUETA = leObjeto(fonte, 'PLAQUETA_DOS_ASES');
const LETREIROS = leObjeto(fonte, 'LETREIROS');
const TIGELA = leObjeto(fonte, 'TIGELA_MEDIDA');

const fx = (v) => v / L;
const fy = (v) => v / A;

// ─────────────────────────────────────────────────── 1. os discos da linha
console.log('\n=== PASSO 1: os dois discos da LINHA ===');
const JANELA_DISCO = {
  grande: [0.45, 0.55, 0.41, 0.53],
  pequeno: [0.45, 0.55, 0.6, 0.73],
};
for (const casa of ['grande', 'pequeno']) {
  const [a, b, c, d] = JANELA_DISCO[casa];
  const x0 = Math.floor(a * L);
  const x1 = Math.floor(b * L);
  const y0 = Math.floor(c * A);
  const y1 = Math.floor(d * A);
  const { rot, achadas } = componentes(OURO, L, A, x0, x1, y0, y1);
  const maior = achadas.reduce((m, k) => (k.area > m.area ? k : m));
  const { xs, ys } = pixelsDe(rot, L, x0, x1, y0, y1, (r) => r === maior.id);
  const esc = escolhe(xs, ys);
  const g = CIRCULOS[casa];
  console.log(
    `\n-- disco do ${casa}: ${xs.length} pixels; círculo erra ${esc.circulo.medio.toFixed(2)}px em média, ` +
      `elipse ${esc.elipse.medio.toFixed(2)}px — usou ${esc.tipo}`,
  );
  confere(`disco do ${casa}: centro.x`, fx(esc.cx), g.centro.x);
  confere(`disco do ${casa}: centro.y`, fy(esc.cy), g.centro.y);
  confere(`disco do ${casa}: raioX`, fx(esc.rx), g.raioX);
  confere(`disco do ${casa}: raioY`, fy(esc.ry), g.raioY);
  confere(`disco do ${casa}: deX`, fx(esc.x0), g.deX);
  confere(`disco do ${casa}: ateX`, fx(esc.x1), g.ateX);
  confere(`disco do ${casa}: erro médio`, esc.medio, g.erroMedioEmPixels, FOLGA_ERRO, 'px');
  confere(`disco do ${casa}: pior erro`, esc.pior, g.erroPiorEmPixels, FOLGA_ERRO, 'px');
  if (esc.n === g.pontos) ok(`disco do ${casa}: ${g.pontos} pixels no ajuste`);
  else falhar(`disco do ${casa}: o ajuste usou ${esc.n} pixels e o arquivo diz ${g.pontos}`);
}

// ─────────────────────────────────────────────────── 2. os seis arcos
console.log('\n=== PASSO 2: os seis arcos ===');
const CASAS = {
  grande: { jan: [0.32, 0.512], xe: 0.215, xd: 0.785, fora: 0.4009, dentro: 0.488 },
  pequeno: { jan: [0.47, 0.73], xe: 0.105, xd: 0.895, fora: 0.5944, dentro: 0.6861 },
};
const SEMENTES = [0.4063, 0.5885];
const AREA_MINIMA_DA_FAIXA = Math.floor((1500 * (L * A)) / (1920 * 1080));
const tracados = {};

for (const casa of ['grande', 'pequeno']) {
  const cfg = CASAS[casa];
  const y0j = Math.floor(cfg.jan[0] * A);
  const y1j = Math.floor(cfg.jan[1] * A);
  const xe = Math.floor(cfg.xe * L);
  const xd = Math.floor(cfg.xd * L);
  const { rot, achadas } = componentes(OURO, L, A, xe, xd + 1, y0j, y1j);
  const grandes = new Set(achadas.filter((k) => k.area >= AREA_MINIMA_DA_FAIXA).map((k) => k.id));
  const manchas = achadas.length - grandes.size;
  const pixelsManchas = achadas.filter((k) => !grandes.has(k.id)).reduce((s, k) => s + k.area, 0);
  const faixa = new Uint8Array(L * A);
  for (let y = y0j; y < y1j; y += 1) {
    for (let x = xe; x < xd + 1; x += 1) {
      const p = y * L + x;
      if (rot[p] !== 0 && grandes.has(rot[p])) faixa[p] = 1;
    }
  }
  console.log(
    `\n-- ${casa}: a peneira de componente (>= ${AREA_MINIMA_DA_FAIXA}px) tirou ${manchas} manchas ` +
      `(${pixelsManchas}px de letra, algarismo e disco) e deixou ${grandes.size} metades de faixa`,
  );
  if (grandes.size !== 2) falhar(`${casa}: a peneira deveria deixar 2 metades de faixa e deixou ${grandes.size}`);

  const esp = Math.max(4, Math.round((6 * A) / 1080));
  const tol = esp;
  const lac = Math.max(20, Math.round((40 * A) / 1080));
  tracados[casa] = {};
  for (const nome of ['fora', 'dentro']) {
    const vistos = new Set();
    const brutos = [];
    let grossas = 0;
    for (const sx of SEMENTES) {
      const xi = Math.round(sx * L);
      const alvo = cfg[nome] * A;
      let yi = null;
      for (const [ini, tam] of corridas(faixa, L, xi, y0j, y1j)) {
        if (tam > esp) continue;
        const c = ini + (tam - 1) / 2;
        if (yi === null || Math.abs(c - alvo) < Math.abs(yi - alvo)) yi = c;
      }
      if (yi === null || Math.abs(yi - alvo) >= (10 * A) / 1080) {
        falhar(`${casa}/${nome}: não achei o traço na coluna semente x=${xi}`);
        continue;
      }
      for (const [passo, fim] of [
        [-1, xe],
        [1, xd],
      ]) {
        const r = tracar(faixa, L, y0j, y1j, xi, yi, passo, fim, esp, tol, lac);
        grossas += r.grossas;
        for (const p of r.pts) {
          const chave = `${p[0]}|${p[1]}`;
          if (!vistos.has(chave)) {
            vistos.add(chave);
            brutos.push(p);
          }
        }
      }
    }
    brutos.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const previa = ajustaCirculo(
      brutos.map((p) => p[0]),
      brutos.map((p) => p[1]),
    );
    const { arco, noBico } = apararNoBico(brutos, previa.cx);
    const px = arco.map((p) => p[0]);
    const py = arco.map((p) => p[1]);
    const esc = escolhe(px, py);
    tracados[casa][nome] = arco;
    const g = ARCOS[casa][nome];
    console.log(
      `\n   ${casa}/${nome}: ${brutos.length} colunas seguidas, ${noBico} do bico reto, ` +
        `${arco.length} no ajuste, ${grossas} colunas com corrida grossa recusada`,
    );
    console.log(
      `   círculo erra ${esc.circulo.medio.toFixed(2)}px (pior ${esc.circulo.pior.toFixed(2)}px), ` +
        `elipse ${esc.elipse.medio.toFixed(2)}px (pior ${esc.elipse.pior.toFixed(2)}px) — usou ${esc.tipo}`,
    );
    confere(`${casa}/${nome}: centro.x`, fx(esc.cx), g.centro.x);
    confere(`${casa}/${nome}: centro.y`, fy(esc.cy), g.centro.y);
    confere(`${casa}/${nome}: raioX`, fx(esc.rx), g.raioX);
    confere(`${casa}/${nome}: raioY`, fy(esc.ry), g.raioY);
    confere(`${casa}/${nome}: deAngulo`, esc.a0, g.deAngulo, FOLGA_ANGULO, '°');
    confere(`${casa}/${nome}: ateAngulo`, esc.a1, g.ateAngulo, FOLGA_ANGULO, '°');
    confere(`${casa}/${nome}: deX`, fx(esc.x0), g.deX);
    confere(`${casa}/${nome}: ateX`, fx(esc.x1), g.ateX);
    confere(`${casa}/${nome}: erro médio`, esc.medio, g.erroMedioEmPixels, FOLGA_ERRO, 'px');
    confere(`${casa}/${nome}: pior erro`, esc.pior, g.erroPiorEmPixels, FOLGA_ERRO, 'px');
    if (esc.n === g.pontos) ok(`${casa}/${nome}: ${g.pontos} pontos no ajuste`);
    else falhar(`${casa}/${nome}: o ajuste usou ${esc.n} pontos e o arquivo diz ${g.pontos}`);
  }

  // a linha dos NÚMEROS é o meio da faixa, coluna a coluna
  const pf = new Map();
  const pd = new Map();
  for (const p of tracados[casa].fora) pf.set(p[0], p[1]);
  for (const p of tracados[casa].dentro) pd.set(p[0], p[1]);
  const meioX = [];
  const meioY = [];
  for (const x of [...pf.keys()].sort((a, b) => a - b)) {
    if (!pd.has(x)) continue;
    meioX.push(x);
    meioY.push((pf.get(x) + pd.get(x)) / 2);
  }
  const esc = escolhe(meioX, meioY);
  tracados[casa].numeros = meioX.map((x, i) => [x, meioY[i]]);
  const g = ARCOS[casa].numeros;
  console.log(`\n   ${casa}/numeros (meio da faixa): ${meioX.length} colunas — usou ${esc.tipo}`);
  confere(`${casa}/numeros: centro.x`, fx(esc.cx), g.centro.x);
  confere(`${casa}/numeros: centro.y`, fy(esc.cy), g.centro.y);
  confere(`${casa}/numeros: raioX`, fx(esc.rx), g.raioX);
  confere(`${casa}/numeros: raioY`, fy(esc.ry), g.raioY);
  confere(`${casa}/numeros: deAngulo`, esc.a0, g.deAngulo, FOLGA_ANGULO, '°');
  confere(`${casa}/numeros: ateAngulo`, esc.a1, g.ateAngulo, FOLGA_ANGULO, '°');
  confere(`${casa}/numeros: deX`, fx(esc.x0), g.deX);
  confere(`${casa}/numeros: ateX`, fx(esc.x1), g.ateX);
  confere(`${casa}/numeros: erro médio`, esc.medio, g.erroMedioEmPixels, FOLGA_ERRO, 'px');
  confere(`${casa}/numeros: pior erro`, esc.pior, g.erroPiorEmPixels, FOLGA_ERRO, 'px');
  if (esc.n === g.pontos) ok(`${casa}/numeros: ${g.pontos} pontos no ajuste`);
  else falhar(`${casa}/numeros: o ajuste usou ${esc.n} pontos e o arquivo diz ${g.pontos}`);

  // as pontas (bicos) da casa
  const metades = achadas.filter((k) => grandes.has(k.id)).map((k) => k.id);
  let pe = null;
  let pdd = null;
  for (const id of metades) {
    const { xs, ys } = pixelsDe(rot, L, xe, xd + 1, y0j, y1j, (r) => r === id);
    const xmin = Math.min(...xs);
    const xmax = Math.max(...xs);
    const media = (alvo) => {
      let s = 0;
      let n = 0;
      for (let i = 0; i < xs.length; i += 1)
        if (xs[i] === alvo) {
          s += ys[i];
          n += 1;
        }
      return s / n;
    };
    if (pe === null || xmin < pe[0]) pe = [xmin, media(xmin)];
    if (pdd === null || xmax > pdd[0]) pdd = [xmax, media(xmax)];
  }
  confere(`${casa}: ponta esquerda x`, fx(pe[0]), PONTAS[casa].esquerda.x);
  confere(`${casa}: ponta esquerda y`, fy(pe[1]), PONTAS[casa].esquerda.y);
  confere(`${casa}: ponta direita x`, fx(pdd[0]), PONTAS[casa].direita.x);
  confere(`${casa}: ponta direita y`, fy(pdd[1]), PONTAS[casa].direita.y);
}

// ─────────────────────────────────────── 3. a curva gravada passa pelo traço medido?
console.log('\n=== PASSO 3: a curva GRAVADA passa por cima do traço MEDIDO? ===');
console.log('(é a conferência que mais importa: parâmetro de elipse pode deslizar, a curva não)');
for (const casa of ['grande', 'pequeno']) {
  for (const nome of ['fora', 'numeros', 'dentro']) {
    const g = ARCOS[casa][nome];
    let pior = 0;
    for (const [x, y] of tracados[casa][nome]) {
      const u = Math.min(Math.max((fx(x) - g.centro.x) / g.raioX, -1), 1);
      const yc = (g.centro.y + g.raioY * Math.sqrt(1 - u * u)) * A;
      pior = Math.max(pior, Math.abs(yc - y) / A);
    }
    if (pior <= FOLGA) ok(`${casa}/${nome}: a curva gravada fica a no máximo ${pior.toFixed(5)} do traço (${(pior * A).toFixed(2)}px)`);
    else falhar(`${casa}/${nome}: a curva gravada se afasta ${pior.toFixed(5)} do traço medido`);
  }
}

// ─────────────────────────────────────────────────── 4. a plaqueta dos Ases
console.log('\n=== PASSO 4: a plaqueta dos ASES ===');
{
  const x0 = Math.floor(0.155 * L);
  const x1 = Math.floor(0.27 * L);
  const y0 = Math.floor(0.225 * A);
  const y1 = Math.floor(0.345 * A);
  const { rot, achadas } = componentes(OURO, L, A, x0, x1, y0, y1);
  const maior = achadas.reduce((m, k) => (k.area > m.area ? k : m));
  const { xs, ys } = pixelsDe(rot, L, x0, x1, y0, y1, (r) => r === maior.id);
  const extremo = (peso) => {
    let melhor = 0;
    for (let i = 1; i < xs.length; i += 1) if (peso(xs[i], ys[i]) < peso(xs[melhor], ys[melhor])) melhor = i;
    return [xs[melhor], ys[melhor]];
  };
  const cantos = {
    superiorEsquerdo: extremo((x, y) => x + y),
    inferiorDireito: extremo((x, y) => -(x + y)),
    superiorDireito: extremo((x, y) => -(x - y)),
    inferiorEsquerdo: extremo((x, y) => x - y),
  };
  console.log(`   moldura: ${xs.length} pixels`);
  for (const [nome, [px, py]] of Object.entries(cantos)) {
    confere(`plaqueta ${nome}: x`, fx(px), PLAQUETA[nome].x);
    confere(`plaqueta ${nome}: y`, fy(py), PLAQUETA[nome].y);
  }
  confere('plaqueta caixa: esquerda', fx(Math.min(...xs)), PLAQUETA.caixa.esquerda);
  confere('plaqueta caixa: topo', fy(Math.min(...ys)), PLAQUETA.caixa.topo);
  confere('plaqueta caixa: direita', fx(Math.max(...xs)), PLAQUETA.caixa.direita);
  confere('plaqueta caixa: base', fy(Math.max(...ys)), PLAQUETA.caixa.base);
}

// ─────────────────────────────────────────────────── 5. letreiros e brasão
console.log('\n=== PASSO 5: palavras, algarismos e brasão ===');
const JANELAS_LETREIRO = {
  grande: [0.42, 0.58, 0.325, 0.375],
  pequeno: [0.405, 0.585, 0.525, 0.585],
  n14: [0.28, 0.335, 0.375, 0.44],
  n15: [0.47, 0.525, 0.375, 0.435],
  n16: [0.655, 0.71, 0.375, 0.44],
  n5: [0.225, 0.275, 0.56, 0.62],
  n6: [0.48, 0.515, 0.575, 0.63],
  n7: [0.71, 0.75, 0.565, 0.625],
};
function caixaDeLetreiro(m, jan, areaMinima, rotulo) {
  const [a, b, c, d] = jan;
  const x0 = Math.floor(a * L);
  const x1 = Math.floor(b * L);
  const y0 = Math.floor(c * A);
  const y1 = Math.floor(d * A);
  const { rot, achadas } = componentes(m, L, A, x0, x1, y0, y1);
  const fica = new Set(achadas.filter((k) => k.area >= areaMinima).map((k) => k.id));
  const { xs, ys } = pixelsDe(rot, L, x0, x1, y0, y1, (r) => fica.has(r));
  if (!xs.length) {
    falhar(`${rotulo}: não achei nada na janela`);
    return null;
  }
  const cx0 = Math.min(...xs);
  const cx1 = Math.max(...xs);
  const cy0 = Math.min(...ys);
  const cy1 = Math.max(...ys);
  // se a caixa encostou na janela, a janela é que está apertada e o número sairia cortado
  if (cx0 <= x0 || cx1 >= x1 - 1 || cy0 <= y0 || cy1 >= y1 - 1) {
    falhar(`${rotulo}: a janela de medição apertou o desenho — o número sairia cortado`);
    return null;
  }
  return { esquerda: cx0, topo: cy0, direita: cx1, base: cy1 };
}
const AREA_LETREIRO = (150 * (L * A)) / (1920 * 1080);
for (const [nome, jan] of Object.entries(JANELAS_LETREIRO)) {
  const c = caixaDeLetreiro(OURO, jan, AREA_LETREIRO, `letreiro ${nome}`);
  if (!c) continue;
  const g = nome === 'grande' || nome === 'pequeno' ? LETREIROS[nome] : LETREIROS.numeros[nome];
  confere(`letreiro ${nome}: esquerda`, fx(c.esquerda), g.esquerda);
  confere(`letreiro ${nome}: topo`, fy(c.topo), g.topo);
  confere(`letreiro ${nome}: direita`, fx(c.direita), g.direita);
  confere(`letreiro ${nome}: base`, fy(c.base), g.base);
}
{
  // o brasão é dourado apagado: filtro próprio, ver o comentário no arcosDaBanca.ts
  const APAGADO = mascara(img, (r, g, b) => r > 45 && r - b > 15 && g > 27);
  const c = caixaDeLetreiro(APAGADO, [0.44, 0.56, 0.72, 0.87], (20 * (L * A)) / (1920 * 1080), 'brasão');
  if (c) {
    confere('brasão: esquerda', fx(c.esquerda), LETREIROS.brasao.esquerda);
    confere('brasão: topo', fy(c.topo), LETREIROS.brasao.topo);
    confere('brasão: direita', fx(c.direita), LETREIROS.brasao.direita);
    confere('brasão: base', fy(c.base), LETREIROS.brasao.base);
  }
}

// ─────────────────────────────────────────────────── 6. a tigela
console.log('\n=== PASSO 6: a tigela de couro ===');
let couroMedido = null;
{
  const { rot, achadas } = componentes(OURO, L, A, 0, L, 0, A);
  const maior = achadas.reduce((m, k) => (k.area > m.area ? k : m));
  const { xs, ys } = pixelsDe(rot, L, 0, L, 0, A, (r) => r === maior.id);
  console.log(`   a maior figura dourada da mesa tem ${xs.length} pixels — é a bandeja`);
  confere('tigela moldura: esquerda', fx(Math.min(...xs)), TIGELA.moldura.esquerda);
  confere('tigela moldura: topo', fy(Math.min(...ys)), TIGELA.moldura.topo);
  confere('tigela moldura: direita', fx(Math.max(...xs)), TIGELA.moldura.direita);
  confere('tigela moldura: base', fy(Math.max(...ys)), TIGELA.moldura.base);

  const COURO = mascara(img, (r, g, b) => r > 130 && r - b < 85 && g > 105);
  const jx0 = Math.floor(0.29 * L);
  const jx1 = Math.floor(0.71 * L);
  const jy0 = Math.floor(0.09 * A);
  const jy1 = Math.floor(0.3 * A);
  const cc = componentes(COURO, L, A, jx0, jx1, jy0, jy1);
  const maiorC = cc.achadas.reduce((m, k) => (k.area > m.area ? k : m));
  const p = pixelsDe(cc.rot, L, jx0, jx1, jy0, jy1, (r) => r === maiorC.id);
  const cx0 = Math.min(...p.xs);
  const cx1 = Math.max(...p.xs);
  const cy0 = Math.min(...p.ys);
  const cy1 = Math.max(...p.ys);
  couroMedido = { esquerda: cx0, topo: cy0, direita: cx1, base: cy1 };
  confere('tigela couro: esquerda', fx(cx0), TIGELA.couro.esquerda);
  confere('tigela couro: topo', fy(cy0), TIGELA.couro.topo);
  confere('tigela couro: direita', fx(cx1), TIGELA.couro.direita);
  confere('tigela couro: base', fy(cy1), TIGELA.couro.base);

  // maior retângulo que cabe inteiro no couro (método do histograma)
  const w = cx1 - cx0 + 1;
  const h = cy1 - cy0 + 1;
  const alt = new Int32Array(w);
  let melhor = [0, 0, 0, 0, 0];
  for (let i = 0; i < h; i += 1) {
    for (let j = 0; j < w; j += 1) {
      const r = cc.rot[(cy0 + i) * L + (cx0 + j)];
      alt[j] = r === maiorC.id ? alt[j] + 1 : 0;
    }
    const pilha = [];
    for (let j = 0; j <= w; j += 1) {
      const cur = j < w ? alt[j] : 0;
      let inicio = j;
      while (pilha.length && pilha[pilha.length - 1][1] >= cur) {
        const [k, al] = pilha.pop();
        if (al * (j - k) > melhor[0]) melhor = [al * (j - k), k, j - 1, i - al + 1, i];
        inicio = k;
      }
      pilha.push([inicio, cur]);
    }
  }
  const [, j0, j1, i0, i1] = melhor;
  confere('tigela retângulo: esquerda', fx(cx0 + j0), TIGELA.retangulo.esquerda);
  confere('tigela retângulo: topo', fy(cy0 + i0), TIGELA.retangulo.topo);
  confere('tigela retângulo: direita', fx(cx0 + j1), TIGELA.retangulo.direita);
  confere('tigela retângulo: base', fy(cy0 + i1), TIGELA.retangulo.base);
}

// ─────────────────────────────── 7. avisos: o que o mapa diz hoje (NÃO reprova)
console.log('\n=== o mapaDosTampos.ts usa as medidas, ou voltou a chutar retângulo? ===');
/*
 * O MAPA USA AS MEDIDAS, ou voltou a chutar retângulo?
 *
 * Este bloco nasceu como uma lista de AVISOS: enquanto o `mapaDosTampos.ts` ainda
 * trazia caixas escritas à mão, ele só dizia o quanto elas erravam. A dívida foi paga —
 * as casas, os discos, a plaqueta e a tigela agora saem daqui — e um aviso sobre dívida
 * paga não serve pra nada. Então virou o que devia ser: uma trava.
 *
 * O que ela protege é uma regressão fácil de cometer. Alguém acha um retângulo "quase
 * certo" mais simples de ler, cola no lugar da conta, e a mesa volta a ter a caixa da
 * linha duas vezes maior que o disco impresso — que foi o defeito que apareceu na tela
 * como "a aposta na linha quase interfere na do arco". A conta some sem barulho; esta
 * conferência é o barulho.
 */
{
  const mapa = semComentarios(readFileSync(MAPA, 'utf8'));
  const bloco = (mapa.split('export const MAPA_BANCA_FRANCESA')[1] ?? '').split(
    /\n(?:export )?(?:const|function) /,
  )[0];

  const exigir = (texto, trecho, oQue) =>
    texto.includes(trecho)
      ? ok(`${oQue} sai da medição`)
      : falhar(`${oQue} NÃO sai da medição — procurei "${trecho}" e não achei`);

  exigir(bloco, 'caixa: envolveAsTiras(TIRAS_DO_GRANDE)', 'a casa do GRANDE');
  exigir(bloco, 'caixa: envolveAsTiras(TIRAS_DO_PEQUENO)', 'a casa do PEQUENO');
  exigir(bloco, 'tiras: TIRAS_DO_GRANDE', 'o toque do GRANDE');
  exigir(bloco, 'tiras: TIRAS_DO_PEQUENO', 'o toque do PEQUENO');
  exigir(bloco, 'caixa: caixaDoDisco(CIRCULOS_DA_LINHA.grande)', 'a linha do GRANDE');
  exigir(bloco, 'caixa: caixaDoDisco(CIRCULOS_DA_LINHA.pequeno)', 'a linha do PEQUENO');
  exigir(bloco, 'PLAQUETA_DOS_ASES.caixa.esquerda', 'a plaqueta dos ASES');
  exigir(mapa, 'fora: TIGELA_MEDIDA.moldura', 'a moldura da tigela');
  exigir(mapa, 'chao: TIGELA_MEDIDA.couro', 'o chão da tigela');

  /* As listas de pontos que o mapa usava pra curvar as pilhas não existem mais. */
  for (const antigo of ['ARCO_DO_GRANDE', 'ARCO_DO_PEQUENO']) {
    mapa.includes(`const ${antigo}`)
      ? falhar(`${antigo} voltou ao mapa: a curva das pilhas tem que sair do arco medido`)
      : ok(`${antigo} saiu do mapa, como devia`);
  }

  /* Nenhuma caixa da Banca Francesa pode ser um retângulo escrito à mão. */
  const escritasAMao = [...bloco.matchAll(/caixa:\s*\[\s*[\d.]/g)].length;
  escritasAMao === 0
    ? ok('nenhuma caixa da Banca Francesa é retângulo escrito à mão')
    : falhar(`${escritasAMao} caixa(s) da Banca Francesa voltaram a ser retângulo escrito à mão`);
}


console.log(
  falhas === 0
    ? '\nOK: os arcos, discos, letreiros e a tigela do arcosDaBanca.ts batem com a arte.'
    : `\n${falhas} FALHA(S)`,
);
process.exit(falhas === 0 ? 0 : 1);
