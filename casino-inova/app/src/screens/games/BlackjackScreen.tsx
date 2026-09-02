import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../../navigation/types';
import { getTutorialByGameId } from '../../data/tutorials';
import { TABLE_IMAGES } from '../../data/tableImages';
import { DEALER_IMAGES } from '../../data/dealerImages';
import { TutorialModal } from '../../components/TutorialModal';
import { GameBackdrop } from '../../components/GameBackdrop';
import { DealerBadge } from '../../components/DealerBadge';
import { ChipStack } from '../../components/ChipStack';
import { Carta } from '../../components/Carta';
import { ApiError, novaAcao } from '../../api/client';
import {
  fetchBlackjackConfig,
  startBlackjackHand,
  hitBlackjack,
  standBlackjack,
  doubleBlackjack,
  splitBlackjack,
  insureBlackjack,
  BlackjackConfig,
  BlackjackHandResponse,
  MaoDeBlackjack,
} from '../../api/blackjack';
import { usePlayer } from '../../data/usePlayer';
import { colors, fontFamily, fontSize, radius, spacing, useJanela } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Blackjack'>;

const BET_STEP = 50;

/**
 * A largura da carta acompanha a tela: quatro cartas lado a lado, com folga pro selo do
 * total e as margens. Num celular de 360 dá ~58px; num tablet, o teto de 84.
 *
 * Escrever o número fixo faria a carta ficar minúscula na tela grande e estourar na
 * pequena — que era o problema da versão anterior desta tela.
 */
function larguraDaCarta(larguraDaTela: number): number {
  const disponivel = Math.min(larguraDaTela, 560) - spacing.lg * 2 - 70;
  return Math.max(52, Math.min(84, Math.floor(disponivel / 4)));
}

/**
 * A partir da quinta carta as seguintes entram sobrepostas, pra a mão não estourar a
 * largura da tela. Cinco cartas numa mão é raro mas acontece — e quando acontece é
 * justamente a mão que o jogador mais quer ver.
 */
const CARTAS_SEM_SOBREPOR = 4;
/** Quanto da carta sobreposta continua aparecendo. O naipe e o valor ficam no canto. */
const FRACAO_VISIVEL = 0.35;

const OUTCOME_LABEL: Record<NonNullable<MaoDeBlackjack['outcome']>, string> = {
  'jogador-ganhou': 'Você ganhou!',
  'dealer-ganhou': 'A casa ganhou.',
  empate: 'Empate — sua aposta voltou.',
};

/** Tudo que está na mesa agora: cada mão mais o seguro, se foi feito. */
function apostaTotal(hand: BlackjackHandResponse): number {
  return hand.maos.reduce((soma, mao) => soma + mao.aposta, 0) + hand.seguro;
}

/**
 * Uma mão aberta na mesa: cartas EM PÉ e LADO A LADO, não em leque.
 *
 * Leque é mão que a pessoa segura (truco, pôquer). Carta de blackjack fica aberta no
 * pano pra todo mundo ler — inclusive a sua, porque não tem nada a esconder de
 * ninguém. Da quinta carta em diante elas se sobrepõem, senão a mão sai da tela.
 */
function MaoAberta({ cartas, largura }: { cartas: (string | null)[]; largura: number }) {
  return (
    <View style={styles.mao}>
      {cartas.map((carta, indice) => (
        <View
          key={indice}
          style={indice >= CARTAS_SEM_SOBREPOR ? { marginLeft: -largura * (1 - FRACAO_VISIVEL) } : undefined}
        >
          <Carta carta={carta} indice={indice} largura={largura} />
        </View>
      ))}
    </View>
  );
}

/** O selo do total. Aceso na mão da vez — dividindo, é o que diz de qual mão são os botões. */
function SeloDoTotal({ total, mole, emJogo }: { total: number; mole?: boolean; emJogo?: boolean }) {
  return (
    <View style={[styles.selo, emJogo && styles.seloAceso]}>
      <Text style={styles.seloTexto}>{total}</Text>
      {/* "Mole" é a mão com Ás valendo 11: não estoura na próxima carta, e é o que
          muda a decisão. Sem isso o jogador vê "17" e não sabe se pode pedir. */}
      {mole && <Text style={styles.seloMole}>mole</Text>}
    </View>
  );
}

