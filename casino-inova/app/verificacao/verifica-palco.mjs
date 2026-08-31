/**
 * Confere a conta do `contain` do TampoDaMesa: a mesa nunca pode ser cortada, nunca
 * pode passar da janela, e tem que ficar centrada. É conta de uma linha, e é
 * exatamente por isso que erro aqui passa despercebido.
 */
const PROPORCAO = 16 / 9;

function palco(janelaL, janelaA) {
  const largura = janelaL / janelaA > PROPORCAO ? janelaA * PROPORCAO : janelaL;
  const altura = largura / PROPORCAO;
  return { largura, altura, esquerda: (janelaL - largura) / 2, topo: (janelaA - altura) / 2 };
}

const TELAS = [
  ['desktop 1920x1080', 1920, 1080],
  ['desktop 2560x1440', 2560, 1440],
  ['notebook 1366x768', 1366, 768],
  ['macbook 1440x900', 1440, 900],
  ['ultrawide 3440x1440', 3440, 1440],
  ['tablet deitado 1024x768', 1024, 768],
  ['ipad deitado 1180x820', 1180, 820],
  ['janela alta 900x1200', 900, 1200],
  ['janela estreita 600x900', 600, 900],
];

let erros = 0;
for (const [nome, jl, ja] of TELAS) {
  const p = palco(jl, ja);
  const proporcao = p.largura / p.altura;
  const cabe = p.largura <= jl + 0.01 && p.altura <= ja + 0.01;
  const centrado = Math.abs(p.esquerda * 2 + p.largura - jl) < 0.01 && Math.abs(p.topo * 2 + p.altura - ja) < 0.01;
  const semDeformar = Math.abs(proporcao - PROPORCAO) < 1e-9;
  // Encosta em pelo menos um lado: senão sobrou espaço que a mesa podia ter usado.
  const encosta = Math.abs(p.largura - jl) < 0.01 || Math.abs(p.altura - ja) < 0.01;

  const ok = cabe && centrado && semDeformar && encosta;
  if (!ok) erros += 1;
  console.log(
    `${ok ? 'ok ' : 'ERRO'} ${nome.padEnd(24)} mesa ${Math.round(p.largura)}x${Math.round(p.altura)}` +
      `  sobra ${Math.round(p.esquerda)}px dos lados, ${Math.round(p.topo)}px em cima` +
      (ok ? '' : `  [cabe=${cabe} centrado=${centrado} proporcao=${semDeformar} encosta=${encosta}]`),
  );
}
console.log(erros === 0 ? '\nOK: a mesa nunca é cortada nem deformada, em nenhum tamanho.' : `\n${erros} tamanho(s) com problema.`);
process.exit(erros === 0 ? 0 : 1);
