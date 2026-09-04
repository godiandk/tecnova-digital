/**
 * A BARRA DE NÍVEL BATE COM A ARTE DELA?
 *
 * Esta conferência existe porque o mesmo defeito foi relatado três vezes: o número do
 * nível saindo encostado na borda do brasão, meio escondido atrás dos louros, e a barra
 * dourada começando no lugar errado. As duas correções anteriores foram feitas com
 * medidas tomadas à mão em cima da imagem ampliada — e as duas erraram por pouco, que
 * numa barra de 1200 pixels é o bastante pra ler como torto.
 *
 * O jeito de isso parar é medir por programa e comparar com o que o componente usa. As
 * constantes do LevelBar.tsx são lidas do próprio arquivo, então mexer nelas sem medir
 * de novo quebra esta conferência na hora.
 *
 * O QUE É MEDIDO, na hud-barra-nivel.png (800x120):
 *
 *   O CANAL   — o maior grupo contíguo de pixels escuros. É a calha onde o
 *               preenchimento corre. Antes o app achava que ela era a imagem inteira, e
 *               a barra dourada passava POR CIMA do brasão.
 *
 *   O BRASÃO  — o segundo maior. É o vão redondo e escuro onde o número do nível é
 *               escrito. O centro dele é o único lugar certo pro número.
 *
 * Sem dependências: o PNG é decodificado aqui mesmo (zlib do próprio Node), porque uma
 * conferência que precisa de biblioteca instalada é uma conferência que ninguém roda.
 */
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const ARTE = join(AQUI, '..', 'assets', 'images', 'interface', 'hud-barra-nivel.png');
const PREENCHIMENTO = join(AQUI, '..', 'assets', 'images', 'interface', 'hud-barra-nivel-preenchimento.png');
const COMPONENTE = join(AQUI, '..', 'src', 'components', 'LevelBar.tsx');

/** Lê um PNG RGBA de 8 bits sem biblioteca: cabeçalho, dados e os cinco filtros. */
function lerPng(caminho) {
  const arquivo = readFileSync(caminho);
  let i = 8; // pula a assinatura
  let largura = 0;
  let altura = 0;
  let canais = 4;
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
        throw new Error(`${caminho}: só sei ler PNG de 8 bits RGB ou RGBA (veio cor ${tipoDeCor}/${profundidade})`);
      }
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
      let valor = linha[x];
      if (filtro === 1) valor += a;
      else if (filtro === 2) valor += b;
      else if (filtro === 3) valor += (a + b) >> 1;
      else if (filtro === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        valor += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      pixels[y * porLinha + x] = valor & 0xff;
    }
  }
  return { largura, altura, canais, pixels };
}

/** Os grupos contíguos de pixels que passam no teste, do maior pro menor. */
function grupos(img, passa) {
  const { largura, altura, canais, pixels } = img;
  const marca = new Int32Array(largura * altura).fill(-1);
  const achados = [];
  for (let p = 0; p < largura * altura; p += 1) {
    if (marca[p] !== -1) continue;
    const base = p * canais;
    if (!passa(pixels[base], pixels[base + 1], pixels[base + 2], canais === 4 ? pixels[base + 3] : 255)) continue;
    // varredura em largura, com pilha própria: recursão estoura em imagem grande
    const grupo = { area: 0, x0: largura, x1: 0, y0: altura, y1: 0, somaX: 0, somaY: 0 };
    const pilha = [p];
    marca[p] = achados.length;
    while (pilha.length) {
      const q = pilha.pop();
      const x = q % largura;
      const y = (q / largura) | 0;
      grupo.area += 1;
      grupo.somaX += x;
      grupo.somaY += y;
      if (x < grupo.x0) grupo.x0 = x;
      if (x > grupo.x1) grupo.x1 = x;
      if (y < grupo.y0) grupo.y0 = y;
      if (y > grupo.y1) grupo.y1 = y;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const vx = x + dx;
        const vy = y + dy;
        if (vx < 0 || vy < 0 || vx >= largura || vy >= altura) continue;
        const v = vy * largura + vx;
        if (marca[v] !== -1) continue;
        const b = v * canais;
        if (!passa(pixels[b], pixels[b + 1], pixels[b + 2], canais === 4 ? pixels[b + 3] : 255)) continue;
        marca[v] = achados.length;
        pilha.push(v);
      }
    }
    achados.push(grupo);
  }
  return achados.sort((a, b) => b.area - a.area);
}