export function BlackjackScreen({ navigation }: Props) {
  const tutorial = getTutorialByGameId('blackjack');
  const janela = useJanela();
  const carta = larguraDaCarta(janela.width);

  const [tutorialVisible, setTutorialVisible] = useState(true);
  const [config, setConfig] = useState<BlackjackConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const { jogador } = usePlayer();

  useEffect(() => {
    if (jogador) setBalance(jogador.chipBalance);
  }, [jogador]);

  const [bet, setBet] = useState(100);
  const [hand, setHand] = useState<BlackjackHandResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetchBlackjackConfig()
      .then((data) => {
        setConfig(data);
        setBet(Math.max(data.minBet, Math.min(100, data.maxBet)));
      })
      .catch((error: unknown) => {
        setConfigError(error instanceof ApiError ? error.message : 'Não foi possível falar com o servidor.');
      });
  }, []);

  const emJogo = Boolean(hand && !hand.finished);

  const adjustBet = (delta: number) => {
    if (!config) return;
    setBet((atual) => Math.max(config.minBet, Math.min(config.maxBet, atual + delta)));
  };

  const run = async (acao: () => Promise<BlackjackHandResponse>) => {
    setBusy(true);
    setActionError(null);
    try {
      const resultado = await acao();
      setHand(resultado);
      setBalance(resultado.newBalance);
    } catch (erro) {
      setActionError(erro instanceof ApiError ? erro.message : 'Não foi possível completar a ação agora.');
    } finally {
      setBusy(false);
    }
  };

  const distribuir = () => {
    // Um id por toque: se esta mão precisar ser reenviada, o servidor devolve a que já
    // existe em vez de cobrar de novo.
    const acao = novaAcao();
    run(() => startBlackjackHand(bet, acao));
  };

  return (
    <GameBackdrop source={TABLE_IMAGES.blackjack}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            style={styles.iconButton}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <ChipStack amount={balance} />
          <Pressable
            onPress={() => setTutorialVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Como jogar"
            style={styles.iconButton}
            hitSlop={12}
          >
            <Ionicons name="help-circle" size={24} color={colors.goldBright} />
          </Pressable>
        </View>

        <View style={styles.titleRow}>
          <DealerBadge source={DEALER_IMAGES.blackjack} />
          <Text style={styles.title}>Blackjack</Text>
        </View>

        {!config && !configError && <ActivityIndicator color={colors.goldBright} style={styles.loading} />}

        {configError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{configError}</Text>
            <Text style={styles.errorHint}>Confira se o servidor (server/) está rodando em npm run start:dev.</Text>
          </View>
        )}

        {config && (
          <ScrollView
            style={styles.rolagem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.corpo}
          >
            <Text style={styles.regraDaMesa}>
              Blackjack paga 3 por 2 · dealer para em 17 · {config.baralhos} baralhos
            </Text>

            {/* --- Casa --- */}
            <View style={styles.bloco}>
              <Text style={styles.rotuloDoBloco}>CASA</Text>
              {hand ? (
                <View style={styles.linhaDaMao}>
                  <MaoAberta cartas={hand.cartasDoDealer} largura={carta} />
                  {hand.totalDoDealer !== undefined && <SeloDoTotal total={hand.totalDoDealer} />}
                </View>
              ) : (
                <View style={[styles.vagaVazia, { height: carta * 1.5 }]} />
              )}
            </View>

            {/* --- Suas mãos. Dividindo, viram até quatro, cada uma com o seu resultado. --- */}
            <View style={styles.bloco}>
              <Text style={styles.rotuloDoBloco}>
                {hand && hand.maos.length > 1 ? `SUAS MÃOS (${hand.maos.length})` : 'VOCÊ'}
              </Text>

              {hand ? (
                hand.maos.map((mao, indice) => (
                  <View key={indice} style={[styles.suaMao, mao.emJogo && styles.suaMaoAtiva]}>
                    <View style={styles.linhaDaMao}>
                      <MaoAberta cartas={mao.cartas} largura={carta} />
                      <SeloDoTotal total={mao.total} mole={mao.mole} emJogo={mao.emJogo} />
                    </View>

                    <View style={styles.linhaDaAposta}>
                      <Text style={styles.apostaDaMao}>
                        {mao.aposta.toLocaleString('pt-BR')}
                        {mao.dobrada ? ' · dobrada' : ''}
                        {mao.blackjack ? ' · BLACKJACK' : ''}
                        {mao.estourou ? ' · estourou' : ''}
                      </Text>
                      {mao.outcome && (
                        <Text
                          style={[
                            styles.resultadoDaMao,
                            mao.outcome === 'jogador-ganhou' ? styles.ganhou : mao.outcome === 'empate' ? styles.empatou : styles.perdeu,
                          ]}
                        >
                          {OUTCOME_LABEL[mao.outcome]}
                          {mao.totalReturn ? ` +${mao.totalReturn.toLocaleString('pt-BR')}` : ''}
                        </Text>
                      )}
                    </View>
                  </View>
                ))
              ) : (
                <View style={[styles.vagaVazia, { height: carta * 1.5 }]} />
              )}
            </View>

            {actionError && <Text style={styles.errorText}>{actionError}</Text>}

            {/* --- Seguro: trava a mesa até ser respondido, como na mesa de verdade --- */}
            {hand?.esperandoSeguro && (
              <View style={styles.caixaDeSeguro}>
                <Text style={styles.avisoSeguro}>
                  A casa mostra Ás. O seguro custa {hand.seguroMaximo} e paga 2 por 1 — mas é a pior aposta da
                  mesa: a longo prazo perde mais do que ganha.
                </Text>
                <View style={styles.acoes}>
                  <Pressable
                    onPress={() => run(() => insureBlackjack(false))}
                    disabled={busy}
                    style={[styles.botaoPrincipal, busy && styles.desabilitado]}
                  >
                    <Text style={styles.botaoPrincipalTexto}>Não quero seguro</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => run(() => insureBlackjack(true))}
                    disabled={busy}
                    style={[styles.botaoSecundario, busy && styles.desabilitado]}
                  >
                    <Text style={styles.botaoSecundarioTexto}>Fazer seguro</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* --- Ações da mão. Quem liga e desliga cada botão é o servidor. --- */}
            {emJogo && !hand?.esperandoSeguro && (
              <View style={styles.acoes}>
                <Pressable
                  onPress={() => run(hitBlackjack)}
                  disabled={busy || !hand?.podeComprar}
                  style={[styles.botaoSecundario, (busy || !hand?.podeComprar) && styles.desabilitado]}
                >
                  <Text style={styles.botaoSecundarioTexto}>Pedir</Text>
                </Pressable>

                {hand?.podeDobrar && (
                  <Pressable
                    onPress={() => run(doubleBlackjack)}
                    disabled={busy}
                    style={[styles.botaoSecundario, busy && styles.desabilitado]}
                  >
                    <Text style={styles.botaoSecundarioTexto}>Dobrar</Text>
                  </Pressable>
                )}

                {hand?.podeDividir && (
                  <Pressable
                    onPress={() => run(splitBlackjack)}
                    disabled={busy}
                    style={[styles.botaoSecundario, busy && styles.desabilitado]}
                  >
                    <Text style={styles.botaoSecundarioTexto}>Dividir</Text>
                  </Pressable>
                )}

                <Pressable
                  onPress={() => run(standBlackjack)}
                  disabled={busy || !hand?.podeParar}
                  style={[styles.botaoPrincipal, (busy || !hand?.podeParar) && styles.desabilitado]}
                >
                  {busy ? <ActivityIndicator color={colors.background} /> : <Text style={styles.botaoPrincipalTexto}>Parar</Text>}
                </Pressable>
              </View>
            )}

            {/* --- Aposta: só entre mãos --- */}
            {!emJogo && (
              <View style={styles.areaDeAposta}>
                <View style={styles.linhaDeAposta}>
                  <Pressable
                    onPress={() => adjustBet(-BET_STEP)}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel="Diminuir a aposta"
                    style={styles.botaoRedondo}
                  >
                    <Ionicons name="remove" size={20} color={colors.textPrimary} />
                  </Pressable>
                  <View style={styles.valorDaAposta}>
                    <Text style={styles.rotuloDaAposta}>{hand ? 'APOSTA DA PRÓXIMA' : 'APOSTA'}</Text>
                    <Text style={styles.numeroDaAposta}>{bet.toLocaleString('pt-BR')}</Text>
                  </View>
                  <Pressable
                    onPress={() => adjustBet(BET_STEP)}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel="Aumentar a aposta"
                    style={styles.botaoRedondo}
                  >
                    <Ionicons name="add" size={20} color={colors.textPrimary} />
                  </Pressable>
                </View>

                {hand?.finished && (
                  <Text style={styles.totalDaMao}>
                    A mão anterior valeu {apostaTotal(hand).toLocaleString('pt-BR')} no total.
                  </Text>
                )}

                <Pressable
                  onPress={distribuir}
                  disabled={busy}
                  style={[styles.botaoPrincipal, styles.botaoLargo, busy && styles.desabilitado]}
                >
                  {busy ? <ActivityIndicator color={colors.background} /> : <Text style={styles.botaoPrincipalTexto}>Distribuir</Text>}
                </Pressable>
              </View>
            )}

            {/* A sapata embaralha sozinha perto do fim, como na mesa. Dizer quantas
                cartas faltam é informação real e verificável, não enfeite. */}
            {hand && (
              <Text style={styles.sapata}>
                {hand.embaralhouAgora ? 'Sapata embaralhada. ' : ''}
                {hand.cartasAteOCorte} cartas até o corte
              </Text>
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      <TutorialModal
        visible={tutorialVisible}
        gameName="Blackjack"
        tutorial={tutorial}
        onClose={() => setTutorialVisible(false)}
      />
    </GameBackdrop>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,15,13,0.55)',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.sm },
  title: { fontFamily: fontFamily.displayBold, fontSize: fontSize.xl, color: colors.textPrimary },

  loading: { marginTop: spacing.xxxl },
  errorBox: { marginTop: spacing.xxxl, alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg },
  errorText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.danger, textAlign: 'center' },
  errorHint: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint, textAlign: 'center' },

  /*
   * `flexGrow` + `justifyContent` espalha o conteúdo pela coluna. Sem isso, numa tela
   * alta tudo se amontoa no topo e sobra meia tela preta embaixo — que era como a
   * versão anterior aparecia no tablet.
   */
  rolagem: { flex: 1 },
  corpo: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },

  /* As regras da mesa ficam escritas, como no feltro de uma mesa de verdade. */
  regraDaMesa: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },

  bloco: { gap: spacing.xs },
  rotuloDoBloco: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
    letterSpacing: 1.2,
    color: colors.gold,
  },
  linhaDaMao: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mao: { flexDirection: 'row', alignItems: 'center' },
  /* Espaço reservado antes de distribuir: a mesa não "pula" quando as cartas chegam. */
  vagaVazia: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.feltLine,
    backgroundColor: 'rgba(11,15,13,0.35)',
  },

  suaMao: {
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    // Opaco o bastante pra a arte da mesa não aparecer atrás das cartas: o feltro tem
    // as regras escritas, e elas competiam com o valor da carta.
    backgroundColor: 'rgba(11,15,13,0.74)',
    gap: spacing.xs,
  },
  /* A mão da vez fica acesa: dividindo, é o que diz de qual mão são os botões. */
  suaMaoAtiva: { borderColor: colors.goldBright, backgroundColor: 'rgba(40,34,16,0.80)' },
  linhaDaAposta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  apostaDaMao: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.xs, color: colors.textSecondary },
  resultadoDaMao: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.xs, flexShrink: 1, textAlign: 'right' },
  ganhou: { color: colors.success },
  perdeu: { color: colors.danger },
  empatou: { color: colors.textSecondary },

  selo: {
    minWidth: 52,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: 'rgba(11,15,13,0.82)',
    alignItems: 'center',
  },
  seloAceso: { borderColor: colors.goldBright, backgroundColor: 'rgba(255,217,138,0.18)' },
  seloTexto: { fontFamily: fontFamily.displayBold, fontSize: fontSize.lg, color: colors.textPrimary },
  seloMole: { fontFamily: fontFamily.body, fontSize: 10, color: colors.textSecondary, marginTop: -2 },

  caixaDeSeguro: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: 'rgba(11,15,13,0.72)',
    gap: spacing.sm,
  },
  avisoSeguro: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.goldBright },

  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  botaoPrincipal: {
    minWidth: 120,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.goldBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoLargo: { alignSelf: 'stretch' },
  botaoPrincipalTexto: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.base, color: colors.background },
  botaoSecundario: {
    minWidth: 96,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: 'rgba(11,15,13,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoSecundarioTexto: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.base, color: colors.textPrimary },
  desabilitado: { opacity: 0.45 },

  areaDeAposta: { gap: spacing.sm },
  linhaDeAposta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  botaoRedondo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: 'rgba(11,15,13,0.6)',
  },
  valorDaAposta: { alignItems: 'center', minWidth: 120 },
  rotuloDaAposta: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textSecondary, letterSpacing: 1 },
  numeroDaAposta: { fontFamily: fontFamily.displayBold, fontSize: fontSize.xl, color: colors.textPrimary },
  totalDaMao: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textSecondary, textAlign: 'center' },

  sapata: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint, textAlign: 'center' },
});
