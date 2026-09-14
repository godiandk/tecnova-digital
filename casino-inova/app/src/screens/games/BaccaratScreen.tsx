import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Modal } from 'react-native';
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
import { RoadmapPanel } from '../../components/RoadmapPanel';
import { PanoDoBacara } from '../../components/PanoDoBacara';
import { ApiError, mensagemParaOJogador } from '../../api/client';
import { Roadmap } from '../../api/roadmap';
import { fetchBaccaratConfig, fetchBaccaratRoadmap, playBaccaratRound, BaccaratConfig, BaccaratBetType, BaccaratRoundResponse } from '../../api/baccarat';
import { usePlayer, saldoChegouDeFora } from '../../data/usePlayer';
import { SeletorDeAposta, ajustar, apostaInicial, useFaixaDeAposta } from '../../aposta';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Baccarat'>;

/** Largura da carta. Três por lado, que é o máximo no bacará. */
const LARGURA_DA_CARTA = 58;

const OUTCOME_LABEL: Record<BaccaratBetType, string> = {
  jogador: 'Jogador venceu',
  banca: 'Banca venceu',
  empate: 'Empate',
};

function Hand({ label, cards, total }: { label: string; cards: string[]; total: number }) {
  return (
    <View style={styles.handBlock}>
      <Text style={styles.handLabel}>
        {label} · {total}
      </Text>
      <View style={styles.cardRow}>
        {cards.map((card, index) => (
          <Carta key={index} carta={card} indice={index} largura={LARGURA_DA_CARTA} />
        ))}
      </View>
    </View>
  );
}

