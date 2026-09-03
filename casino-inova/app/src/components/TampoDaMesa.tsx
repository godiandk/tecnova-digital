import { ReactNode, createContext, useContext, useMemo } from 'react';
import { Image, ImageSourcePropType, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useJanela } from '../theme/useJanela';
import { colors } from '../theme';

/** Proporção dos tampos deitados (1920x1080 e 1600x900 são a mesma composição). */
const PROPORCAO_DEITADA = 16 / 9;

/** Proporção dos tampos em pé (1284x2778, o formato de celular). */
const PROPORCAO_EM_PE = 1284 / 2778;

/**
 * A partir desta largura o tampo DEITADO cabe. Abaixo dela, num aparelho em pé, entra
 * o tampo EM PÉ — que é arte própria, não o deitado espremido.
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
  /**
   * Qual tampo está na tela.
   *
   * Importa porque as duas artes são COMPOSIÇÕES DIFERENTES, não a mesma imagem
   * recortada: no deitado as casas ficam lado a lado num arco largo, no em pé elas
   * ficam numa fileira mais alta e estreita. Quem desenha por cima precisa saber qual
   * mapa de frações usar, e é este campo que diz.
   */
  emPe: boolean;
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
  /** As duas versões da composição deitada; a escolha é por largura de janela. */
  computador: ImageSourcePropType;
  tablet: ImageSourcePropType;
  /**
   * O tampo em pé, 9:16, pra celular. Sem ele a tela cai no deitado, que num aparelho
   * em pé vira uma faixa de mesa entre duas tarjas pretas.
   */
  celular?: ImageSourcePropType;
  /**
   * Quanto de tela os controles ocupam em cima e embaixo, em pixels.
   *
   * A mesa é encaixada no que SOBRA, não na tela inteira. Sem isto, num celular
   * deitado — que é largo e baixo — a mesa ocupava tudo e o trilho de fichas ficava
   * em cima do feltro, tapando a tabela de prêmios do empate. Reservar o espaço antes
   * é a diferença entre uma mesa numa sala e uma mesa com coisas jogadas por cima.
   */
  reserva?: { topo: number; base: number };
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
export function TampoDaMesa({ computador, tablet, celular, reserva, children }: TampoDaMesaProps) {
  const janela = useJanela();
  const { topo: reservaTopo = 0, base: reservaBase = 0 } = reserva ?? {};

  /*
   * O tampo em pé entra quando o aparelho está em pé E é estreito — celular. Um tablet
   * em pé tem largura de sobra pro tampo deitado, e usar o de celular nele desperdiçaria
   * metade da tela.
   */
  const emPe = Boolean(celular) && janela.height > janela.width && janela.width < LARGURA_MINIMA_PRO_TAMPO;

  const palco = useMemo<Palco>(() => {
    /*
     * `contain` dentro do espaço LIVRE, não da janela inteira. O que sobra depois de
     * reservar os controles é a sala; a mesa cresce até esbarrar no lado mais apertado
     * dela e fica centrada nesse pedaço.
     */
    const proporcao = emPe ? PROPORCAO_EM_PE : PROPORCAO_DEITADA;
    const alturaLivre = Math.max(1, janela.height - reservaTopo - reservaBase);
    const proporcaoLivre = janela.width / alturaLivre;
    const largura = proporcaoLivre > proporcao ? alturaLivre * proporcao : janela.width;
    const altura = largura / proporcao;
    return {
      largura,
      altura,
      esquerda: (janela.width - largura) / 2,
      topo: reservaTopo + (alturaLivre - altura) / 2,
      emPe,
    };
  }, [janela.width, janela.height, reservaTopo, reservaBase, emPe]);

  const arte = emPe ? celular! : janela.width >= LARGURA_DE_COMPUTADOR ? computador : tablet;

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
