import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../../navigation/types';
import { getTutorialByGameId } from '../../data/tutorials';
import { TABLE_IMAGES } from '../../data/tableImages';
import { TutorialModal } from '../../components/TutorialModal';
import { GameBackdrop } from '../../components/GameBackdrop';
import { ChipStack } from '../../components/ChipStack';
import { ApiError, novaAcao } from '../../api/client';
import {
  fetchStockMarketConfig,
  fetchStockMarketHistory,
  playStockMarketRound,
  StockDirection,
  StockMarketConfig,
  StockMarketRoundResponse,
} from '../../api/stockMarket';
import { usePlayer } from '../../data/usePlayer';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'StockMarket'>;

const BET_STEP = 50;
const CHART_HEIGHT = 160;

/**
 * O RITMO DA COTAÇÃO, e por que ele não é constante.
 *
 * A linha andava a 45ms por tique, sempre igual: trinta tiques em 1,4 segundo. Rápido
 * demais pra acompanhar, e monótono — a linha corria até o fim no mesmo passo e o
 * resultado chegava sem nenhum momento.
 *
 * Agora ela COMEÇA no ritmo normal e VAI FREANDO conforme chega perto do fim. É o mesmo
 * recurso da roda de roleta perdendo velocidade: os últimos tiques, que são os que
 * decidem, demoram quase quatro vezes mais que os primeiros. Dá tempo de ver a linha
 * hesitar antes de fechar.
 *
 * ISSO NÃO ESCONDE NEM INVENTA NADA. O caminho inteiro já chegou do servidor antes do
 * primeiro pixel se mexer, e cada ponto desenhado é um ponto que aconteceu de verdade. O
 * que muda é só o tempo de olhar — a mesma diferença entre um dado que rola e um número
 * que aparece.
 */
const MS_POR_TIQUE = 62;
const MS_NO_ULTIMO_TIQUE = 240;

/** Quanto tempo o freio dura, em fração do caminho. Os últimos 30% andam devagar. */
const TRECHO_QUE_FREIA = 0.3;

function msDoTique(indice: number, total: number): number {
  if (total <= 1) return MS_POR_TIQUE;
  const restante = (total - indice) / total;
  if (restante > TRECHO_QUE_FREIA) return MS_POR_TIQUE;
  // Dentro do trecho final, o passo cresce suave até o último tique.
  const dentro = 1 - restante / TRECHO_QUE_FREIA;
  return MS_POR_TIQUE + (MS_NO_ULTIMO_TIQUE - MS_POR_TIQUE) * dentro * dentro;
}

