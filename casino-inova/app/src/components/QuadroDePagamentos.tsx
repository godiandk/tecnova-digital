import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors, fontFamily, fontSize, radius, spacing } from '../theme';

export interface LinhaDePagamento {
  /** O nome que está impresso no feltro. */
  aposta: string;
  /** Quando ela ganha, em português, não em jargão. */
  quando: string;
  /** O que ela devolve, curto: "Paga 1 por 1". Fica na coluna da direita. */
  paga: string;
  /**
   * A regra que não cabe em duas palavras. Vai numa linha inteira embaixo, não
   * espremida na coluna da direita — texto comprido ali empurra o nome da aposta pra
   * uma coluna de três letras de largura e a linha fica ilegível.
   */
  regra?: string;
  /**
   * Quanto dessa aposta volta pro jogador no longo prazo, em fração (0.9841).
   *
   * Vem do motor, nunca escrito à mão aqui: é o mesmo número que decide o pagamento
   * de verdade. Uma tabela que fosse digitada separadamente poderia divergir do código
   * numa mudança e virar propaganda enganosa sem ninguém perceber.
   */
  rtp: number;
}

/**
 * O quadro de pagamentos — o que cada aposta paga, e quanto dela volta.
 *
 * Isto existe por uma regra que vale pro aplicativo inteiro: as chances são
 * divulgadas, sempre, antes de a pessoa apostar. Um jogo que esconde o pagamento
 * obriga quem joga a descobrir perdendo, e essa é exatamente a prática que não
 * entra aqui.
 *
 * Ele ficou necessário quando as mesas viraram pano de verdade: os azulejos de texto
 * que sumiram traziam junto o pagamento de cada aposta ("Linha · meio a meio"), e a
 * arte do feltro imprime o NOME das casas e os números que ganham, mas não imprime
 * quanto elas pagam. O quadro devolve essa informação sem devolver os azulejos.
 */
export function QuadroDePagamentos({
  visivel,
  aoFechar,
  titulo,
  linhas,
  observacao,
}: {
  visivel: boolean;
  aoFechar: () => void;
  titulo: string;
  linhas: LinhaDePagamento[];
  /** A regra que não cabe em nenhuma linha da tabela, mas muda o jogo. */
  observacao?: string;
}) {
  return (
    <Modal visible={visivel} animationType="slide" transparent onRequestClose={aoFechar}>
      <View style={styles.fundo}>
        <SafeAreaView style={styles.folha} edges={['bottom']}>
          <View style={styles.topo}>
            <Text style={styles.titulo}>{titulo}</Text>
            <Pressable onPress={aoFechar} accessibilityRole="button" accessibilityLabel="Fechar" hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.rolagem}>
            {linhas.map((linha) => (
              <View key={linha.aposta} style={styles.linha}>
                <View style={styles.topoDaLinha}>
                  <View style={styles.esquerda}>
                    <Text style={styles.aposta}>{linha.aposta}</Text>
                    <Text style={styles.quando}>{linha.quando}</Text>
                  </View>
                  <View style={styles.direita}>
                    <Text style={styles.paga}>{linha.paga}</Text>
                    <Text style={styles.rtp}>devolve {(linha.rtp * 100).toFixed(2).replace('.', ',')}%</Text>
                  </View>
                </View>
                {linha.regra && <Text style={styles.regra}>{linha.regra}</Text>}
              </View>
            ))}

            {observacao && <Text style={styles.observacao}>{observacao}</Text>}

            <Text style={styles.rodape}>
              &quot;Devolve&quot; é quanto dessa aposta volta pro jogador no longo prazo. O que falta pra 100% é
              a vantagem da casa. Esses números saem da mesma conta que paga a aposta — não são estimativa,
              e não mudam de rodada pra rodada.
            </Text>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fundo: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(4,6,5,0.72)' },
  folha: {
    maxHeight: '82%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  titulo: { fontFamily: fontFamily.displayBold, fontSize: fontSize.lg, color: colors.textPrimary },
  rolagem: { paddingBottom: spacing.lg, gap: spacing.xs },
  linha: {
    gap: 6,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(229,181,103,0.22)',
  },
  topoDaLinha: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  regra: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 19 },
  esquerda: { flex: 1, gap: 2 },
  direita: { alignItems: 'flex-end', gap: 2 },
  aposta: { fontFamily: fontFamily.displayBold, fontSize: fontSize.base, color: colors.goldBright },
  quando: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textSecondary },
  paga: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.base, color: colors.textPrimary, textAlign: 'right' },
  rtp: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textSecondary },
  observacao: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    marginTop: spacing.md,
    lineHeight: 20,
  },
  rodape: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textFaint,
    marginTop: spacing.md,
    lineHeight: 17,
  },
});
