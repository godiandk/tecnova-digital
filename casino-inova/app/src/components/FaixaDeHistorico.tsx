import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RoadOutcome, Roadmap } from '../api/roadmap';
import { VocabularioDoPlacar } from './RoadmapPanel';
import { colors, fontFamily, radius } from '../theme';

/**
 * A faixa de histórico — o que saiu nas últimas rodadas, sempre à vista.
 *
 * Numa mesa de verdade o placar fica num monitor ao lado, ligado o tempo todo: ninguém
 * precisa pedir pra ver o que saiu. As cinco estradas completas não cabem em cima do
 * pano, mas as últimas contas cabem, e são elas que a pessoa olha de relance. Tocar
 * abre o placar inteiro.
 *
 * A COR É A MESMA EM TODA MESA e a letra é da casa: vermelho pro lado que paga como
 * banca, azul pro que paga como jogador, verde pro empate — com G, P e A na Banca
 * Francesa, e J, B e E no Bac Bo. Marca padronizada, palavra da mesa.
 *
 * E O QUE ELA NÃO É: um sinal. O histórico mostra o que já saiu e não muda a chance da
 * próxima rodada em nada — cada sorteio começa do zero. A faixa existe porque faz parte
 * da mesa e porque quem joga quer ver, não porque prevê coisa alguma; o placar inteiro
 * repete isso escrito, e este componente nunca desenha seta, tendência ou sugestão.
 */
const COR: Record<RoadOutcome, string> = {
  banca: colors.ruby,
  jogador: colors.sapphire,
  empate: colors.success,
};

export function FaixaDeHistorico({
  roadmap,
  vocabulario,
  quantas = 14,
  onPress,
}: {
  roadmap: Roadmap | null;
  vocabulario: VocabularioDoPlacar;
  quantas?: number;
  onPress?: () => void;
}) {
  // O bead plate é a estrada que guarda TODA rodada na ordem, empate incluído — é a
  // única que serve pra "as últimas N", porque o big road funde empate na célula
  // anterior e perderia rodadas.
  const todas = (roadmap?.beadPlate ?? []).flat();
  if (todas.length === 0) return null;
  const ultimas = todas.slice(-quantas);

  const letra = (o: RoadOutcome) => vocabulario[o].charAt(0).toUpperCase();
  const emVozAlta = ultimas.map((c) => vocabulario[c.outcome]).join(', ');

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`Últimas ${ultimas.length} rodadas: ${emVozAlta}. O histórico não muda a chance da próxima.`}
      style={styles.faixa}
    >
      {ultimas.map((celula, i) => (
        <View key={i} style={[styles.conta, { backgroundColor: COR[celula.outcome] }]}>
          <Text style={styles.letra}>{letra(celula.outcome)}</Text>
        </View>
      ))}
    </Pressable>
  );
}

const TAMANHO = 22;

const styles = StyleSheet.create({
  faixa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(11,15,13,0.66)',
  },
  conta: {
    width: TAMANHO,
    height: TAMANHO,
    borderRadius: TAMANHO / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letra: { fontFamily: fontFamily.displayBold, fontSize: 12, color: '#0B0F0D' },
});
