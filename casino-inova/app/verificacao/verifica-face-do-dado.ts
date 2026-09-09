/**
 * O DADO PARA NA FACE QUE O SERVIDOR SORTEOU — no lançamento do Bac Bo.
 *
 * Esta conferência existe porque o defeito apareceu na tela: os quatro dados assentavam
 * mostrando a mesma face, sempre a 1, enquanto o texto embaixo dizia outro resultado. É
 * o tipo de erro que a animação esconde — ela continua bonita, e só quem olha o dado E o
 * texto ao mesmo tempo percebe que os dois discordam.
 *
 * O motor é chamado aqui EXATAMENTE como a tela do Bac Bo o chama: um lançamento por
 * dado, dentro da cápsula em pé, com o sopro desligando em tempos diferentes e o número
 * de quadros igualado entre os quatro. Qualquer diferença nesses parâmetros já mudaria o
 * que está sendo conferido.
 */
import { Arena, GIRO_DA_FACE, faceVirada, lancarDados } from '../src/fisica/motorDeDados';

const arena: Arena = { formato: 'caixa', emPe: true, raioX: 1.2, raioY: 3.4 };

/* --- 0. o cubo é um cubo: faces opostas somam 7 --- */
/*
 * É a regra que define um dado de verdade, e é a que ninguém confere porque parece
 * óbvia. Ela não é: o cubo aqui é descrito por uma tabela de orientações
 * (`GIRO_DA_FACE`), e nada nessa tabela obriga o 1 a ficar do lado oposto ao 6 — obriga
 * quem a escreveu. Um dado com 2 e 5 na mesma aresta pareceria certo parado e erraria
 * em toda rolagem.
 *
 * A prova: girar 180° em torno de um eixo troca uma face pela oposta. Então a face que
 * aparece ao virar o dado de cabeça pra baixo (rx + 180) tem que ser a que soma 7 com
 * a de cima, e o mesmo ao virá-lo de lado (ry + 180).
 */
{
  let erradas = 0;
  for (const [face, giro] of Object.entries(GIRO_DA_FACE)) {
    const n = Number(face);
    const porCima = faceVirada(giro.rx + 180, giro.ry);
    const porLado = faceVirada(giro.rx, giro.ry + 180);
    /* Uma das duas viradas mostra a oposta; a outra mostra uma das quatro laterais. */
    const opostas = [porCima, porLado].filter((f) => f + n === 7);
    if (opostas.length === 0) {
      erradas += 1;
      console.log(`FALHA a face oposta ao ${n} não soma 7 (virando dá ${porCima} e ${porLado})`);
    }
  }
  console.log(
    erradas === 0
      ? 'ok   faces opostas somam 7: 1-6, 2-5, 3-4 — o cubo é um cubo'
      : `FALHA ${erradas} face(s) sem oposta correta`,
  );
  if (erradas > 0) process.exit(1);
}

let erros = 0;
let conferidos = 0;
const primeirosErros: string[] = [];

for (let lance = 1; lance <= 60; lance += 1) {
  const desligaEm = [40, 62, 84, 106];
  const total = Math.max(...desligaEm) + 30;
  for (let i = 0; i < 4; i += 1) {
    const face = ((lance * 7 + i * 3) % 6) + 1;
    const caminho = lancarDados({
      faces: [face],
      arena,
      semente: lance * 6151 + face * (i + 1) * 17 + i,
      entrada: { x: 0, y: 0, z: 1 },
      agitarAte: [desligaEm[i]],
      quadrosFixos: total,
    }).caminhos[0];

    const ultimo = caminho[caminho.length - 1];
    const viu = faceVirada(ultimo.rx, ultimo.ry);
    conferidos += 1;
    if (viu !== face) {
      erros += 1;
      if (primeirosErros.length < 6) {
        primeirosErros.push(
          `lance ${lance}, dado ${i}: pedi ${face}, parou em ${viu} (rx ${ultimo.rx.toFixed(1)}, ry ${ultimo.ry.toFixed(1)}, quadros ${caminho.length})`,
        );
      }
    }
  }
}

for (const linha of primeirosErros) console.log(`FALHA ${linha}`);
console.log(
  erros === 0
    ? `ok   ${conferidos} dados: todos param na face que o servidor sorteou.`
    : `FALHA ${erros} de ${conferidos} pararam na face errada`,
);
process.exit(erros === 0 ? 0 : 1);