export function BaccaratScreen({ navigation }: Props) {
  const tutorial = getTutorialByGameId('bacara');

  const [tutorialVisible, setTutorialVisible] = useState(true);
  const [placarAberto, setPlacarAberto] = useState(false);
  const [config, setConfig] = useState<BaccaratConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const { jogador } = usePlayer();

  /*
   * O SALDO NÃO TEM CÓPIA NESTA TELA, e isso conserta um defeito que fazia o número ANDAR
   * PARA TRÁS depois de uma vitória.
   *
   * Era uma cópia local (`useState`) sincronizada com o estado compartilhado por um efeito.
   * Como o efeito roda a cada mudança do objeto `jogador`, uma busca de saldo disparada
   * ANTES da aposta — e que voltava DEPOIS dela — reescrevia o saldo velho por cima do
   * novo. A pessoa via o prêmio na tela e o número voltava ao que era.
   *
   * Agora existe uma fonte só: o estado compartilhado. O `newBalance` que o servidor
   * devolve entra nele por `saldoChegouDeFora`, e toda tela montada (inclusive o salão,
   * que fica embaixo) vê o mesmo número no mesmo instante.
   */
  const balance = jogador?.chipBalance ?? 0;

  /* Abre em ZERO: quem decide o valor inicial é o degrau da mesa, não um número fixo. */
  const [amount, setAmount] = useState(0);
  const [betType, setBetType] = useState<BaccaratBetType>('banca');
  const [round, setRound] = useState<BaccaratRoundResponse | null>(null);
  const [playing, setPlaying] = useState(false);
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);

  useEffect(() => {
    fetchBaccaratConfig()
      .then(setConfig)
      .catch((error: unknown) => {
        setConfigError(mensagemParaOJogador(error, 'Não foi possível falar com o servidor.'));
      });
    fetchBaccaratRoadmap().then(setRoadmap).catch(() => undefined);
  }, []);

  /*
   * A faixa vem do DEGRAU da pessoa, e não da configuração do jogo: o `minBet` da
   * configuração é sempre o do Bronze, enquanto o servidor valida a aposta contra o
   * degrau de verdade. Quem tinha saldo de mesa alta tomava 400 em toda aposta.
   */
  const faixa = useFaixaDeAposta(balance, config?.maiorMultiplicador);

  /* Quando o saldo muda de degrau, a aposta é reancorada na faixa nova. */
  useEffect(() => {
    if (!faixa) return;
    setAmount((atual) => (atual > 0 ? ajustar(faixa, atual) : apostaInicial(faixa)));
  }, [faixa?.minimo, faixa?.saldo]);

  const handlePlay = async () => {
    if (!config || playing || amount <= 0) return;
    setPlaying(true);
    setPlayError(null);
    try {
      const result = await playBaccaratRound(betType, amount);
      setRound(result);
      saldoChegouDeFora(result.newBalance);
      setRoadmap(result.roadmap);
    } catch (error) {
      setPlayError(mensagemParaOJogador(error, 'Não foi possível apostar agora.'));
    } finally {
      setPlaying(false);
    }
  };

  return (
    /*
      O PANO IMPRESSO RECUA, a mesa fica. Com o pano desenhado por cima, a tela mostrava
      DOIS bacarás: o nosso, com três casas no tamanho de quem vai tocar, e o da
      fotografia, com PLAYER/BANKER/TIE impressos em doze lugares atravessando as nossas
      casas. Não é que o de trás esteja errado — é que ninguém precisa de duas mesas na
      mesma tela. `panoProprio` põe um véu nas linhas dele e mantém o couro, a madeira e a
      luz do salão, que são o que fazem a tela parecer um cassino.
    */
    <GameBackdrop source={TABLE_IMAGES.bacara} panoProprio>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar" style={styles.iconButton} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <ChipStack amount={balance} />
          <View style={styles.acoesDoTopo}>
            {/*
              O PLACAR MORA ATRÁS DESTE BOTÃO, não empilhado embaixo da mesa — o mesmo
              lugar em que o Bac Bo já o põe, e pelo mesmo motivo: numa casa de verdade o
              histórico fica num monitor AO LADO da mesa, não sobre o feltro.

              Aqui isso não é só arrumação. Medindo a tela em jogo (390 x 844), o bacará
              era o ÚNICO dos dez jogos que transbordava — 559 pixels —, e o que
              transbordava era exatamente este painel, que só aparece depois da primeira
              rodada. Com ele atrás do botão, a mesa cabe e a rolagem sai.
            */}
            {roadmap && roadmap.totals.total > 0 && (
              <Pressable
                onPress={() => setPlacarAberto(true)}
                accessibilityRole="button"
                accessibilityLabel="Histórico da mesa"
                style={styles.iconButton}
                hitSlop={12}
              >
                <Ionicons name="stats-chart" size={20} color={colors.textPrimary} />
              </Pressable>
            )}
            <Pressable onPress={() => setTutorialVisible(true)} accessibilityRole="button" accessibilityLabel="Como jogar" style={styles.iconButton} hitSlop={12}>
              <Ionicons name="help-circle" size={24} color={colors.goldBright} />
            </Pressable>
          </View>
        </View>

        {/*
          A MESA NÃO ROLA. Era um `ScrollView` de tela inteira, e a medição em 390 x 844
          mostrou que o que transbordava (559 px) era o painel do placar — que agora mora
          atrás do botão no topo. Sem ele, a mesa cabe: rolar é gesto de documento, e uma
          mesa cabe na tela ou não é uma mesa.
        */}
        <View style={styles.mesa}>
        <View style={styles.titleRow}>
          <DealerBadge source={DEALER_IMAGES.bacara} />
          <Text style={styles.title}>Bacará</Text>
        </View>

        {!config && !configError && <ActivityIndicator color={colors.goldBright} style={styles.loading} />}
        {configError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{configError}</Text>
            <Text style={styles.errorHint}>Confira se o servidor (server/) está rodando em npm run start:dev.</Text>
          </View>
        )}

        {config && (
          <>
            {/*
              AS DUAS MÃOS FICAM NO PANO, e o espaço delas é reservado desde o começo.
              Antes, sem rodada, este bloco era a frase "Escolha onde apostar e mande
              jogar." — texto cinzento boiando no feltro. Agora o lugar das cartas é o
              lugar das cartas: vazio antes de distribuir, com as cartas depois, e a mesa
              não pula de altura quando a rodada sai.
            */}
            <View style={styles.table}>
              {round && (
                <>
                  <Hand label="Banca" cards={round.bankerCards} total={round.bankerTotal} />
                  <Hand label="Jogador" cards={round.playerCards} total={round.playerTotal} />
                </>
              )}
            </View>

            {/*
              O PANO, no lugar das três pílulas de texto. A ficha encosta na casa; a casa
              que ganhou acende. Ver `PanoDoBacara`.
            */}
            <PanoDoBacara
              escolhida={betType}
              valor={amount}
              venceu={round ? round.winner : null}
              travado={playing}
              onEncostar={setBetType}
            />

            {round && (
              <Text style={[styles.resultLabel, round.winner === round.betType ? styles.resultWin : styles.resultLoss]}>
                {OUTCOME_LABEL[round.winner]}
                {round.totalReturn > 0 ? ` — +${round.totalReturn.toLocaleString('pt-BR')} fichas` : ' — não foi dessa vez'}
              </Text>
            )}

            {playError && <Text style={styles.errorText}>{playError}</Text>}

            {faixa && (
              <SeletorDeAposta faixa={faixa} valor={amount} aoMudar={setAmount} travado={playing} />
            )}

            <Pressable onPress={handlePlay} disabled={playing} style={[styles.primaryButton, playing && styles.buttonDisabled]}>
              {playing ? <ActivityIndicator color={colors.background} /> : <Text style={styles.primaryButtonLabel}>Apostar</Text>}
            </Pressable>

          </>
        )}
        </View>
      </SafeAreaView>

      <Modal visible={placarAberto} animationType="slide" transparent onRequestClose={() => setPlacarAberto(false)}>
        <View style={styles.fundoDoPlacar}>
          <SafeAreaView style={styles.folhaDoPlacar} edges={['bottom']}>
            <View style={styles.topoDoPlacar}>
              <Text style={styles.tituloDoPlacar}>Histórico da mesa</Text>
              <Pressable onPress={() => setPlacarAberto(false)} accessibilityRole="button" accessibilityLabel="Fechar" hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </Pressable>
            </View>
            {/* Aqui a rolagem é certa: é uma folha de histórico, e histórico é documento. */}
            <ScrollView showsVerticalScrollIndicator={false}>
              {roadmap && <RoadmapPanel roadmap={roadmap} />}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>

      <TutorialModal
        visible={tutorialVisible}
        gameName="Bacará"
        tutorial={tutorial}
        onClose={() => setTutorialVisible(false)}
      />
    </GameBackdrop>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: spacing.xl },
  /*
   * A MESA OCUPA A ALTURA LIVRE e centra o conteúdo nela. Era um `contentContainerStyle`
   * de rolagem com um `paddingBottom` grande no fim — o padding existia justamente pra o
   * último controle não colar na borda de um conteúdo que rolava. Sem rolagem, o que
   * organiza é o `flex`.
   */
  /*
   * A MESA OCUPA A ALTURA LIVRE, DE CIMA PRA BAIXO.
   *
   * `justifyContent: 'center'` era o que parecia certo e estava errado: quando o conteúdo
   * passa da altura livre, o centro empurra a sobra PROS DOIS LADOS — o título subiu por
   * cima do saldo e o botão "Apostar" saiu pela borda de baixo. Cortado dos dois lados é
   * pior que rolando.
   *
   * Começando de cima, a sobra (quando houver) vai toda pra baixo, e é a mesa das cartas
   * que encolhe primeiro — ela é quem tem folga. Os espaços entre os blocos são `gap`, e
   * não `marginTop` empilhado: margem somada é o que fazia a conta estourar sem ninguém
   * ver de onde vinha.
   */
  mesa: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', gap: spacing.sm, paddingBottom: spacing.md },
  acoesDoTopo: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },

  /* A folha do placar: sobe de baixo, cobre metade da tela, e fecha no X. */
  fundoDoPlacar: { flex: 1, backgroundColor: 'rgba(4,6,5,0.72)', justifyContent: 'flex-end' },
  folhaDoPlacar: {
    maxHeight: '75%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  topoDoPlacar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  tituloDoPlacar: { fontFamily: fontFamily.displayBold, fontSize: fontSize.lg, color: colors.textPrimary },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: spacing.sm,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 20,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontFamily: fontFamily.displayExtraBold, fontSize: fontSize.xl, color: colors.textPrimary },
  loading: { marginTop: spacing.xxxl },
  errorBox: { marginTop: spacing.xxxl, alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg },
  errorText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.danger, textAlign: 'center' },
  errorHint: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint, textAlign: 'center' },
  /*
   * O lugar das cartas ENCOLHE antes de qualquer outra coisa: `flexShrink` com um mínimo
   * que ainda mostra uma carta. As duas mãos cabem em 180 com as cartas de 58.
   */
  table: { width: '100%', flexShrink: 1, gap: spacing.md, minHeight: 180, justifyContent: 'center' },
  handBlock: { gap: spacing.sm, alignItems: 'center' },
  handLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, color: colors.textSecondary },
  cardRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'center' },
  resultLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.base, textAlign: 'center' },
  resultWin: { color: colors.goldBright },
  resultLoss: { color: colors.textFaint },
  primaryButton: {
    backgroundColor: colors.goldBright,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxxl,
    marginTop: spacing.sm,
    minWidth: 180,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonLabel: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.md, color: colors.background },
});