export function StockMarketScreen({ navigation }: Props) {
  const tutorial = getTutorialByGameId('stock-market');

  const [tutorialVisible, setTutorialVisible] = useState(true);
  const [config, setConfig] = useState<StockMarketConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const { jogador } = usePlayer();

  // Semeia o saldo com a carteira de verdade; a partir da primeira aposta quem manda é
  // o `newBalance` que o servidor devolve.
  useEffect(() => {
    if (jogador) setBalance(jogador.chipBalance);
  }, [jogador]);
  const [amount, setAmount] = useState(100);
  const [direction, setDirection] = useState<StockDirection | null>(null);
  const [round, setRound] = useState<StockMarketRoundResponse | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [playing, setPlaying] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);
  /**
   * Até que ponto do caminho a linha já foi desenhada. O caminho INTEIRO chega do
   * servidor antes disto começar — a animação percorre o que já aconteceu, nunca
   * decide nada. É a mesma regra dos rolos e da roda.
   */
  const [tiqueVisivel, setTiqueVisivel] = useState(0);
  /**
   * O que o servidor já disse, esperando a linha chegar lá pra aparecer na tela.
   *
   * Não é informação escondida: é a mesma informação, mostrada na hora em que faz
   * sentido. O caminho inteiro já está na tela sendo desenhado — o que espera é só o
   * número do saldo e a marca no histórico, que de outro jeito contariam o fim antes.
   */
  const [pendente, setPendente] = useState<{ saldo: number; fechamento: number } | null>(null);

  useEffect(() => {
    fetchStockMarketConfig()
      .then((data) => {
        setConfig(data);
        setAmount(Math.max(data.minBet, Math.min(100, data.maxBet)));
      })
      .catch((error: unknown) => {
        setConfigError(error instanceof ApiError ? error.message : 'Não foi possível falar com o servidor.');
      });
    fetchStockMarketHistory().then((data) => setHistory(data.closes)).catch(() => undefined);
  }, []);

  const adjustAmount = (delta: number) => {
    if (!config) return;
    setAmount((current) => Math.max(config.minBet, Math.min(config.maxBet, current + delta)));
  };

  const handlePlay = async () => {
    if (!config || playing || !direction) return;
    setPlaying(true);
    setPlayError(null);
    try {
      const result = await playStockMarketRound(direction, amount, novaAcao());
      setRound(result);
      setTiqueVisivel(0);
      /*
       * O SALDO E O HISTÓRICO SÓ MUDAM QUANDO A LINHA CHEGA AO FIM.
       *
       * Aqui estava o vazamento: os dois eram atualizados no instante em que a aposta
       * saía. O contador de fichas no topo pulava pra o valor final e a fita de
       * fechamentos ganhava o resultado da rodada — os dois entregavam se a pessoa
       * ganhou ANTES de o gráfico começar a correr. Quem olhava o número no topo já
       * sabia o fim e o gráfico virava enfeite.
       *
       * O resultado guardado aqui é o mesmo que o servidor mandou; ele só espera a linha
       * terminar de desenhar (ver o efeito abaixo).
       */
      setPendente({ saldo: result.newBalance, fechamento: result.closePercent });
    } catch (error) {
      setPlayError(error instanceof ApiError ? error.message : 'Não foi possível apostar agora.');
    } finally {
      setPlaying(false);
    }
  };

  /*
   * Anda um tique de cada vez até o fim do caminho. `round` na dependência: cada
   * rodada nova reinicia o laço, e o `clearInterval` no retorno impede que dois laços
   * corram juntos se a pessoa apostar de novo antes de terminar.
   */
  useEffect(() => {
    if (!round) return;
    const total = round.path.length;
    let atual = 0;
    let vivo = true;
    let relogio: ReturnType<typeof setTimeout>;

    /*
     * Um `setTimeout` que se reagenda, e não um `setInterval`: o intervalo é diferente a
     * cada tique (ver `msDoTique`), e `setInterval` só sabe repetir sempre igual.
     */
    const andar = () => {
      if (!vivo) return;
      atual += 1;
      setTiqueVisivel(atual);
      if (atual < total) relogio = setTimeout(andar, msDoTique(atual, total));
    };
    relogio = setTimeout(andar, msDoTique(0, total));

    return () => {
      vivo = false;
      clearTimeout(relogio);
    };
  }, [round]);

  /*
   * A linha chegou ao fim: agora sim o saldo muda e o fechamento entra no histórico.
   * Os dois juntos, no mesmo instante — é o momento do resultado.
   */
  useEffect(() => {
    if (!pendente || !round || tiqueVisivel < round.path.length) return;
    setBalance(pendente.saldo);
    setHistory((current) => [...current, pendente.fechamento].slice(-30));
    setPendente(null);
  }, [pendente, round, tiqueVisivel]);

  const terminouDeDesenhar = !round || tiqueVisivel >= round.path.length;
  const won = round ? round.totalReturn > round.amount : false;

  return (
    <GameBackdrop source={TABLE_IMAGES['stock-market']}>
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

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Stock Market</Text>

          {!config && !configError && <ActivityIndicator color={colors.goldBright} style={styles.loading} />}
          {configError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{configError}</Text>
              <Text style={styles.errorHint}>Confira se o servidor (server/) está rodando em npm run start:dev.</Text>
            </View>
          )}

          {config && (
            <>
              <Text style={styles.rtpLabel}>
                RTP divulgado: {(config.theoreticalRtp * 100).toFixed(0)}% · comissão de{' '}
                {(config.commission * 100).toFixed(0)}% sobre o que você recebe
              </Text>

              {/*
                Com rodada, mostra a cotação dela andando. Sem rodada, mostra os
                FECHAMENTOS ANTERIORES — que são dados de verdade, não uma animação
                inventada pra encher o espaço. Um gráfico que se mexe sozinho sem
                nada por trás seria enfeite fingindo ser informação.
              */}
              {round ? (
                <Cotacao
                  caminho={round.path}
                  ateOTique={tiqueVisivel}
                  fechamento={terminouDeDesenhar ? round.closePercent : undefined}
                  legenda=""
                />
              ) : (
                <Cotacao
                  caminho={history}
                  legenda="Escolha um lado e invista pra ver a cotação andar."
                />
              )}

              {!round && history.length > 0 && (
                <Text style={styles.legendaDoHistorico}>
                  Fechamentos das últimas {history.length} rodadas desta mesa
                </Text>
              )}

              {round && terminouDeDesenhar && (
                <Text style={[styles.closeLabel, { color: round.closePercent >= 0 ? colors.success : colors.ruby }]}>
                  Fechou em {round.closePercent > 0 ? '+' : ''}
                  {round.closePercent.toFixed(2)}%
                </Text>
              )}

              <View style={styles.directionRow}>
                <DirectionButton
                  label="ALTA"
                  icon="trending-up"
                  active={direction === 'alta'}
                  accent={colors.success}
                  onPress={() => setDirection('alta')}
                  disabled={playing}
                />
                <DirectionButton
                  label="BAIXA"
                  icon="trending-down"
                  active={direction === 'baixa'}
                  accent={colors.ruby}
                  onPress={() => setDirection('baixa')}
                  disabled={playing}
                />
              </View>

              {round && (
                <View style={styles.receipt}>
                  <Text style={styles.receiptLine}>
                    Apostou {round.amount.toLocaleString('pt-BR')} em {round.direction === 'alta' ? 'ALTA' : 'BAIXA'}
                  </Text>
                  <Text style={styles.receiptLine}>
                    Retorno bruto {round.grossReturn.toFixed(2)} − comissão {round.commission.toFixed(2)}
                  </Text>
                  <Text style={[styles.receiptTotal, { color: won ? colors.success : colors.ruby }]}>
                    Você recebeu {round.totalReturn.toLocaleString('pt-BR')}
                  </Text>
                </View>
              )}

              {playError && <Text style={styles.errorText}>{playError}</Text>}

              <View style={styles.betRow}>
                <Pressable onPress={() => adjustAmount(-BET_STEP)} style={styles.stepButton} disabled={playing}>
                  <Ionicons name="remove" size={20} color={colors.textPrimary} />
                </Pressable>
                <View style={styles.betValue}>
                  <Text style={styles.betValueLabel}>Sua aposta</Text>
                  <Text style={styles.betAmount}>{amount.toLocaleString('pt-BR')}</Text>
                </View>
                <Pressable onPress={() => adjustAmount(BET_STEP)} style={styles.stepButton} disabled={playing}>
                  <Ionicons name="add" size={20} color={colors.textPrimary} />
                </Pressable>
              </View>

              <Pressable
                onPress={handlePlay}
                disabled={playing || !direction}
                style={[styles.primaryButton, (playing || !direction) && styles.buttonDisabled]}
              >
                {playing ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text style={styles.primaryButtonLabel}>
                    {direction ? `Investir ${amount.toLocaleString('pt-BR')}` : 'Escolha alta ou baixa'}
                  </Text>
                )}
              </Pressable>

              {history.length > 0 && (
                <View style={styles.historyPanel}>
                  <Text style={styles.historyLabel}>Rodadas anteriores</Text>
                  <View style={styles.historyRow}>
                    {history.slice(-20).map((close, index) => (
                      <View
                        key={index}
                        style={[
                          styles.historyDot,
                          { backgroundColor: close >= 0 ? colors.success : colors.ruby },
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={styles.disclaimer}>
                    Cada rodada é sorteada do zero — o que já saiu não muda a chance da próxima.
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      <TutorialModal
        visible={tutorialVisible}
        gameName="Stock Market"
        tutorial={tutorial}
        onClose={() => setTutorialVisible(false)}
      />
    </GameBackdrop>
  );
}

/**
 * Gráfico da cotação em barras verticais. Cada ponto do caminho vira uma coluna que
 * sai da linha do meio (o zero) pra cima ou pra baixo — dá pra ler a subida e a
 * descida sem precisar de biblioteca de gráfico.
 */
/**
 * A cotação, desenhada como ÁREA em volta da linha do zero.
 *
 * Cada tique é uma coluna fina que sai do zero pra cima (alta) ou pra baixo (baixa),
 * encostadas umas nas outras — o que forma uma área contínua e lê como gráfico de
 * cotação. Antes eram barras com folga e altura mínima de 2px, que faziam qualquer
 * rodada parecer uma serrilha do mesmo tamanho.
 *
 * A direção é dada pela POSIÇÃO (acima ou abaixo do zero), não só pela cor: verde e
 * vermelho são justamente o par que some pra quem tem daltonismo, e um gráfico que
 * depende só dele não é legível pra todo mundo.
 *
 * `ateOTique` desenha só até um ponto — é o que faz a linha ANDAR durante a rodada, em
 * vez de aparecer pronta. O caminho inteiro já veio do servidor antes da animação
 * começar; ela só revela o que já aconteceu, nunca decide nada.
 */
function Cotacao({
  caminho,
  ateOTique,
  fechamento,
  legenda,
}: {
  caminho: number[];
  ateOTique?: number;
  fechamento?: number;
  legenda: string;
}) {
  const pontos = ateOTique === undefined ? caminho : caminho.slice(0, Math.max(1, ateOTique));
  const metade = CHART_HEIGHT / 2;

  return (
    <View style={styles.chart}>
      {/* Grade discreta: só o zero e as metades da escala. O jogo vai de -100% a +100%. */}
      <View style={[styles.linhaDaGrade, { top: metade * 0.5 }]} />
      <View style={[styles.linhaDaGrade, { top: metade * 1.5 }]} />
      <View style={styles.chartZeroLine} />

      <Text style={[styles.marcaDaEscala, { top: 2 }]}>+100%</Text>
      <Text style={[styles.marcaDaEscala, { top: metade - 7 }]}>0</Text>
      <Text style={[styles.marcaDaEscala, { bottom: 2 }]}>−100%</Text>

      <View style={styles.chartBars}>
        {caminho.length === 0 ? (
          <Text style={styles.chartEmpty}>{legenda}</Text>
        ) : (
          pontos.map((valor, indice) => {
            const altura = Math.max(1, (Math.min(Math.abs(valor), 100) / 100) * metade);
            const subindo = valor >= 0;
            return (
              <View key={indice} style={styles.chartColumn}>
                <View style={styles.chartHalf}>
                  {subindo && <View style={[styles.bar, { height: altura, backgroundColor: colors.success }]} />}
                </View>
                <View style={styles.chartHalfBottom}>
                  {!subindo && <View style={[styles.bar, { height: altura, backgroundColor: colors.ruby }]} />}
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Um rótulo só, no fechamento — não um número em cima de cada ponto. */}
      {fechamento !== undefined && (
        <Text style={[styles.chartCaption, { color: fechamento >= 0 ? colors.success : colors.ruby }]}>
          {fechamento > 0 ? '+' : ''}
          {fechamento.toFixed(2)}%
        </Text>
      )}
    </View>
  );
}

function DirectionButton({
  label,
  icon,
  active,
  accent,
  onPress,
  disabled,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  accent: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.directionButton, active && { borderColor: accent, backgroundColor: colors.felt }]}
    >
      <Ionicons name={icon} size={28} color={active ? accent : colors.textFaint} />
      <Text style={[styles.directionLabel, active && { color: accent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: spacing.lg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { paddingBottom: spacing.xxxl, gap: spacing.sm },
  title: {
    fontFamily: fontFamily.displayExtraBold,
    fontSize: fontSize.xl,
    color: colors.textPrimary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  loading: { marginTop: spacing.xxxl },
  errorBox: { marginTop: spacing.xxxl, alignItems: 'center', gap: spacing.xs },
  errorText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.danger, textAlign: 'center' },
  errorHint: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint, textAlign: 'center' },
  rtpLabel: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint, textAlign: 'center' },
  chart: {
    height: CHART_HEIGHT,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.feltLine,
    backgroundColor: colors.overlay,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  /* Grade recessiva: marca a escala sem competir com a cotação. */
  linhaDaGrade: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  marcaDaEscala: {
    position: 'absolute',
    right: 6,
    fontFamily: fontFamily.body,
    fontSize: 10,
    color: colors.textFaint,
  },
  legendaDoHistorico: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: -4,
  },
  chartZeroLine: {
    position: 'absolute',
    top: CHART_HEIGHT / 2,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.goldDeep,
  },
  chartBars: { flexDirection: 'row', alignItems: 'stretch', height: '100%', paddingHorizontal: 4 },
  chartColumn: { flex: 1, marginHorizontal: 0.5 },
  chartHalf: { height: '50%', justifyContent: 'flex-end' },
  chartHalfBottom: { height: '50%', justifyContent: 'flex-start' },
  bar: { width: '100%', borderRadius: 1 },
  chartEmpty: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textFaint,
    textAlign: 'center',
    alignSelf: 'center',
    flex: 1,
    marginTop: CHART_HEIGHT / 2 - 8,
  },
  chartCaption: {
    position: 'absolute',
    right: spacing.sm,
    top: spacing.xs,
    fontFamily: fontFamily.displayBold,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
  closeLabel: { fontFamily: fontFamily.displayBold, fontSize: fontSize.lg, textAlign: 'center' },
  directionRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  directionButton: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.feltLine,
    backgroundColor: colors.backgroundElevated,
  },
  directionLabel: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.sm, color: colors.textFaint },
  receipt: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.feltLine,
    padding: spacing.sm,
    gap: 2,
  },
  receiptLine: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },
  receiptTotal: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, marginTop: 2 },
  betRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  stepButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.feltLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  betValue: { alignItems: 'center', minWidth: 140 },
  betValueLabel: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },
  betAmount: { fontFamily: fontFamily.displayBold, fontSize: fontSize.lg, color: colors.textPrimary },
  primaryButton: {
    backgroundColor: colors.goldBright,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonLabel: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.md, color: colors.background },
  historyPanel: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.feltLine,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  historyLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
    color: colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  historyRow: { flexDirection: 'row', gap: 3, flexWrap: 'wrap' },
  historyDot: { width: 10, height: 10, borderRadius: 5 },
  disclaimer: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint, fontStyle: 'italic' },
});
