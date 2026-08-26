import { Modal, View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { GameTutorial } from '../data/tutorials';
import { colors, fontFamily, fontSize, radius, spacing } from '../theme';

interface TutorialModalProps {
  visible: boolean;
  gameName: string;
  tutorial: GameTutorial | undefined;
  onClose: () => void;
}

/**
 * Explicação de regras escrita para quem nunca jogou o jogo na vida — sem jargão de
 * cassino. Abre pelo botão de ajuda da mesa e, na primeira visita de cada jogo,
 * sozinha (ver GameTableScreen).
 */
export function TutorialModal({ visible, gameName, tutorial, onClose }: TutorialModalProps) {
  if (!tutorial) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>Como jogar {gameName}</Text>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.paragraph}>{tutorial.whatIsIt}</Text>

            <Text style={styles.sectionLabel}>Como se ganha</Text>
            <Text style={styles.paragraph}>{tutorial.goal}</Text>

            <Text style={styles.sectionLabel}>Passo a passo</Text>
            {tutorial.steps.map((step, index) => (
              <View key={step} style={styles.stepRow}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}

            <Text style={styles.sectionLabel}>Dicas</Text>
            {tutorial.tips.map((tip) => (
              <View key={tip} style={styles.tipRow}>
                <Ionicons name="bulb" size={16} color={colors.goldBright} style={styles.tipIcon} />
                <Text style={styles.stepText}>{tip}</Text>
              </View>
            ))}
          </ScrollView>

          <Pressable onPress={onClose} style={styles.startButton}>
            <Text style={styles.startButtonLabel}>Entendi, quero jogar</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.backgroundCard,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '85%',
    paddingHorizontal: spacing.xl,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.feltLine,
    marginTop: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
  },
  title: { fontFamily: fontFamily.displayBold, fontSize: fontSize.lg, color: colors.textPrimary, flexShrink: 1 },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingBottom: spacing.lg, gap: spacing.sm },
  sectionLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.goldBright,
    marginTop: spacing.md,
  },
  paragraph: { fontFamily: fontFamily.body, fontSize: fontSize.base, lineHeight: 22, color: colors.textPrimary },
  stepRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm, alignItems: 'flex-start' },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.felt,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumberText: { fontFamily: fontFamily.bodyBold, fontSize: fontSize.xs, color: colors.textPrimary },
  stepText: { flex: 1, fontFamily: fontFamily.body, fontSize: fontSize.base, lineHeight: 21, color: colors.textSecondary },
  tipRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, alignItems: 'flex-start' },
  tipIcon: { marginTop: 3 },
  startButton: {
    backgroundColor: colors.goldBright,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  startButtonLabel: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.base, color: colors.background },
});
