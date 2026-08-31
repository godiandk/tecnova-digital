import { ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { ARTE } from '../data/mesasOnline';
import { colors } from '../theme';

/** Uma posição medida na arte (1600x900), já convertida pra tela. */
export interface Ponto {
  left: number;
  top: number;
}

export interface Regua {
  /** Converte uma medida feita na arte pra posição na tela. */
  ponto: (x: number, y: number) => Ponto;
  /** Quanto a arte foi reduzida. Multiplique tamanhos por isto. */
  escala: number;
  largura: number;
  altura: number;
}

interface MesaProps {
  arte: number;
  /** Espaço disponível na tela. A mesa entra inteira, sem cortar. */
  largura: number;
  altura: number;
  children: (regua: Regua) => ReactNode;
}

/**
 * O tampo da mesa, com a arte deitada e um sistema de medidas em cima dela.
 *
 * O problema que isto resolve: a arte já traz os círculos de aposta, o sapato e os
 * dizeres pintados no pano. Carta e ficha precisam cair EM CIMA dessas marcas, e não
 * em qualquer lugar — senão a ficha fica ao lado do círculo e a mesa denuncia que o
 * desenho e o jogo são duas coisas separadas.
 *
 * A saída é medir tudo na arte, em pixel de 1600x900, e deixar a régua converter. Uma
 * posição escrita uma vez vale em qualquer tamanho de tela, do celular ao monitor.
 */
export function MesaDeJogo({ arte, largura, altura, children }: MesaProps) {
  /*
   * A escala é a MENOR entre largura e altura disponíveis: a mesa tem que caber
   * inteira. Escalar só pela largura fazia a mesa transbordar em celular deitado, onde
   * a tela é mais larga que 16:9 — e o que sobrava de fora era justamente a barra de
   * controles embaixo.
   */
  const escala = Math.min(largura / ARTE.largura, altura / ARTE.altura);
  const larguraDaMesa = ARTE.largura * escala;
  const alturaDaMesa = ARTE.altura * escala;

  const regua: Regua = {
    escala,
    largura: larguraDaMesa,
    altura: alturaDaMesa,
    ponto: (x, y) => ({ left: x * escala, top: y * escala }),
  };

  return (
    <View style={[styles.tampo, { width: larguraDaMesa, height: alturaDaMesa }]}>
      {/*
        Largura e altura escritas, e não `absoluteFill`: o Image do react-native-web
        troca as duas pelo tamanho natural do arquivo quando elas não vêm escritas, e a
        arte de 1600x900 aparecia ampliada, mostrando só o canto superior esquerdo.
      */}
      <Image
        source={arte}
        style={{ position: 'absolute', left: 0, top: 0, width: larguraDaMesa, height: alturaDaMesa }}
        resizeMode="cover"
      />
      {children(regua)}
    </View>
  );
}

/**
 * Põe uma peça em cima da mesa, centralizada no ponto medido.
 *
 * Centralizada, e não encostada pelo canto: as marcas do pano são círculos, e o que a
 * gente mede é o meio deles.
 */
export function NaMesa({
  ponto,
  children,
  style,
}: {
  ponto: Ponto;
  children: ReactNode;
  style?: object;
}) {
  return (
    <View style={[styles.peca, { left: ponto.left, top: ponto.top }, style]}>
      <View style={styles.centro}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  tampo: { overflow: 'hidden', backgroundColor: colors.background },
  /* Tamanho zero no ponto medido: o conteúdo cresce a partir do centro dele. */
  peca: { position: 'absolute', width: 0, height: 0, alignItems: 'center', justifyContent: 'center' },
  centro: { alignItems: 'center', justifyContent: 'center' },
});
