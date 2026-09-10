/**
 * A CENA, UMA VEZ SÓ — para os dois renderizadores executarem a MESMA coisa.
 *
 * Esta é a decisão mais importante da POC. Se cada braço escrevesse a própria
 * coreografia, a comparação mediria quem escreveu melhor a animação, e não qual
 * renderizador desenha melhor. Aqui os tempos, a ordem dos eventos, o resultado sorteado
 * e a quantidade de partículas são IDÊNTICOS; o que muda é só quem põe pixel na tela.
 *
 * E ela obedece à regra da casa: A CENA NÃO SORTEIA NADA. O resultado chega pronto, do
 * jeito que o `AdaptadorDeJogo` entregaria — porque é isso que o jogo de verdade vai
 * fazer, e uma POC que sorteia na tela estaria medindo um jogo que não vamos construir.
 */

/** O resultado, JÁ DECIDIDO. Cinco rolos, três fileiras, índices do atlas. */
export const RESULTADO = {
  /* Uma grade escolhida à mão pra ter prêmio grande: três linhas premiadas. */
  grade: [
    [8, 8, 8, 3, 1],
    [2, 8, 4, 8, 6],
    [5, 0, 8, 7, 8],
  ],
  linhas: [
    { celulas: [[0, 0], [0, 1], [0, 2]], simbolo: 8, premio: 700 },
    { celulas: [[1, 1], [0, 1], [2, 2]], simbolo: 8, premio: 300 },
    { celulas: [[0, 0], [1, 1], [2, 2]], simbolo: 8, premio: 120 },
  ],
  multiplicador: 3,
  premioTotal: 3360,
};

/** Os tempos da cena, em milissegundos desde o começo. */
export const TEMPOS = {
  entrada: 400,
  giroComeca: 500,
  /* Os rolos param um a um. O quinto demora mais: é a ANTECIPAÇÃO. */
  paradaDoRolo: [1400, 1700, 2000, 2300, 3200],
  linhasComecam: 3500,
  entreLinhas: 450,
  bigWin: 4900,
  contadorAte: 6900,
  saida: 7600,
  fim: 8200,
};

export const CONFIG = {
  rolos: 5,
  fileiras: 3,
  /* Fora da janela visível, acima e abaixo, pra o rolo nunca mostrar buraco. */
  folgaPorRolo: 3,
  particulas: 320,
  /* Quanto tempo de cauda uma partícula tem, em ms. */
  vidaDaParticula: 1400,
};

/** A posição e o tamanho da grade dentro do canvas, em pixels. */
export function medidasDaGrade(largura, altura) {
  const margem = Math.min(largura, altura) * 0.06;
  const larguraUtil = largura - margem * 2;
  const alturaUtil = altura * 0.62;
  const celula = Math.min(larguraUtil / CONFIG.rolos, alturaUtil / CONFIG.fileiras);
  const grade = { largura: celula * CONFIG.rolos, altura: celula * CONFIG.fileiras };
  return {
    celula,
    esquerda: (largura - grade.largura) / 2,
    topo: altura * 0.16,
    ...grade,
  };
}

/**
 * Onde o rolo `i` está no instante `t`, em CÉLULAS de deslocamento.
 *
 * Enquanto gira, corre rápido; ao parar, desacelera e passa um pouco do ponto antes de
 * voltar — o *overshoot* que faz o rolo parecer que tem massa. Sem ele o rolo "congela",
 * e congelar é a coisa que mais denuncia um slot mal feito.
 */
export function deslocamentoDoRolo(i, t) {
  const comeca = TEMPOS.giroComeca + i * 60;
  const para = TEMPOS.paradaDoRolo[i];
  if (t <= comeca) return 0;

  const VELOCIDADE = 0.028; // células por ms
  if (t < para) {
    const corrido = (t - comeca) * VELOCIDADE;
    /* Antecipação: o quinto rolo desacelera bem antes de parar, e isso se vê. */
    if (i === 4 && t > para - 1200) {
      const restante = (para - t) / 1200;
      return corrido - (1 - restante) * (1 - restante) * 6;
    }
    return corrido;
  }

  /* Depois da parada: mola amortecida em torno da posição final. */
  const desde = t - para;
  if (desde > 600) return Math.round((para - comeca) * VELOCIDADE);
  const alvo = Math.round((para - comeca) * VELOCIDADE);
  const amplitude = 0.55 * Math.exp(-desde / 130);
  return alvo + amplitude * Math.sin(desde / 42);
}

/** Quanto a linha `n` está acesa em `t`: 0 apagada, 1 acesa, com pulso. */
export function brilhoDaLinha(n, t) {
  const acende = TEMPOS.linhasComecam + n * TEMPOS.entreLinhas;
  if (t < acende) return 0;
  const desde = t - acende;
  const entrada = Math.min(1, desde / 180);
  const pulso = 0.75 + 0.25 * Math.sin(desde / 220);
  return entrada * pulso;
}

/** O contador do prêmio em `t` — sobe com desaceleração, como toda contagem de slot. */
export function premioNaTela(t) {
  if (t < TEMPOS.bigWin) return 0;
  const p = Math.min(1, (t - TEMPOS.bigWin) / (TEMPOS.contadorAte - TEMPOS.bigWin));
  return Math.round(RESULTADO.premioTotal * (1 - Math.pow(1 - p, 3)));
}

/**
 * As partículas do big win, calculadas por FÓRMULA e não guardadas em lista.
 *
 * Cada partícula é uma função do tempo e do índice dela. Isso vale para os dois braços e
 * tira da comparação a diferença entre "quem guardou o estado melhor" — o que sobra é a
 * diferença de DESENHO, que é o que a POC quer medir.
 */
export function particula(i, t) {
  const desde = t - TEMPOS.bigWin;
  const atraso = (i % 40) * 22;
  const vida = desde - atraso;
  if (vida < 0 || vida > CONFIG.vidaDaParticula) return null;

  const p = vida / CONFIG.vidaDaParticula;
  const angulo = (i * 2.399963) % (Math.PI * 2); // ângulo áureo: espalha sem agrupar
  const forca = 120 + ((i * 37) % 260);
  return {
    dx: Math.cos(angulo) * forca * p,
    dy: Math.sin(angulo) * forca * p + 340 * p * p, // gravidade
    opacidade: Math.max(0, 1 - p * p),
    tamanho: 3 + ((i * 13) % 7),
    matiz: (i * 47) % 360,
  };
}

/** A cena inteira entra e sai: nenhum jogo aparece do nada e some do nada. */
export function opacidadeDaCena(t) {
  if (t < TEMPOS.entrada) return t / TEMPOS.entrada;
  if (t > TEMPOS.saida) return Math.max(0, 1 - (t - TEMPOS.saida) / (TEMPOS.fim - TEMPOS.saida));
  return 1;
}
