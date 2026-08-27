import { ImageBackground, ImageBackgroundProps, StyleSheet } from 'react-native';

/**
 * A foto de fundo de uma tela, cobrindo a área toda.
 *
 * Existe por causa de um detalhe do react-native-web: o `ImageBackground` repassa pra
 * imagem a largura e a altura escritas no style. Quando o style é `flex: 1` — que é
 * como quase toda tela nossa se estica — não existe largura escrita, e a imagem cai no
 * tamanho natural do arquivo.
 *
 * As fotos são 1284x2778. No celular isso passava despercebido, porque sobra imagem de
 * todo lado. Num monitor de 1920 a foto cobria só os primeiros 1284px e o resto da
 * tela ficava preto, com uma emenda visível no meio.
 *
 * Forçar 100% aqui conserta de uma vez em todas as telas, e a próxima tela que alguém
 * escrever já nasce certa.
 */
export function Fundo({ imageStyle, resizeMode = 'cover', ...resto }: ImageBackgroundProps) {
  return <ImageBackground {...resto} resizeMode={resizeMode} imageStyle={[styles.cobrir, imageStyle]} />;
}

const styles = StyleSheet.create({
  cobrir: { width: '100%', height: '100%' },
});
