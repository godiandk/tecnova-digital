import { Image, StyleSheet, View } from 'react-native';

import { DOMINO_TILE_IMAGES } from '../data/gameAssets';

export interface PecaDeDomino {
  a: number;
  b: number;
}

/** Largura da peça deitada na mesa. A arte é 160x295, então a altura sai daí. */
const LARGURA = 26;
const ALTURA = Math.round((LARGURA * 295) / 160);

/** Quantas peças cabem numa perna antes de a corrente dobrar a esquina. */
const PECAS_POR_PERNA = 7;

/**
 * A corrente de dominó em cima da mesa.
 *
 * Duas coisas que toda mesa de dominó tem e a nossa não tinha:
 *
 * 1. **A corrente dobra esquina.** Quando chega na borda, ela vira e continua na linha
 *    de baixo — é o que permite uma partida inteira caber num tampo. A nossa antiga era
 *    uma tira reta que rolava de lado, e a mesa some quando o tabuleiro é uma barra de
 *    rolagem.
 * 2. **A carroça entra atravessada.** Peça dupla é assentada perpendicular à corrente.
 *    É a regra visual mais reconhecível do jogo.
 *
 * As peças da corrente ficam DEITADAS (giradas 90°), porque é assim que elas encostam
 * ponta com ponta. A carroça, por ser perpendicular, fica em pé.
 */
export function CorrenteDeDomino({ pecas }: { pecas: PecaDeDomino[] }) {
  const pernas: PecaDeDomino[][] = [];
  for (let i = 0; i < pecas.length; i += PECAS_POR_PERNA) {
    pernas.push(pecas.slice(i, i + PECAS_POR_PERNA));
  }

  return (
    <View style={styles.corrente}>
      {pernas.map((perna, indiceDaPerna) => (
        <View
          key={indiceDaPerna}
          // Pernas ímpares correm ao contrário, como a corrente que volta.
          style={[styles.perna, indiceDaPerna % 2 === 1 && styles.pernaInvertida]}
        >
          {perna.map((peca, i) => {
            const carroca = peca.a === peca.b;
            const arte = DOMINO_TILE_IMAGES[`${Math.min(peca.a, peca.b)}-${Math.max(peca.a, peca.b)}`];
            if (!arte) return null;
            return (
              <Image
                key={`${peca.a}-${peca.b}-${i}`}
                source={arte}
                resizeMode="contain"
                style={[
                  styles.peca,
                  { width: LARGURA, height: ALTURA },
                  // Deitada na corrente; em pé quando é carroça.
                  carroca ? styles.carroca : styles.deitada,
                ]}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  corrente: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  perna: { flexDirection: 'row', alignItems: 'center' },
  pernaInvertida: { flexDirection: 'row-reverse' },
  peca: {},
  /*
   * A peça deitada ocupa ALTURA de largura depois de girada, então a margem negativa
   * tira a sobra que a rotação deixa na caixa original.
   */
  deitada: {
    transform: [{ rotate: '90deg' }],
    marginHorizontal: -(ALTURA - LARGURA) / 2 + 1,
  },
  carroca: { marginHorizontal: 1 },
});
