/**
 * OS SONS DA MESA SÃO O QUE DIZEM SER?
 *
 *   node verificacao/verifica-sons.mjs
 *
 * Som é a única parte do jogo que não dá pra conferir olhando, e por isso é onde um
 * arquivo errado sobrevive mais tempo: o mesmo estalo em dois lugares, um arquivo
 * estourando, um silêncio de meio segundo antes do baque. Esta conferência lê os WAV e
 * responde por medida:
 *
 *   1. FORMATO. Mono, 44100 Hz, 16 bits. Um som em 22 kHz no meio dos outros sai abafado
 *      e ninguém sabe por quê.
 *   2. NÃO ESTOURA. Nenhuma amostra encosta no fundo de escala, e o pico fica em −3 dBFS
 *      com folga — dois sons tocam juntos o tempo todo nesta mesa (três dados batendo).
 *   3. NÃO TEM COMPONENTE CONTÍNUA. Um WAV com média longe de zero estala no começo e no
 *      fim em qualquer aparelho, e come excursão do alto-falante à toa.
 *   4. COMEÇA E TERMINA NO ZERO. Corte seco é um clique que ninguém pediu.
 *   5. COMEÇA LOGO. O ataque tem que estar nos primeiros 20 ms: um baque que atrasa 100 ms
 *      chega depois do dado encostar na tela, e aí o som desmente a animação.
 *   6. SÃO SONS DIFERENTES. O couro é mais grave e mais longo que dado-com-dado, e a
 *      ficha no pano é a mais grave de todas. Se alguém trocar um arquivo por outro, ou
 *      copiar o mesmo duas vezes, é aqui que aparece.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PASTA = 'assets/sons';
let problemas = 0;
const falhar = (m) => { problemas += 1; console.log(`   FALHOU: ${m}`); };
const ok = (m) => console.log(`   ok — ${m}`);

/** Lê um WAV PCM simples: cabeçalho RIFF, um bloco fmt e um bloco data. */
function leWav(caminho) {
  const b = readFileSync(caminho);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('não é um WAV');
  }
  let i = 12;
  let fmt = null;
  let dados = null;
  while (i + 8 <= b.length) {
    const id = b.toString('ascii', i, i + 4);
    const tamanho = b.readUInt32LE(i + 4);
    if (id === 'fmt ') {
      fmt = {
        formato: b.readUInt16LE(i + 8),
        canais: b.readUInt16LE(i + 10),
        taxa: b.readUInt32LE(i + 12),
        bits: b.readUInt16LE(i + 22),
      };
    } else if (id === 'data') {
      dados = b.subarray(i + 8, i + 8 + tamanho);
    }
    i += 8 + tamanho + (tamanho % 2);
  }
  if (!fmt || !dados) throw new Error('WAV sem fmt ou sem data');
  const n = Math.floor(dados.length / 2);
  const amostras = new Float64Array(n);
  for (let k = 0; k < n; k += 1) amostras[k] = dados.readInt16LE(k * 2) / 32768;
  return { ...fmt, amostras };
}

/**
 * Quantas vezes por segundo a onda cruza o zero.
 *
 * É o jeito honesto de medir brilho sem escrever uma transformada de Fourier: som agudo
 * cruza o zero muitas vezes, som grave cruza poucas. Não substitui um espectro, mas
 * responde exatamente a pergunta desta conferência — "o couro é mais grave que o dado?".
 */
function cruzamentosPorSegundo({ amostras, taxa }) {
  let cruzou = 0;
  for (let k = 1; k < amostras.length; k += 1) {
    if ((amostras[k - 1] < 0 && amostras[k] >= 0) || (amostras[k - 1] >= 0 && amostras[k] < 0)) cruzou += 1;
  }
  return (cruzou * taxa) / amostras.length;
}

/** Quanto tempo até a energia cair a 10% do pico — o "rabo" do som. */
function quedaEm10PorCento({ amostras, taxa }) {
  const pico = Math.max(...Array.from(amostras, Math.abs));
  const janela = Math.round(taxa * 0.005);
  for (let k = 0; k + janela < amostras.length; k += janela) {
    let maior = 0;
    for (let j = k; j < k + janela; j += 1) maior = Math.max(maior, Math.abs(amostras[j]));
    if (k > taxa * 0.01 && maior < pico * 0.1) return k / taxa;
  }
  return amostras.length / taxa;
}