function constante(fonte, nome) {
  const achado = fonte.match(new RegExp(`const ${nome} = ([\\d.]+)`));
  if (!achado) throw new Error(`não achei ${nome} no LevelBar.tsx`);
  return Number(achado[1]);
}

let falhas = 0;
function confere(titulo, medido, usado, folga) {
  const ok = Math.abs(medido - usado) <= folga;
  if (!ok) falhas += 1;
  console.log(
    `${ok ? 'ok  ' : 'FALHA'} ${titulo}: a arte diz ${medido.toFixed(4)}, o componente usa ${usado.toFixed(4)}` +
      (ok ? '' : ` — passou da folga de ${folga}`),
  );
}

const calha = lerPng(ARTE);
const escuro = (r, g, b, a) => a > 200 && r < 70 && g < 70 && b < 70;
const [canal, brasao] = grupos(calha, escuro);

const fonte = readFileSync(COMPONENTE, 'utf8');

console.log(`arte: ${calha.largura}x${calha.altura}`);
console.log(`canal medido:  x ${canal.x0}..${canal.x1}  y ${canal.y0}..${canal.y1}`);
console.log(`brasão medido: x ${brasao.x0}..${brasao.x1}  y ${brasao.y0}..${brasao.y1}\n`);

/*
 * O centro do brasão é a MÉDIA dos pixels dele, e não o meio da caixa que o envolve.
 * Num disco dá no mesmo; a média é usada porque não depende de o recorte ser simétrico.
 */
confere('centro do brasão em x', brasao.somaX / brasao.area / calha.largura, constante(fonte, 'BRASAO_X'), 0.004);
confere('centro do brasão em y', brasao.somaY / brasao.area / calha.altura, constante(fonte, 'BRASAO_Y'), 0.01);
confere(
  'diâmetro do brasão',
  (brasao.x1 - brasao.x0 + 1) / calha.largura,
  constante(fonte, 'BRASAO_TAMANHO'),
  0.006,
);
confere('início do canal', canal.x0 / calha.largura, constante(fonte, 'CANAL_INICIO'), 0.004);
confere('fim do canal', canal.x1 / calha.largura, constante(fonte, 'CANAL_FIM'), 0.004);

/*
 * E o número tem que caber DENTRO do vão, sem encostar no anel dourado: é o defeito que
 * se via na tela, o "2" grudado no louro da direita.
 */
const meioDoBrasao = brasao.somaX / brasao.area;
const sobraEsquerda = meioDoBrasao - brasao.x0;
const sobraDireita = brasao.x1 - meioDoBrasao;
const simetrico = Math.abs(sobraEsquerda - sobraDireita) < 3;
console.log(
  `${simetrico ? 'ok  ' : 'FALHA'} o centro fica no meio do vão: sobram ${sobraEsquerda.toFixed(1)}px à esquerda e ${sobraDireita.toFixed(1)}px à direita`,
);
if (!simetrico) falhas += 1;

const faixa = lerPng(PREENCHIMENTO);
const opaco = (r, g, b, a) => a > 10;
const [tinta] = grupos(faixa, opaco);
console.log(
  `\ninformativo — a faixa de preenchimento ocupa x ${tinta.x0}..${tinta.x1}, y ${tinta.y0}..${tinta.y1} ` +
    `(${tinta.y1 - tinta.y0 + 1}px de altura dentro de um canal de ${canal.y1 - canal.y0 + 1}px)`,
);

console.log(falhas === 0 ? '\nOK: a barra de nível bate com a arte dela.' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
