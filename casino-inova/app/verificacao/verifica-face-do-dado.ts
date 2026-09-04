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
import { Arena, faceVirada, lancarDados } from '../src/fisica/motorDeDados';

const arena: Arena = { formato: 'caixa', emPe: true, raioX: 1.2, raioY: 3.4 };

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
