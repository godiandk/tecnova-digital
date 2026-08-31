import { Image, StyleSheet, Text, View } from 'react-native';

import { PLAYER_CHIP_IMAGES } from '../data/chipImages';
import { colors, fontFamily } from '../theme';

/**
 * Valor de cada cor, do maior pro menor.
 *
 * Cor é valor — é padrão do ramo, e é o que permite ler quanto está em jogo sem contar.
 * A ordem decrescente importa: a pilha é montada trocando o maior valor possível
 * primeiro, como quem paga em cédulas grandes.
 */
const VALORES: { valor: number; cor: keyof typeof PLAYER_CHIP_IMAGES }[] = [
  { valor: 1000, cor: 'amarelo' },
  { valor: 500, cor: 'roxo' },
  { valor: 100, cor: 'branco' },
  { valor: 25, cor: 'verde-limao' },
  { valor: 5, cor: 'vermelho' },
  { valor: 1, cor: 'azul' },
];

/** Lado da ficha, medido na arte da mesa. */
const FICHA_NA_ARTE = 74;

/** Quanto uma ficha sobe em relação à de baixo. É o que dá espessura à pilha. */
const DEGRAU_NA_ARTE = 7;

/** Acima disto a pilha vira torre e não cabe: o número passa a contar o resto. */
const MAXIMO_EMPILHADO = 8;

/**
 * A aposta como pilha de fichas em cima da mesa.
 *
 * Antes a aposta era um número escrito num botão. Numa mesa de verdade dá pra saber
 * quanto está em jogo sem ler nada: a altura da pilha diz, e a cor diz o valor de cada
 * ficha. A pilha é a informação.
 *
 * As fichas são desenhadas de baixo pra cima, cada uma um degrau acima da anterior — é
 * o que dá espessura. Vistas assim, de cima e um pouco de lado, elas leem como cilindro
 * e não como moeda chapada.
 */
export function PilhaDeFichas({ valor, escala }: { valor: number; escala: number }) {
  if (valor <= 0) return null;

  const lado = FICHA_NA_ARTE * escala;
  const degrau = DEGRAU_NA_ARTE * escala;

  // Troca o valor pelas maiores fichas possíveis, como quem paga em cédulas grandes.
  const fichas: (keyof typeof PLAYER_CHIP_IMAGES)[] = [];
  let resto = valor;
  for (const { valor: unidade, cor } of VALORES) {
    while (resto >= unidade && fichas.length < MAXIMO_EMPILHADO) {
      fichas.push(cor);
      resto -= unidade;
    }
  }

  return (
    <View style={{ width: lado, height: lado + degrau * (fichas.length - 1), alignItems: 'center' }}>
      {fichas.map((cor, indice) => (
        <Image
          key={indice}
          source={PLAYER_CHIP_IMAGES[cor] ?? PLAYER_CHIP_IMAGES.branco}
          resizeMode="contain"
          style={{
            position: 'absolute',
            // A primeira da lista é a de maior valor e fica EMBAIXO, como na mesa.
            bottom: indice * degrau,
            width: lado,
            height: lado,
          }}
        />
      ))}
      <Text
        style={[
          styles.valor,
          { fontSize: Math.max(9, 22 * escala), bottom: -(16 * escala) - 4 },
        ]}
      >
        {valor.toLocaleString('pt-BR')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  valor: {
    position: 'absolute',
    fontFamily: fontFamily.displayBold,
    color: colors.goldBright,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowRadius: 3,
  },
});
