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
  /**
   * A tela desenha o PRÓPRIO pano por cima da foto, e o pano impresso tem que recuar.
   *
   * Diferente de `apagarAMesa`, que apaga quase tudo: aqui a mesa da foto continua sendo
   * mesa — a borda de couro, o brilho do salão, a madeira —, só as linhas do pano dela é
   * que somem atrás de um véu. É o que o bacará precisa: as casas da foto são doze
   * PLAYER/BANKER/TIE do tamanho de um selo, e elas atravessavam as três casas
   * desenhadas. Duas mesas de bacará na mesma tela não é riqueza, é ruído.
   *
   * `apagarAMesa` continua existindo pro caso da roleta, onde o pano impresso está ERRADO
   * (faltam o 27, o 28 e o 29) e precisa sumir de verdade.
   */
  panoProprio?: boolean;
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
export function GameBackdrop({ source, children, apagarAMesa, panoProprio }: GameBackdropProps) {
  const janela = useJanela();
  const largo = janela.width > LIMITE_ESTREITO;

  const mesa = (
    <Fundo source={source} style={styles.mesa} resizeMode="cover">
      {/*
        O DEGRADÊ NÃO PODE MATAR A MESA — e era o que ele fazia.
        
        Ele ia de 25% de preto no topo até COR SÓLIDA em 80% da altura. Da linha dos 80%
        pra baixo a foto simplesmente não existia: era uma laje preta. E é exatamente ali
        que ficam os controles de TODAS as dez telas. O retrato de celular mostra o
        resultado — um quinto da tela em preto chapado, embaixo da mesa, sem nada.
        
        Foi essa laje que produziu a leitura de "componentes React por cima de uma
        fotografia": a foto era enfeite no topo, e o jogo acontecia num painel escuro
        colado embaixo dela.
        
        Agora o escurecimento acompanha a tela inteira e termina em 92% — forte o bastante
        pra o texto do controle ficar legível sobre qualquer foto, e transparente o
        bastante pra o pano continuar lá embaixo. A mesa deixa de acabar no meio.
      */}
      <LinearGradient
        colors={
          apagarAMesa
            ? ['rgba(11,15,13,0.84)', 'rgba(11,15,13,0.96)']
            : panoProprio
              ? ['rgba(11,15,13,0.42)', 'rgba(11,15,13,0.62)', 'rgba(11,15,13,0.92)']
              : ['rgba(11,15,13,0.15)', 'rgba(11,15,13,0.45)', 'rgba(11,15,13,0.92)']
        }
        locations={apagarAMesa ? [0, 1] : [0, 0.55, 1]}
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
