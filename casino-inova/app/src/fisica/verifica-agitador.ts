import { lancarDados, faceVirada, QUADROS_POR_SEGUNDO } from './motorDeDados';

/**
 * Confere que o dado NÃO SAI DA CÁPSULA — em toda tela, em toda arte.
 *
 *   npx tsc --outDir /tmp/fis --module commonjs --target es2020 --skipLibCheck \
 *     src/fisica/motorDeDados.ts src/fisica/verifica-agitador.ts && node /tmp/fis/verifica-agitador.js
 *
 * Este arquivo existe por causa de um defeito que só apareceu olhando a tela: o dado
 * atravessava o vidro do agitador do Bac Bo. A causa não era a física — era o TAMANHO:
 * o dado era 5% da largura do tampo, escolhido sozinho, e o vidro tem 5,2%. O dado
 * preenchia o tubo inteiro, e qualquer arredondamento o punha do lado de fora.
 *
 * A correção foi derivar o tamanho do dado DA CÁPSULA. Este script confere que a conta
 * fecha em toda tela que alguém possa usar, das duas artes, e não só na que eu testei.
 */
const DADO_DENTRO_DO_VIDRO = 0.58;

/** As duas artes, com o vidro medido em cada uma. */
const ARTES = [
  { nome: 'deitada 16:9', vidro: { largura: 0.052, topo: 0.209, base: 0.324 }, proporcao: 9 / 16 },
  { nome: 'em pé 9:16', vidro: { largura: 0.107, topo: 0.236, base: 0.306 }, proporcao: 2778 / 1284 },
];

/** Larguras de tampo que aparecem de verdade: celular pequeno até monitor grande. */
const LARGURAS = [320, 375, 390, 430, 700, 834, 1024, 1280, 1440, 1920, 2560];

let problemas = 0;
const falhar = (m: string) => { problemas += 1; console.log(`FALHOU: ${m}`); };

for (const arte of ARTES) {
  console.log(`\n=== ${arte.nome} ===`);
  for (const largura of LARGURAS) {
    const altura = largura * arte.proporcao;
    const tamanho = Math.max(10, arte.vidro.largura * largura * DADO_DENTRO_DO_VIDRO);
    const escala = tamanho / 2;

    const raioX = (arte.vidro.largura * largura) / 2 / escala;
    const raioY = ((arte.vidro.base - arte.vidro.topo) * altura) / 2 / escala;

    // O dado tem raio 1: a cápsula precisa ser MAIOR que isso, com folga.
    if (raioX < 1.15) falhar(`${arte.nome} em ${largura}px: cápsula de raio ${raioX.toFixed(2)} — o dado quase não cabe`);
    if (raioY < 1.15) falhar(`${arte.nome} em ${largura}px: altura de raio ${raioY.toFixed(2)} — o dado quase não cabe`);

    // E a física tem que respeitar isso, em muitos lançamentos.
    let fora = 0;
    let noAr = 0;
    let faceErrada = 0;
    const desliga = [54, 87, 120, 153];
    for (let semente = 1; semente <= 60; semente += 1) {
      const faces = [1 + (semente % 6), 1 + ((semente * 3) % 6), 1 + ((semente * 5) % 6), 1 + ((semente * 7) % 6)];
      /*
       * UM LANÇAMENTO POR DADO, e não os quatro juntos.
       *
       * Cada dado está no PRÓPRIO tubo de vidro: eles não se veem e não podem se
       * encostar. Simulando os quatro na mesma arena, o motor tratava eles como
       * estando na mesma caixa e os separava quando se sobrepunham — e essa separação
       * empurrava um pra fora da parede. Foi o que este script mediu.
       */
      const caminhos = faces.map((face, i) =>
        lancarDados({
          faces: [face],
          arena: { formato: 'caixa', raioX, raioY, emPe: true },
          semente: semente * 31 + i,
          entrada: { x: 0, y: 0, z: 1 },
          agitarAte: [desliga[i]],
          quadrosFixos: Math.max(...desliga) + 48,
        }).caminhos[0],
      );
      for (let i = 0; i < caminhos.length; i += 1) {
        const fim = caminhos[i][caminhos[i].length - 1];
        if (faceVirada(fim.rx, fim.ry) !== faces[i]) faceErrada += 1;
        if (fim.y < Math.max(0.05, raioY - 1) - 0.05) noAr += 1;
        for (const q of caminhos[i]) {
          // Em PIXEL, que é o que a tela mostra: o dado inteiro tem que caber no vidro.
          const bordaX = Math.abs(q.x) * escala + tamanho / 2;
          const bordaY = Math.abs(q.y) * escala + tamanho / 2;
          /*
           * A folga é 1% do dado, e não meio pixel: encostar na parede é o certo (a
           * física prende o dado exatamente ali), e meio pixel de tolerância reprovava o
           * toque legítimo por arredondamento em tela grande.
           */
          const folga = tamanho * 0.01;
          if (bordaX > (arte.vidro.largura * largura) / 2 + folga) fora += 1;
          if (bordaY > ((arte.vidro.base - arte.vidro.topo) * altura) / 2 + folga) fora += 1;
        }
      }
    }

    const folgaX = ((raioX - 1) * escala).toFixed(1);
    console.log(
      `  ${String(largura).padStart(4)}px: vidro ${(arte.vidro.largura * largura).toFixed(0)}px, ` +
      `dado ${tamanho.toFixed(0)}px, folga ${folgaX}px de cada lado` +
      (fora + noAr + faceErrada > 0 ? `  <<< ${fora} fora, ${noAr} no ar, ${faceErrada} face errada` : '  ok'),
    );
    if (fora > 0) falhar(`${arte.nome} em ${largura}px: ${fora} quadros com o dado atravessando o vidro`);
    if (noAr > 0) falhar(`${arte.nome} em ${largura}px: ${noAr} dados terminaram flutuando`);
    if (faceErrada > 0) falhar(`${arte.nome} em ${largura}px: ${faceErrada} dados na face errada`);
  }
}

console.log(
  problemas === 0
    ? `\nTUDO OK — o dado cabe e fica dentro do vidro em ${LARGURAS.length} tamanhos de tela, nas duas artes.`
    : `\n${problemas} PROBLEMA(S).`,
);
process.exit(problemas === 0 ? 0 : 1);
