import { Arena, GIRO_DA_FACE, faceVirada, lancarDados, QUADROS_POR_SEGUNDO } from './motorDeDados';

/**
 * Confere a física dos dados.
 *
 *   npx tsc --outDir /tmp/fis src/fisica/*.ts && node /tmp/fis/verifica-motor.js
 *
 * A pergunta que importa não é "o dado se mexe": é se o que se vê é um dado ou um truque
 * bem feito. As três coisas que separam uma coisa da outra:
 *
 * 1. O DADO PARA NA FACE QUE O SERVIDOR MANDOU. Sempre, nas seis faces, em todos os
 *    dados. Se errar uma vez em mil, a tela estará mostrando um resultado e a carteira
 *    pagando outro — o pior defeito possível num jogo de aposta.
 * 2. O DADO NÃO SAI DA TIGELA e não atravessa o outro. Física que vaza vira dado
 *    passeando por cima do feltro, e aí o jogo inteiro perde a credibilidade.
 * 3. A COLISÃO ACONTECE DE VERDADE, e cada lançamento é diferente do outro. Foi o que
 *    ele pediu: "pode colidir com os outros dados e vira pra outro lado". Se dois
 *    lançamentos derem o mesmo caminho, é animação, não dado.
 */
let problemas = 0;
const falhar = (m: string) => { problemas += 1; console.log(`FALHOU: ${m}`); };

const TIGELA: Arena = { formato: 'elipse', raioX: 7.2, raioY: 3.1 };
const AGITADOR: Arena = { formato: 'caixa', raioX: 2.4, raioY: 2.4 };

// --- 0. a tabela de faces é um dado de verdade: opostos somam 7 ---
{
  const opostos: Array<[number, number]> = [[1, 6], [2, 5], [3, 4]];
  for (const [a, b] of opostos) {
    if (a + b !== 7) falhar(`${a} e ${b} não somam 7`);
  }
  for (let face = 1; face <= 6; face += 1) {
    const giro = GIRO_DA_FACE[face];
    const vista = faceVirada(giro.rx, giro.ry);
    if (vista !== face) falhar(`o giro da face ${face} mostra a face ${vista}`);
  }
  console.log('cubo: as seis faces existem, os opostos somam 7, e cada giro mostra a face certa — ok');
}

// --- 1. o dado para na face que o servidor mandou ---
{
  let errados = 0;
  let testados = 0;
  for (let semente = 1; semente <= 3000; semente += 1) {
    const faces = [1 + (semente % 6), 1 + ((semente * 7) % 6), 1 + ((semente * 13) % 6)];
    const { caminhos } = lancarDados({ faces, arena: TIGELA, semente });
    for (let i = 0; i < faces.length; i += 1) {
      const fim = caminhos[i][caminhos[i].length - 1];
      const vista = faceVirada(fim.rx, fim.ry);
      testados += 1;
      if (vista !== faces[i]) {
        errados += 1;
        if (errados <= 3) console.log(`   semente ${semente}, dado ${i}: servidor disse ${faces[i]}, parou em ${vista}`);
      }
    }
  }
  console.log(`\nface final: ${testados.toLocaleString('pt-BR')} dados conferidos, ${errados} errados`);
  if (errados > 0) falhar(`${errados} dados pararam numa face diferente da que o servidor sorteou`);
  else console.log('  o que a tela mostra é sempre o que o servidor decidiu — ok');
}

