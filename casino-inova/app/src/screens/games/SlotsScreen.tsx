import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../../navigation/types';
import { getTutorialByGameId } from '../../data/tutorials';
import { TABLE_IMAGES } from '../../data/tableImages';
import { TutorialModal } from '../../components/TutorialModal';
import { GameBackdrop } from '../../components/GameBackdrop';
import { ChipStack } from '../../components/ChipStack';
import { Rolo } from '../../components/Rolo';
import { ApiError, novaAcao } from '../../api/client';
import { fetchSlotsConfig, spinSlots, SlotsConfig, WinningLineDto } from '../../api/slots';
import { usePlayer } from '../../data/usePlayer';
import { SeletorDeAposta, apostaInicial, ajustar, useFaixaDeAposta } from '../../aposta';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Slots'>;

/**
 * Tamanho de uma célula do gabinete, em pixel. Cinco rolos cabem numa tela de celular
 * só com a célula menor do que era na grade 3x3 — daí o valor mais apertado.
 */
const CELULA = 58;

/**
 * A grade vem do servidor em linha (da esquerda pra direita, de cima pra baixo), mas o
 * rolo é uma COLUNA. Aqui a leitura é virada de lado. O passo entre as fileiras é a
 * quantidade de rolos, que o servidor informa — nada de número mágico.
 */
function colunaDoResultado(grade: string[] | null, coluna: number, rolos: number, fileiras: number): string[] | null {
  if (!grade) return null;
  return Array.from({ length: fileiras }, (_, fileira) => grade[fileira * rolos + coluna]);
}

/**
 * As células a acender já vêm prontas do servidor, em `line.cells` — ele é quem sabe
 * onde a combinação começou e onde quebrou. Antes a tela tinha uma cópia das paylines
 * e recalculava por conta própria: duas fontes da mesma verdade, e a tela acendendo
 * célula que não pagou era só questão de tempo.
 */
function winningCellSet(winningLines: WinningLineDto[]): Set<number> {
  const cells = new Set<number>();
  winningLines.forEach((line) => line.cells.forEach((cell) => cells.add(cell)));
  return cells;
}

