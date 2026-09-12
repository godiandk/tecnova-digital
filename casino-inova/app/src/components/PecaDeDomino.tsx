import { Image, StyleSheet, View } from 'react-native';

import { DOMINO_TILE_IMAGES } from '../data/gameAssets';
import { colors, radius } from '../theme';

export interface PecaDeDomino {
  a: number;
  b: number;
}

/** A arte é 160x295 — a proporção sai daí e não é escolhida. */
const PROPORCAO = 295 / 160;

/**
 * UMA PEÇA DE DOMINÓ, desenhada.
 *
 * O QUE ELA VEIO SUBSTITUIR: no modo contra o computador, a peça era a string `"3|5"`
 * dentro de um botão retangular — `tileLabel(tile)` devolvia `${tile.a}|${tile.b}`. Sete
 * botões de texto na mão do jogador e uma fila de botões de texto na mesa. Não parecia
 * dominó porque não era dominó: era uma lista de valores.
 *
 * A arte das peças JÁ EXISTIA (`DOMINO_TILE_IMAGES`, 28 peças) e já era usada na mesa
 * online. O modo contra o bot — que é o primeiro que qualquer pessoa abre — tinha ficado
 * pra trás.
 *
 * DEITADA OU EM PÉ: na mão o jogador segura as peças em pé, como se segura na vida; na
 * mesa elas ficam deitadas, encostando ponta com ponta. A carroça (peça dupla) entra
 * atravessada, que é a regra visual mais reconhecível do jogo.
 */
export function PecaDeDomino({
  peca,
  largura,
  deitada = false,
  escolhida = false,
  apagada = false,
}: {
  peca: PecaDeDomino;
  largura: number;
  /** Deitada é como ela fica na mesa; em pé é como ela fica na mão. */
  deitada?: boolean;
  /** A peça que o jogador selecionou pra jogar. */
  escolhida?: boolean;
  /** Fora de jogo nesta vez — a regra da abertura, por exemplo. */
  apagada?: boolean;
}) {
  const arte = DOMINO_TILE_IMAGES[`${Math.min(peca.a, peca.b)}-${Math.max(peca.a, peca.b)}`];
  const altura = Math.round(largura * PROPORCAO);
  if (!arte) return null;

  /*
   * A CARROÇA NÃO DEITA. Peça dupla é assentada perpendicular à corrente, então mesmo no
   * modo deitado ela fica em pé — e é assim que se enxerga, de longe, onde a corrente
   * mudou de direção.
   */
  const carroca = peca.a === peca.b;
  const girar = deitada && !carroca;

  return (
    <View
      style={[
        /*
         * A peça girada ocupa a ALTURA como largura. Sem trocar as medidas da caixa, a
         * fila de peças deitadas fica com buracos entre uma e outra.
         */
        girar ? { width: altura, height: largura } : { width: largura, height: altura },
        estilos.caixa,
        escolhida && estilos.escolhida,
        apagada && estilos.apagada,
      ]}
    >
      <Image
        source={arte}
        resizeMode="contain"
        style={[{ width: largura, height: altura }, girar && estilos.girada]}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  caixa: { alignItems: 'center', justifyContent: 'center' },
  girada: { transform: [{ rotate: '90deg' }] },
  /*
   * A peça escolhida SOBE, como a que se levanta da mão antes de assentar. Um anel
   * dourado sozinho ficaria parecendo botão selecionado; o movimento é o que diz
   * "esta aqui".
   */
  escolhida: {
    transform: [{ translateY: -10 }],
    borderRadius: radius.sm,
    shadowColor: colors.goldBright,
    shadowOpacity: 0.9,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  apagada: { opacity: 0.35 },
});