// --- 2. ninguém sai da tigela nem atravessa o outro ---
{
  let forasDaTigela = 0;
  let atravessou = 0;
  let piorSobreposicao = 0;

  for (let semente = 1; semente <= 1500; semente += 1) {
    const { caminhos } = lancarDados({ faces: [3, 4, 5], arena: TIGELA, semente });
    const quadros = caminhos[0].length;
    for (let q = 0; q < quadros; q += 1) {
      for (let i = 0; i < caminhos.length; i += 1) {
        const a = caminhos[i][q];
        // O dado tem raio 1; a borda útil é o raio menos o raio do dado.
        const dentro = (a.x / (TIGELA.raioX - 1)) ** 2 + (a.y / (TIGELA.raioY - 1)) ** 2;
        if (dentro > 1.02) forasDaTigela += 1;

        for (let j = i + 1; j < caminhos.length; j += 1) {
          const b = caminhos[j][q];
          // No ar eles podem se cruzar vistos de cima: só conta encostados no tampo.
          if (a.z > 0.6 || b.z > 0.6) continue;
          const distancia = Math.hypot(b.x - a.x, b.y - a.y);
          if (distancia < 1.85) {
            atravessou += 1;
            piorSobreposicao = Math.max(piorSobreposicao, 2 - distancia);
          }
        }
      }
    }
  }
  console.log(`\nlimites: ${forasDaTigela} quadros com dado fora da tigela, ${atravessou} com dados dentro um do outro`);
  if (forasDaTigela > 0) falhar(`${forasDaTigela} quadros com dado fora da tigela`);
  if (atravessou > 0) falhar(`dados se atravessaram (pior sobreposição: ${piorSobreposicao.toFixed(2)} de meio dado)`);
  else console.log('  ninguém escapa da tigela e ninguém atravessa ninguém — ok');
}

// --- 3. o dado bate no outro, e nenhum lançamento repete o outro ---
{
  let comColisao = 0;
  const assinaturas = new Set<string>();
  const TOTAL = 500;

  for (let semente = 1; semente <= TOTAL; semente += 1) {
    const lance = lancarDados({ faces: [2, 2, 2], arena: TIGELA, semente });
    if (lance.colisoes > 0) comColisao += 1;
    // Onde os três dados param, arredondado: dois lançamentos iguais dariam a mesma linha.
    const parada = lance.caminhos
      .map((c) => {
        const fim = c[c.length - 1];
        return `${fim.x.toFixed(1)},${fim.y.toFixed(1)}`;
      })
      .join('|');
    assinaturas.add(parada);
  }

  const porcento = (100 * comColisao) / TOTAL;
  console.log(`\ncolisão: ${comColisao} de ${TOTAL} lançamentos tiveram dado batendo em dado (${porcento.toFixed(0)}%)`);
  if (comColisao === 0) falhar('nenhum lançamento teve colisão — os dados estão se ignorando');
  else if (porcento < 15) falhar(`só ${porcento.toFixed(0)}% dos lançamentos tiveram colisão — pouco pra parecer natural`);

  console.log(`variedade: ${assinaturas.size} posições finais diferentes em ${TOTAL} lançamentos`);
  if (assinaturas.size < TOTAL * 0.9) {
    falhar(`só ${assinaturas.size} caminhos diferentes em ${TOTAL} — está repetitivo demais pra parecer dado`);
  } else {
    console.log('  cada lançamento cai diferente do outro — ok');
  }
}

// --- 4. mesma semente, mesmo lançamento (remontar a tela não pode saltar o dado) ---
{
  const a = lancarDados({ faces: [6, 1, 3], arena: TIGELA, semente: 4242 });
  const b = lancarDados({ faces: [6, 1, 3], arena: TIGELA, semente: 4242 });
  const iguais = JSON.stringify(a.caminhos) === JSON.stringify(b.caminhos);
  if (!iguais) falhar('a mesma semente deu dois lançamentos diferentes');
  else console.log('\nrepetível: a mesma semente dá exatamente o mesmo lançamento — ok');
}

