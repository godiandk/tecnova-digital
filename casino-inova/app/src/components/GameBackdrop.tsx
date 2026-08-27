import { ImageSourcePropType, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, useJanela } from '../theme';
import { Fundo } from './Fundo';

interface GameBackdropProps {
  source: ImageSourcePropType;
  children: React.ReactNode;
}

/**
 * Largura máxima da mesa.
 *
 * As fotos de mesa são 1284x2778 — formato de celular em pé. Numa tela deitada de
 * 1920x1080 elas teriam que ser ampliadas até estourar pra cobrir a largura, e o que
 * sobraria na tela seria uma faixa central borrada, sem a composição que a foto tem.
 *
 * Além disso, esticar a mesa não bastaria: os controles de aposta, o painel de placar e
 * o chat foram desenhados pra uma coluna estreita. Espalhar isso por 1920px não é
 * questão de imagem mais larga, é redesenhar dez telas.
 *
 * Então a mesa joga numa coluna centralizada, como fazem os cassinos que também rodam
 * no navegador, e o resto da tela vira ambiente.
 */
const LARGURA_MESA = 560;

/** Abaixo disso a tela é estreita o bastante pra mesa ocupar tudo, como no celular. */
const LIMITE_ESTREITO = 700;

/**
 * O fundo de toda tela de jogo: a foto da mesa, com um degradê escurecendo de cima pra
 * baixo pra manter o texto legível.
 *
 * Em tela larga, a MESMA foto aparece duas vezes: uma ampliada e bem escurecida ao
 * fundo, fazendo o papel de salão fora de foco, e a outra na coluna do meio, no
 * tamanho certo. Reusar a foto em vez de pedir uma arte de fundo mantém a cor e a luz
 * de cada jogo diferentes entre si, de graça.
 */
export function GameBackdrop({ source, children }: GameBackdropProps) {
  const janela = useJanela();
  const largo = janela.width > LIMITE_ESTREITO;

  const mesa = (
    <Fundo source={source} style={styles.mesa} resizeMode="cover">
      <LinearGradient
        colors={['rgba(11,15,13,0.25)', colors.background]}
        locations={[0, 0.8]}
        style={StyleSheet.absoluteFillObject}
      />
      {children}
    </Fundo>
  );

  if (!largo) return mesa;

  return (
    <View style={styles.salao}>
      {/* Ambiente: a mesma foto, ampliada e apagada, preenchendo a tela toda. */}
      <Fundo source={source} style={StyleSheet.absoluteFillObject} resizeMode="cover">
        <View style={styles.veu} />
      </Fundo>

      <View style={[styles.coluna, { width: LARGURA_MESA }]}>{mesa}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  mesa: { flex: 1 },
  salao: { flex: 1, backgroundColor: colors.background, alignItems: 'center' },
  /*
   * Véu forte de propósito: o fundo tem que ler como ambiente, não como uma segunda
   * cópia da mesa competindo com a de verdade.
   */
  veu: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11,15,13,0.88)' },
  coluna: {
    flex: 1,
    overflow: 'hidden',
    // Uma borda fina separa a mesa do ambiente sem pesar.
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: colors.feltLine,
  },
});