export function SlotsScreen({ navigation }: Props) {
  const tutorial = getTutorialByGameId('slots');

  const [tutorialVisible, setTutorialVisible] = useState(true);
  const [config, setConfig] = useState<SlotsConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const { jogador } = usePlayer();

  // Semeia o saldo com a carteira de verdade; a partir da primeira aposta quem manda é
  // o `newBalance` que o servidor devolve.
  useEffect(() => {
    if (jogador) setBalance(jogador.chipBalance);
  }, [jogador]);
  /*
   * A aposta começa em ZERO e só ganha valor quando a faixa da mesa chega.
   *
   * Antes era `useState(100)` — um número inventado, que numa mesa cujo mínimo é 500
   * milhões nem era aposta válida. Agora quem decide onde ela abre é o degrau da pessoa.
   */
  const [bet, setBet] = useState(0);
  const [grid, setGrid] = useState<string[] | null>(null);
  const [winningLines, setWinningLines] = useState<WinningLineDto[]>([]);
  const [lastWin, setLastWin] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [spinError, setSpinError] = useState<string | null>(null);

  useEffect(() => {
    fetchSlotsConfig()
      .then(setConfig)
      .catch((error: unknown) => {
        setConfigError(error instanceof ApiError ? error.message : 'Não foi possível falar com o servidor.');
      });
  }, []);

  /*
   * A faixa de aposta vem do DEGRAU da pessoa, não da configuração do jogo.
   *
   * `fetchSlotsConfig()` devolve `minBet` do Bronze pra todo mundo — é a configuração da
   * REGRA do jogo, e não da mesa em que esta pessoa senta. Quem tinha saldo de mesa alta
   * via um seletor de 50 a 1.000 e tomava 400 do servidor em toda aposta, porque lá a
   * validação usa o degrau de verdade.
   */
  const faixa = useFaixaDeAposta(balance);

  /*
   * Quando a faixa chega (ou o saldo muda de degrau), a aposta é reancorada: se ainda
   * não havia aposta, abre no mínimo; se havia, é apertada na faixa nova. Sem isto, uma
   * vitória grande que sobe de degrau deixaria a aposta abaixo do novo mínimo.
   */
  useEffect(() => {
    if (!faixa) return;
    setBet((atual) => (atual > 0 ? ajustar(faixa, atual) : apostaInicial(faixa)));
  }, [faixa?.minimo, faixa?.saldo]);

  const handleSpin = async () => {
    if (!config || spinning || bet <= 0) return;
    setSpinning(true);
    setSpinError(null);
    /*
     * Um id por TOQUE. Se este giro precisar ser reenviado (rede caiu depois de a
     * requisição chegar, por exemplo), o mesmo id vai junto e o servidor devolve o
     * resultado que já existe em vez de debitar de novo.
     */
    const acao = novaAcao();
    try {
      const result = await spinSlots(bet, acao);
      setGrid(result.grid);
      setWinningLines(result.winningLines);
      setLastWin(result.totalWin);
      setBalance(result.newBalance);
    } catch (error) {
      setSpinError(error instanceof ApiError ? error.message : 'Não foi possível girar agora.');
    } finally {
      setSpinning(false);
    }
  };

  const highlighted = winningCellSet(winningLines);

  return (
    <GameBackdrop source={TABLE_IMAGES.slots}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar" style={styles.iconButton} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <ChipStack amount={balance} />
          <Pressable onPress={() => setTutorialVisible(true)} accessibilityRole="button" accessibilityLabel="Como jogar" style={styles.iconButton} hitSlop={12}>
            <Ionicons name="help-circle" size={24} color={colors.goldBright} />
          </Pressable>
        </View>

        <Text style={styles.title}>Caça-Níqueis</Text>

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
              DUAS CASAS, e não uma.
              Com uma casa, 95,99% aparecia como "96,0%" — arredondado pra cima, na
              direção que favorece o anúncio. A diferença é pequena e o princípio não é:
              o número que a tela mostra tem que ser o número que a tabela produz, e
              quem quiser conferir tem que chegar no mesmo lugar.
            */}
            <Text style={styles.rtpLabel}>
              RTP divulgado: {(config.theoreticalRtp * 100).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}%
            </Text>

            <View style={styles.gabinete}>
              <View style={styles.rolos}>
                {Array.from({ length: config.reels }, (_, coluna) => (
                  <Rolo
                    key={coluna}
                    coluna={coluna}
                    girando={spinning}
                    resultado={colunaDoResultado(grid, coluna, config.reels, config.rows)}
                    fileiras={config.rows}
                    largura={CELULA}
                    altura={CELULA}
                  />
                ))}
              </View>

              {/*
                As linhas premiadas acendem POR CIMA dos rolos, depois que eles param.
                Marcar a célula por baixo não daria: o rolo é uma tira que desliza, e a
                célula premiada nem existe como caixa própria.
              */}
              {!spinning && highlighted.size > 0 && (
                <View
                  pointerEvents="none"
                  style={[styles.marcacoes, { width: config.reels * CELULA + (config.reels - 1) * spacing.xs }]}
                >
                  {Array.from({ length: config.reels * config.rows }).map((_, indice) => (
                    <View
                      key={indice}
                      style={[
                        styles.marcacao,
                        { width: CELULA, height: CELULA },
                        highlighted.has(indice) && styles.marcacaoAcesa,
                      ]}
                    />
                  ))}
                </View>
              )}
            </View>

            {lastWin !== null && (
              <Text style={[styles.resultLabel, lastWin > 0 ? styles.resultWin : styles.resultLoss]}>
                {lastWin > 0 ? `Você ganhou ${lastWin.toLocaleString('pt-BR')} fichas!` : 'Não formou combinação — tente de novo.'}
              </Text>
            )}

            {spinError && <Text style={styles.errorText}>{spinError}</Text>}

            {faixa && (
              <SeletorDeAposta faixa={faixa} valor={bet} aoMudar={setBet} travado={spinning} />
            )}

            {/*
              Sem aposta válida, o botão não gira. `bet` é 0 enquanto a faixa da mesa não
              chegou, e continua 0 pra quem não tem saldo nem pro mínimo — nos dois casos,
              girar mandaria uma aposta de zero pro servidor só pra tomar 400 de volta.
            */}
            <Pressable
              onPress={handleSpin}
              disabled={spinning || bet <= 0}
              style={[styles.spinButton, (spinning || bet <= 0) && styles.spinButtonDisabled]}
            >
              {spinning ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.spinButtonLabel}>Girar</Text>
              )}
            </Pressable>
          </>
        )}
      </SafeAreaView>

      <TutorialModal
        visible={tutorialVisible}
        gameName="Caça-Níqueis"
        tutorial={tutorial}
        onClose={() => setTutorialVisible(false)}
      />
    </GameBackdrop>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: spacing.xl, alignItems: 'center' },
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
  title: { fontFamily: fontFamily.displayExtraBold, fontSize: fontSize.xl, color: colors.textPrimary, marginTop: spacing.lg },
  /*
   * O RTP é a informação mais importante da tela: é o que diz quanto o jogo devolve.
   * Estava em textFaint por cima da arte escura do gabinete e sumia. Número que o
   * jogador precisa pra decidir não pode depender da luz do ambiente — daí a tarja
   * escura por trás e o texto claro.
   */
  rtpLabel: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(11,15,13,0.72)',
    overflow: 'hidden',
  },
  loading: { marginTop: spacing.xxxl },
  errorBox: { marginTop: spacing.xxxl, alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg },
  errorText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.danger, textAlign: 'center' },
  errorHint: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint, textAlign: 'center' },
  gabinete: {
    marginTop: spacing.xl,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.goldDeep,
    backgroundColor: 'rgba(11,15,13,0.82)',
  },
  rolos: { flexDirection: 'row', gap: spacing.xs },
  /*
   * A grade de marcação tem que cair EXATAMENTE em cima dos rolos: vão entre colunas,
   * nenhum entre linhas (o rolo é uma tira contínua de três células, sem respiro no
   * meio). Por isso columnGap/rowGap separados, e a largura calculada em cima da
   * quantidade de rolos, pra a quebra de linha cair no fim de cada fileira.
   */
  marcacoes: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    // A largura vem de fora (depende de quantos rolos o servidor manda) — é ela que
    // faz o flex-wrap quebrar a linha na coluna certa.
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.xs,
    rowGap: 0,
  },
  marcacao: { borderRadius: radius.sm, borderWidth: 2, borderColor: 'transparent' },
  marcacaoAcesa: { borderColor: colors.goldBright, backgroundColor: 'rgba(255,217,138,0.14)' },
  resultLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.base, marginTop: spacing.lg, textAlign: 'center' },
  resultWin: { color: colors.goldBright },
  resultLoss: { color: colors.textFaint },
  spinButton: {
    backgroundColor: colors.goldBright,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxxl,
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
    minWidth: 180,
    alignItems: 'center',
  },
  spinButtonDisabled: { opacity: 0.6 },
  spinButtonLabel: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.md, color: colors.background },
});