// --- 5. a energia só cai, e tudo para dentro do tempo ---
{
  let maisLongo = 0;
  let somaDuracao = 0;
  const TOTAL = 800;
  for (let semente = 1; semente <= TOTAL; semente += 1) {
    const lance = lancarDados({ faces: [1, 2, 3], arena: TIGELA, semente });
    maisLongo = Math.max(maisLongo, lance.quadros);
    somaDuracao += lance.quadros;

    // A altura máxima tem que ir diminuindo: um dado que volta mais alto do que caiu é
    // energia saindo do nada, e o olho reconhece isso na hora como errado.
    for (const caminho of lance.caminhos) {
      let picoAnterior = Infinity;
      let subindo = false;
      let pico = 0;
      for (const q of caminho) {
        if (q.z > pico) { pico = q.z; subindo = true; }
        else if (subindo && q.z === 0) {
          if (pico > picoAnterior + 0.01) falhar(`um quique subiu mais que o anterior (${pico.toFixed(2)} > ${picoAnterior.toFixed(2)})`);
          picoAnterior = pico;
          pico = 0;
          subindo = false;
        }
      }
    }
  }
  const media = somaDuracao / TOTAL / QUADROS_POR_SEGUNDO;
  console.log(`\nduração: média ${media.toFixed(2)}s, mais longo ${(maisLongo / QUADROS_POR_SEGUNDO).toFixed(2)}s`);
  if (media > 3) falhar(`média de ${media.toFixed(2)}s por lançamento — longo demais, vira espera`);
  if (media < 0.8) falhar(`média de ${media.toFixed(2)}s — rápido demais pra dar pra acompanhar`);
  console.log('  o quique sempre diminui, e o lançamento cabe no tempo de olhar — ok');
}

// --- 5b. com duração fixa, a face continua certa e a duração é exata ---
{
  const FIXO = 132; // 2,2s
  let errados = 0;
  let duracaoErrada = 0;
  for (let semente = 1; semente <= 2000; semente += 1) {
    const faces = [1 + (semente % 6), 1 + ((semente * 5) % 6), 1 + ((semente * 11) % 6)];
    const { caminhos } = lancarDados({ faces, arena: TIGELA, semente, quadrosFixos: FIXO });
    for (let i = 0; i < faces.length; i += 1) {
      if (caminhos[i].length !== FIXO) duracaoErrada += 1;
      const fim = caminhos[i][caminhos[i].length - 1];
      if (faceVirada(fim.rx, fim.ry) !== faces[i]) errados += 1;
    }
  }
  console.log(`\nduração fixa (${FIXO} quadros = ${(FIXO / QUADROS_POR_SEGUNDO).toFixed(1)}s): ${errados} faces erradas, ${duracaoErrada} caminhos com duração errada`);
  if (errados > 0) falhar(`${errados} dados pararam na face errada quando a duração foi fixada`);
  if (duracaoErrada > 0) falhar(`${duracaoErrada} caminhos não ficaram com ${FIXO} quadros`);
  if (errados === 0 && duracaoErrada === 0) console.log('  fixar a duração não estraga a face nem a conta — ok');
}

// --- 6. o agitador do Bac Bo: caixa pequena, dados presos, parada em ordem ---
{
  let fora = 0;
  for (let semente = 1; semente <= 800; semente += 1) {
    const { caminhos } = lancarDados({
      faces: [1 + (semente % 6)],
      arena: AGITADOR,
      semente,
      entrada: { x: 0, y: 0, z: 3 },
    });
    for (const q of caminhos[0]) {
      if (Math.abs(q.x) > AGITADOR.raioX - 0.98 || Math.abs(q.y) > AGITADOR.raioY - 0.98) fora += 1;
    }
  }
  console.log(`\nagitador: ${fora} quadros com o dado fora da cápsula`);
  if (fora > 0) falhar(`${fora} quadros com dado fora do agitador do Bac Bo`);
  else console.log('  o dado fica preso dentro da cápsula — ok');
}

console.log(problemas === 0 ? '\nTUDO OK — é dado, não é animação de dado.' : `\n${problemas} PROBLEMA(S).`);
process.exit(problemas === 0 ? 0 : 1);
