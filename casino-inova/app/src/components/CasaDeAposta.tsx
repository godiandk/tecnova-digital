import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AreaDaMesa } from '../data/mapaDosTampos';
import { usePalco } from './TampoDaMesa';
import { colors, fontFamily, fontSize } from '../theme';

interface CasaDeApostaProps {
  area: AreaDaMesa;
  /** Quanto já está apostado aqui. Zero = a casa está vazia. */
  valor: number;
  /** Esta é a casa escolhida agora — fica marcada mesmo com valor zero. */
  escolhida?: boolean;
  /** A rodada fechou: dá pra ver, não dá pra apostar. */
  travada?: boolean;
  /** Esta casa ganhou a rodada. */
  vencedora?: boolean;
  onPress?: () => void;
  children?: ReactNode;
}

/**
 * Uma área de aposta DO PANO — a área que já está desenhada na arte, agora tocável.
 *
 * Este componente é o que tira a mesa do papel de fundo de tela. O nome e o pagamento
 * já estão impressos no feltro, então aqui não se repete nada disso: o que entra é só o
 * que MUDA — a borda acesa quando você escolhe, a ficha que você pôs, e o brilho de
 * quem ganhou.
 *
 * A área não é pintada por cima. Ela fica transparente por padrão, porque a arte já
 * desenhou a casa; um retângulo colorido em cima só sujaria o feltro. O toque é o que
 * ela adiciona.
 */
export function CasaDeAposta({ area, valor, escolhida, travada, vencedora, onPress, children }: CasaDeApostaProps) {
  const palco = usePalco();
  if (!palco) return null;

  const [esquerda, topo, direita, base] = area.caixa;
  const caixa = {
    position: 'absolute' as const,
    left: palco.esquerda + esquerda * palco.largura,
    top: palco.topo + topo * palco.altura,
    width: (direita - esquerda) * palco.largura,
    height: (base - topo) * palco.altura,
  };

  return (
    <Pressable
      onPress={travada ? undefined : onPress}
      disabled={travada}
      accessibilityRole="button"
      accessibilityLabel={area.rotulo}
      accessibilityState={{ selected: Boolean(escolhida), disabled: Boolean(travada) }}
      accessibilityHint={valor > 0 ? `${valor} fichas apostadas aqui` : undefined}
      style={[caixa, styles.casa, escolhida && styles.escolhida, vencedora && styles.vencedora]}
    >
      {children}
      {valor > 0 && (
        <View style={styles.selo}>
          <Text style={styles.seloValor}>{valor.toLocaleString('pt-BR')}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /*
   * Sem cor de fundo: a arte já pintou a casa. O que este componente acrescenta é o
   * toque e o estado — pintar por cima cobriria o feltro que o jogo comprou.
   */
  casa: {
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 10,
  },
  escolhida: { borderColor: colors.goldBright, backgroundColor: 'rgba(255,217,138,0.12)' },
  vencedora: { borderColor: colors.success, backgroundColor: 'rgba(63,191,127,0.18)' },
  selo: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(11,15,13,0.85)',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  seloValor: { fontFamily: fontFamily.displayBold, fontSize: fontSize.base, color: colors.goldBright },
});
