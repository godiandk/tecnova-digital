import { ImageSourcePropType, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, useJanela } from '../theme';
import { Fundo } from './Fundo';

interface GameBackdropProps {
  source: ImageSourcePropType;
  children: React.ReactNode;
  /**
   * Apaga mais a foto da mesa, pra ela ficar só como ambiente.
   *
   * Serve pras telas em que a MESA É DESENHADA POR CIMA da foto — a roleta é o caso. Lá
   * o pano de apostas é montado pelo app, e a foto por baixo tem o pano dela impresso,
   * na disposição de mesa física (doze fileiras de três, em pé). Na claridade normal
   * apareciam os dois: o pano de verdade e, atrás, um segundo pano com os números em
   * outro lugar. Não é que o de trás esteja errado — é que ninguém precisa de duas
   * mesas na mesma tela.
   */
  apagarAMesa?: boolean;
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
/*
 * A coluna era 560 fixos, e num monitor de 1920 isso é uma tira no meio da tela — a
 * mesa aparecia menor do que aparece num celular grande, com preto dos dois lados. O
 * limite existe por um motivo real (os controles foram desenhados pra uma coluna
 * estreita, e espalhá-los por 1920 é redesenhar dez telas), mas 560 é estreito demais
 * pra qualquer monitor.
 *
 * Agora ela acompanha a janela: 42% da largura, nunca menos que os 560 de antes e nunca
 * mais que 900 — acima disso os controles começam a nadar. Num monitor de 1920 dá 806,
 * quase metade a mais de mesa; num notebook de 1366 dá os mesmos 574 de sempre.
 */
const LARGURA_MESA_MINIMA = 560;
const LARGURA_MESA_MAXIMA = 900;
const FATIA_DA_JANELA = 0.42;

export function larguraDaMesa(larguraDaJanela: number): number {
  return Math.min(LARGURA_MESA_MAXIMA, Math.max(LARGURA_MESA_MINIMA, larguraDaJanela * FATIA_DA_JANELA));
}

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
export function GameBackdrop({ source, children, apagarAMesa }: GameBackdropProps) {
  const janela = useJanela();
  const largo = janela.width > LIMITE_ESTREITO;

  const mesa = (
    <Fundo source={source} style={styles.mesa} resizeMode="cover">
      <LinearGradient
        colors={
          apagarAMesa
            ? ['rgba(11,15,13,0.84)', 'rgba(11,15,13,0.96)']
            : ['rgba(11,15,13,0.25)', colors.background]
        }
        locations={apagarAMesa ? [0, 1] : [0, 0.8]}
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

      <View style={[styles.coluna, { width: larguraDaMesa(janela.width) }]}>{mesa}</View>
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
