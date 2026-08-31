import { ReactNode, createContext, useContext, useMemo } from 'react';
import { Image, ImageSourcePropType, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useJanela } from '../theme/useJanela';
import { colors } from '../theme';

/** Proporção dos tampos 16:9 (1920x1080 e 1600x900 são a mesma composição). */
const PROPORCAO = 16 / 9;

/**
 * A partir desta largura vale a pena usar o tampo deitado. Abaixo disso o app segue
 * com a arte de retrato — esticar uma mesa 16:9 num celular em pé não deixa a mesa
 * maior, deixa ela minúscula no meio de duas tarjas pretas.
 */
export const LARGURA_MINIMA_PRO_TAMPO = 700;

/** Acima disso vale a versão de 1920; abaixo, a de 1600 basta e pesa menos. */
export const LARGURA_DE_COMPUTADOR = 1280;

interface Palco {
  /** Onde a arte realmente ficou na tela, depois do `contain`. */
  esquerda: number;
  topo: number;
  largura: number;
  altura: number;
}

const PalcoContext = createContext<Palco | null>(null);

/**
 * Onde a mesa está, pra quem for desenhar por cima. Devolve null fora de um
 * <TampoDaMesa>, que é o jeito de a tela saber que precisa cair no layout de retrato.
 */
export function usePalco(): Palco | null {
  return useContext(PalcoContext);
}

/**
 * Converte uma posição em FRAÇÃO DO TAMPO (0 a 1, medida na própria arte) para pixels
 * na tela. É assim que a jogabilidade se ancora à mesa: "a casa do jogador fica em 32%
 * da largura, 55% da altura" vale igual em 1920, em 1600 e em qualquer janela no meio,
 * porque a composição das duas artes é a mesma.
 *
 * Repare no que isto NÃO é: não é copiar coordenada em pixel de um screenshot e torcer.
 * A conta parte do retângulo que o `contain` produziu, que é calculado, não chutado.
 */
export function naMesa(palco: Palco, fracaoX: number, fracaoY: number) {
  return {
    left: palco.esquerda + fracaoX * palco.largura,
    top: palco.topo + fracaoY * palco.altura,
  };
}

interface TampoDaMesaProps {
  /** As duas versões da mesma composição; a escolha é por largura de janela. */
  computador: ImageSourcePropType;
  tablet: ImageSourcePropType;
  children?: ReactNode;
}

/**
 * O tampo da mesa como PALCO, não como interface.
 *
 * A regra que veio junto com a arte, e que vale a pena repetir aqui porque é fácil de
 * violar sem perceber: a imagem é a camada visual base. Nada que muda durante a
 * partida está gravado nela — nem saldo, nem aposta, nem prêmio, nem relógio, nem
 * botão. Tudo isso é componente de verdade por cima, que dá pra ler em voz alta,
 * traduzir e tocar.
 *
 * E `contain`, nunca `cover`: cortar a mesa pra encher a tela some com a borda do
 * feltro e com metade da regra impressa. Quando sobra espaço, sobra escuro — que é o
 * salão, não um erro.
 */
export function TampoDaMesa({ computador, tablet, children }: TampoDaMesaProps) {
  const janela = useJanela();

  const palco = useMemo<Palco>(() => {
    // `contain`: a mesa cresce até esbarrar no lado mais apertado da janela.
    const proporcaoDaJanela = janela.width / janela.height;
    const largura = proporcaoDaJanela > PROPORCAO ? janela.height * PROPORCAO : janela.width;
    const altura = largura / PROPORCAO;
    return {
      largura,
      altura,
      esquerda: (janela.width - largura) / 2,
      topo: (janela.height - altura) / 2,
    };
  }, [janela.width, janela.height]);

  const arte = janela.width >= LARGURA_DE_COMPUTADOR ? computador : tablet;

  return (
    <View style={styles.salao}>
      {/* O escuro atrás não é tarja preta: é o salão em volta da mesa. */}
      <LinearGradient
        colors={[colors.background, '#050706', colors.background]}
        style={StyleSheet.absoluteFillObject}
      />
      <Image
        source={arte}
        // A largura e a altura explícitas são obrigatórias: sem elas o react-native-web
        // cai no tamanho de arquivo da imagem e a mesa aparece do tamanho errado.
        style={{ position: 'absolute', left: palco.esquerda, top: palco.topo, width: palco.largura, height: palco.altura }}
        resizeMode="contain"
      />
      <PalcoContext.Provider value={palco}>{children}</PalcoContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  salao: { flex: 1, backgroundColor: colors.background },
});
