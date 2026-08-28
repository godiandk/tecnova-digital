import { ReactNode } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { CARD_BACK_IMAGE } from '../data/gameAssets';
import { colors, fontFamily, radius, spacing } from '../theme';

export interface Lugar {
  /** Ordem em volta da mesa, como o servidor manda. */
  indice: number;
  nome: string;
  ehVoce?: boolean;
  ehVez?: boolean;
  ehBot?: boolean;
  /** Quantas peças ou cartas a pessoa tem na mão, viradas pra baixo. */
  naMao?: number;
  /** Cor do time, quando o jogo tem dupla. */
  corDoTime?: string;
  /** Texto curto embaixo do nome — fichas, pontos, o que o jogo quiser. */
  detalhe?: string;
}

interface MesaProps {
  lugares: Lugar[];
  /** Altura do tampo. O miolo recebe o que sobra depois dos lugares. */
  altura?: number;
  /** O tabuleiro compartilhado: a corrente do dominó, as cartas jogadas, os dados. */
  children?: ReactNode;
}

/** Quantas costas de peça mostrar no máximo — acima disso o número basta. */
const MAXIMO_DE_COSTAS = 5;

/**
 * A mesa vista de cima, com as pessoas em volta.
 *
 * Antes, mesa com gente era uma LISTA: "Na mesa — Fulano, 5 peças, vez dele", e o
 * tabuleiro numa tira que rolava de lado. Isso é placar, não mesa. Quem joga precisa
 * ver de relance quem está onde, de quem é a vez e quanta peça cada um ainda tem.
 *
 * Duas regras que toda mesa on-line segue e esta também:
 *
 * 1. **Você fica sempre embaixo.** Não importa em que assento o servidor te colocou: a
 *    mesa é girada pra o seu lugar cair na frente. É assim que se joga sentado.
 * 2. **A mão dos outros aparece de costas.** Vê-se quantas peças cada um tem — que é
 *    informação pública e importante — sem ver quais são.
 *
 * O miolo é livre: cada jogo põe ali o que é compartilhado.
 */
export function MesaComLugares({ lugares, altura = 300, children }: MesaProps) {
  const eu = lugares.find((lugar) => lugar.ehVoce);
  const total = lugares.length || 1;

  /*
   * Gira a mesa pra você ficar embaixo. `deslocamento` é quantas cadeiras andar; o
   * resto sai da ordem do servidor, então parceiro e adversário continuam nos lugares
   * certos uns em relação aos outros.
   */
  const deslocamento = eu ? eu.indice : 0;
  const emVolta = lugares.map((lugar) => ({
    lugar,
    posicao: (lugar.indice - deslocamento + total) % total,
  }));

  return (
    <View style={[styles.tampo, { height: altura }]}>
      <LinearGradient
        colors={['rgba(23,58,40,0.95)', 'rgba(11,30,20,0.98)']}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Filete do tampo, que dá a borda da mesa. */}
      <View style={styles.borda} pointerEvents="none" />

      <View style={styles.miolo}>{children}</View>

      {emVolta.map(({ lugar, posicao }) => (
        <View key={lugar.indice} style={[styles.lugar, ancoraDo(posicao, total)]}>
          <AssentoDoJogador lugar={lugar} />
        </View>
      ))}
    </View>
  );
}

/**
 * Onde cada cadeira encosta na borda.
 *
 * Posição 0 é sempre você, embaixo. As outras seguem em volta no sentido do jogo. Com
 * quatro lugares dá o quadrado clássico (você, esquerda, frente, direita); com dois, o
 * cara a cara; com três, um de cada lado e um na frente.
 */
function ancoraDo(posicao: number, total: number) {
  if (posicao === 0) return styles.embaixo;
  if (total === 2) return styles.emCima;
  if (total === 3) return posicao === 1 ? styles.aEsquerda : styles.aDireita;
  if (posicao === 1) return styles.aEsquerda;
  if (posicao === 2) return styles.emCima;
  return styles.aDireita;
}

function AssentoDoJogador({ lugar }: { lugar: Lugar }) {
  const costas = Math.min(lugar.naMao ?? 0, MAXIMO_DE_COSTAS);

  return (
    <View style={[styles.assento, lugar.ehVez && styles.assentoDaVez]}>
      {lugar.corDoTime && <View style={[styles.marcaDoTime, { backgroundColor: lugar.corDoTime }]} />}

      <Text style={styles.nome} numberOfLines={1}>
        {lugar.nome}
        {lugar.ehVoce ? ' (você)' : ''}
      </Text>

      {lugar.detalhe ? <Text style={styles.detalhe}>{lugar.detalhe}</Text> : null}

      {/* A mão dos outros, de costas. A sua fica embaixo da mesa, aberta. */}
      {!lugar.ehVoce && costas > 0 && (
        <View style={styles.maoFechada}>
          {Array.from({ length: costas }).map((_, i) => (
            <Image
              key={i}
              source={CARD_BACK_IMAGE}
              style={[styles.costa, { marginLeft: i === 0 ? 0 : -13 }]}
              resizeMode="cover"
            />
          ))}
          {(lugar.naMao ?? 0) > MAXIMO_DE_COSTAS && (
            <Text style={styles.quantas}>{lugar.naMao}</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tampo: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  borda: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: 'rgba(229,181,103,0.30)',
  },
  /* O miolo respeita as bordas onde ficam as cadeiras. */
  miolo: {
    flex: 1,
    marginTop: 62,
    marginBottom: 46,
    marginHorizontal: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },

  lugar: { position: 'absolute' },
  embaixo: { bottom: 6, alignSelf: 'center' },
  emCima: { top: 6, alignSelf: 'center' },
  aEsquerda: { left: 6, top: '38%' },
  aDireita: { right: 6, top: '38%' },

  assento: {
    minWidth: 84,
    maxWidth: 116,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(11,15,13,0.62)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  /* A vez é a informação mais consultada da mesa: ganha borda dourada. */
  assentoDaVez: {
    borderColor: colors.goldBright,
    backgroundColor: 'rgba(229,181,103,0.16)',
  },
  marcaDoTime: { width: 18, height: 3, borderRadius: 2 },
  nome: { fontFamily: fontFamily.bodySemiBold, fontSize: 12, color: colors.textPrimary },
  detalhe: { fontFamily: fontFamily.body, fontSize: 10, color: colors.textSecondary },
  maoFechada: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  costa: { width: 20, height: 30, borderRadius: 3 },
  quantas: {
    fontFamily: fontFamily.displayBold,
    fontSize: 11,
    color: colors.goldBright,
    marginLeft: 5,
  },
});
