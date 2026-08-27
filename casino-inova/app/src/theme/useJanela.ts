import { useEffect, useState } from 'react';
import { Dimensions, ScaledSize } from 'react-native';

/**
 * O tamanho da janela, acompanhando mudanças.
 *
 * `Dimensions.get('window')` lido uma vez no topo do arquivo funciona no celular, onde
 * a tela não muda de tamanho. Na web ele congela o valor do primeiro carregamento — a
 * pessoa arrasta a janela e o layout continua achando que a tela tem o tamanho antigo.
 *
 * Aqui a gente escuta a mudança, então o mesmo código serve pros dois.
 */
export function useJanela(): ScaledSize {
  const [janela, setJanela] = useState(() => Dimensions.get('window'));

  useEffect(() => {
    const inscricao = Dimensions.addEventListener('change', ({ window }) => setJanela(window));
    return () => inscricao.remove();
  }, []);

  return janela;
}

/**
 * Largura máxima do conteúdo.
 *
 * O app foi desenhado pra celular, e esticar isso numa tela de 1440px deixa tudo
 * absurdo: cartaz de 700px de largura, barra de nível de um metro. Num monitor, o
 * conteúdo fica numa coluna centralizada com esta largura, como fazem os sites de jogo
 * que também rodam no navegador.
 */
export const LARGURA_MAXIMA = 1100;

/**
 * Quantas colunas de cartaz cabem, e que largura cada uma tem.
 *
 * O alvo é um cartaz de uns 165px — o tamanho em que o nome escrito na arte continua
 * legível. A conta parte daí em vez de fixar o número de colunas, pra funcionar do
 * celular pequeno ao monitor largo sem caso especial.
 */
export function gradeDeCartazes(larguraDisponivel: number, vao: number) {
  const ALVO = 175;
  const colunas = Math.max(2, Math.min(6, Math.floor((larguraDisponivel + vao) / (ALVO + vao))));
  const largura = Math.floor((larguraDisponivel - vao * (colunas - 1)) / colunas);
  return { colunas, largura, altura: Math.round(largura * 1.5) };
}