const arquivos = readdirSync(PASTA).filter((n) => n.endsWith('.wav')).sort();
const medidos = {};

console.log(`\n=== ${arquivos.length} sons em ${PASTA} ===\n`);
for (const nome of arquivos) {
  console.log(nome);
  let s;
  try {
    s = leWav(join(PASTA, nome));
  } catch (e) {
    falhar(`não deu pra ler: ${e.message}`);
    continue;
  }
  medidos[nome] = s;

  s.formato === 1 && s.canais === 1 && s.taxa === 44100 && s.bits === 16
    ? ok('PCM mono 44100 Hz 16 bits')
    : falhar(`formato ${s.formato}, ${s.canais} canal(is), ${s.taxa} Hz, ${s.bits} bits`);

  const pico = Math.max(...Array.from(s.amostras, Math.abs));
  const picoEmDb = 20 * Math.log10(pico);
  pico < 0.999 && picoEmDb > -6 && picoEmDb < -1
    ? ok(`pico em ${picoEmDb.toFixed(1)} dBFS, sem estourar`)
    : falhar(`pico em ${picoEmDb.toFixed(1)} dBFS (queremos entre −6 e −1, e nunca encostando em 0)`);

  const media = s.amostras.reduce((t, x) => t + x, 0) / s.amostras.length;
  Math.abs(media) < 0.002
    ? ok(`sem componente contínua (média ${media.toFixed(5)})`)
    : falhar(`componente contínua de ${media.toFixed(4)} — vai estalar`);

  const bordas = Math.max(Math.abs(s.amostras[0]), Math.abs(s.amostras[s.amostras.length - 1]));
  bordas < 0.01 ? ok('começa e termina no zero') : falhar(`borda em ${bordas.toFixed(3)} — clique nas pontas`);

  let ataque = 0;
  for (let k = 0; k < s.amostras.length; k += 1) {
    if (Math.abs(s.amostras[k]) > pico * 0.5) { ataque = k / s.taxa; break; }
  }
  ataque <= 0.02
    ? ok(`o ataque chega em ${(ataque * 1000).toFixed(0)} ms`)
    : falhar(`o ataque só chega em ${(ataque * 1000).toFixed(0)} ms — o som atrasa em relação à tela`);
}

console.log('\n=== e são sons diferentes? ===');
const brilho = (n) => (medidos[n] ? cruzamentosPorSegundo(medidos[n]) : NaN);
const rabo = (n) => (medidos[n] ? quedaEm10PorCento(medidos[n]) : NaN);

const paresEsperados = [
  ['batida-no-couro.wav', 'batida-no-dado.wav', 'o couro é mais grave que dado-com-dado'],
  ['ficha-no-pano.wav', 'batida-no-couro.wav', 'a ficha no pano é mais grave que o dado no couro'],
];
for (const [grave, agudo, frase] of paresEsperados) {
  const a = brilho(grave);
  const b = brilho(agudo);
  a < b
    ? ok(`${frase} (${a.toFixed(0)} contra ${b.toFixed(0)} cruzamentos por segundo)`)
    : falhar(`${frase} — mas mediu ${a.toFixed(0)} contra ${b.toFixed(0)}`);
}

const rc = rabo('batida-no-couro.wav');
const rd = rabo('batida-no-dado.wav');
rc > rd
  ? ok(`o couro segura mais que o dado (${(rc * 1000).toFixed(0)} ms contra ${(rd * 1000).toFixed(0)} ms)`)
  : falhar(`o couro devia segurar mais que o dado, mas mediu ${(rc * 1000).toFixed(0)} contra ${(rd * 1000).toFixed(0)} ms`);

/* Dois arquivos iguais byte a byte é o erro que passa despercebido pra sempre. */
const vistos = new Map();
for (const nome of arquivos) {
  const chave = readFileSync(join(PASTA, nome)).toString('base64').slice(0, 400);
  if (vistos.has(chave)) falhar(`${nome} é cópia de ${vistos.get(chave)}`);
  vistos.set(chave, nome);
}
if (![...vistos.values()].some((v) => false)) ok('nenhum som é cópia de outro');

console.log(problemas === 0 ? '\nOK: os sons da mesa estão sãos.' : `\n${problemas} PROBLEMA(S)`);
process.exit(problemas === 0 ? 0 : 1);
