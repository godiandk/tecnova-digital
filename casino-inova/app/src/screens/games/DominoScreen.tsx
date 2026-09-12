import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
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
import { ApiError, mensagemParaOJogador } from '../../api/client';
import {
  fetchDominoConfig,
  fetchDominoMatch,
  newDominoMatch,
  playDominoTile,
  passDominoTurn,
  DominoConfig,
  DominoMatchState,
  DominoTile,
  DominoEnd,
} from '../../api/domino';
import { usePlayer, saldoChegouDeFora } from '../../data/usePlayer';
import { SeletorDeEntrada } from '../../aposta';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme';
import { PecaDeDomino } from '../../components/PecaDeDomino';
import { CorrenteDeDomino } from '../../components/CorrenteDeDomino';

/**
 * A LARGURA DA PEÇA SAI DA MÃO MEDIDA, e não de um número fixo.
 *
 * Com 38 fixos, o retrato mostrou a sétima peça saindo pela borda direita: a mão tem
 * sempre sete peças no começo, mas o espaço muda com o aparelho e com o vão entre elas.
 * Medindo a fileira e dividindo, as sete cabem em qualquer tela — e num tablet elas
 * crescem em vez de ficarem miúdas num canto.
 *
 * Os limites existem pelas duas pontas: abaixo de 26 os pontos da peça não se leem e o
 * dedo não acerta; acima de 48 sete peças viram um paredão que come a mesa.
 */
const LARGURA_MINIMA_DA_PECA = 26;
const LARGURA_MAXIMA_DA_PECA = 48;
const VAO_ENTRE_PECAS = 4;

function larguraDaPeca(larguraDaMao: number, quantas: number): number {
  if (larguraDaMao <= 0 || quantas <= 0) return LARGURA_MINIMA_DA_PECA;
  const util = larguraDaMao - VAO_ENTRE_PECAS * (quantas - 1);
  return Math.max(LARGURA_MINIMA_DA_PECA, Math.min(LARGURA_MAXIMA_DA_PECA, Math.floor(util / quantas)));
}

type Props = NativeStackScreenProps<RootStackParamList, 'Domino'>;

/** Dominó double-six: todas as combinações de 0 a 6, sem repetir — 28 peças. */
const TOTAL_DE_PECAS = 28;

function tileMatches(tile: DominoTile, value: number): boolean {
  return tile.a === value || tile.b === value;
}

/**
 * Quantas peças ficaram no dorme. O dominó double-six tem 28 peças e o jogo é "block"
 * (não se compra), então tudo que não está numa mão nem na mesa está dormindo — dá pra
 * contar de fora, sem o servidor precisar contar por nós.
 */
function pecasDormindo(match: DominoMatchState): number {
  return TOTAL_DE_PECAS - match.playerHand.length - match.botTileCount - match.boardTiles.length;
}

export function DominoScreen({ navigation }: Props) {
  const tutorial = getTutorialByGameId('domino');

  const [tutorialVisible, setTutorialVisible] = useState(true);
  const [config, setConfig] = useState<DominoConfig | null>(null);
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

  const [buyIn, setBuyIn] = useState(200);
  const [match, setMatch] = useState<DominoMatchState | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  /* A largura real da fileira da mão, medida no layout — ver `larguraDaPeca`. */
  const [larguraDaMao, setLarguraDaMao] = useState(0);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetchDominoConfig()
      .then((data) => {
        setConfig(data);
        /* Abre na entrada mais barata do degrau — nunca num valor que o saldo não cobre. */
        setBuyIn(data.entradas[0] ?? data.minBuyIn);
      })
      .catch((error: unknown) => {
        setConfigError(mensagemParaOJogador(error, 'Não foi possível falar com o servidor.'));
      });
  }, []);


  /*
   * RETOMA A PARTIDA ABERTA, se houver.
   *
   * A partida vive na memória do servidor e a entrada já foi debitada. Sem este pedido, a
   * tela abria no "Começar partida" e o servidor recusava com "você já tem uma partida em
   * andamento" — a pessoa ficava trancada do lado de fora de uma mesa que é dela, e do
   * dinheiro que já pagou. Basta recarregar a página pra cair nisso.
   */
  useEffect(() => {
    fetchDominoMatch()
      .then((aberta) => { if (aberta) setMatch(aberta); })
      .catch(() => { /* sem partida aberta o jogo começa do zero, que é o caso normal */ });
  }, []);

  const run = async (action: () => Promise<DominoMatchState>) => {
    setBusy(true);
    setActionError(null);
    try {
      const result = await action();
      setMatch(result);
      saldoChegouDeFora(result.newBalance);
      setSelectedIndex(null);
    } catch (error) {
      setActionError(mensagemParaOJogador(error, 'Não foi possível completar a ação agora.'));
    } finally {
      setBusy(false);
    }
  };

  const inMatch = Boolean(match && !match.finished);
  const selectedTile = selectedIndex !== null && match ? match.playerHand[selectedIndex] : null;
  const boardEmpty = match?.leftEnd === null;
  const matchesLeft = selectedTile && !boardEmpty && match ? tileMatches(selectedTile, match.leftEnd!) : false;
  const matchesRight = selectedTile && !boardEmpty && match ? tileMatches(selectedTile, match.rightEnd!) : false;

  const playSelected = (end?: DominoEnd) => {
    if (!selectedTile) return;
    run(() => playDominoTile(selectedTile, end));
  };

  return (
    <GameBackdrop source={TABLE_IMAGES.domino}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar" style={styles.iconButton} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <ChipStack amount={balance} />
          <View style={styles.topActions}>
            <Pressable onPress={() => navigation.navigate('DominoMesa')} style={styles.iconButton} hitSlop={12}>
              <Ionicons name="people" size={22} color={colors.goldBright} />
            </Pressable>
            <Pressable onPress={() => setTutorialVisible(true)} accessibilityRole="button" accessibilityLabel="Como jogar" style={styles.iconButton} hitSlop={12}>
              <Ionicons name="help-circle" size={24} color={colors.goldBright} />
            </Pressable>
          </View>
        </View>

        <View style={styles.titleRow}>
          <DealerBadge source={DEALER_IMAGES.trucoDomino} />
          <Text style={styles.title}>Dominó</Text>
        </View>

        {!config && !configError && <ActivityIndicator color={colors.goldBright} style={styles.loading} />}
        {configError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{configError}</Text>
            <Text style={styles.errorHint}>Confira se o servidor (server/) está rodando em npm run start:dev.</Text>
          </View>
        )}

        {config && !inMatch && (
          <View style={styles.startBlock}>
            {match?.finished && (
              <Text
                style={[
                  styles.resultLabel,
                  match.matchOutcome === 'jogador' ? styles.resultWin : match.matchOutcome === 'bot' ? styles.resultLoss : styles.resultDraw,
                ]}
              >
                {match.matchOutcome === 'jogador' ? 'Você venceu a partida!' : match.matchOutcome === 'bot' ? 'O bot venceu.' : 'Empate — buy-in devolvido.'}
              </Text>
            )}
            <SeletorDeEntrada
              opcoes={config.entradas.map((entrada) => ({ entrada }))}
              valor={buyIn}
              aoMudar={setBuyIn}
              legenda="paga ×2 se ganhar"
              travado={busy}
            />
            {actionError && <Text style={styles.errorText}>{actionError}</Text>}
            <Pressable onPress={() => run(() => newDominoMatch(buyIn))} disabled={busy} style={[styles.primaryButton, busy && styles.buttonDisabled]}>
              {busy ? <ActivityIndicator color={colors.background} /> : <Text style={styles.primaryButtonLabel}>Começar partida</Text>}
            </Pressable>
          </View>
        )}

        {inMatch && match && (
          <View style={styles.matchBlock}>
            <Text style={styles.score}>
              Peças do bot: {match.botTileCount} · Dorme: {pecasDormindo(match)}
            </Text>
            <Text style={styles.boardEnds}>
              {boardEmpty ? 'Mesa vazia — escolha uma peça pra abrir' : `Pontas: ${match.leftEnd} — ${match.rightEnd}`}
            </Text>

            {/*
              A MESA, com as peças de verdade e a corrente dobrando esquina.

              Era uma gaveta horizontal de botões escritos "3|5" que rolava de lado — a
              mesa sumia assim que a partida andava, porque um tabuleiro que é barra de
              rolagem não é um tabuleiro. `CorrenteDeDomino` já fazia certo na mesa
              online: a corrente vira quando chega na borda e continua na linha de baixo,
              e a carroça entra atravessada.
            */}
            <View style={styles.mesa}>
              {match.boardTiles.length > 0 && <CorrenteDeDomino pecas={match.boardTiles} />}
            </View>

            {/*
              O RECADO DA MESA, sem repetir o que o aviso da abertura já diz.

              Com a regra da carroça em pé, a tela mostrava duas frases seguidas dizendo a
              mesma coisa: "Você tem a maior peça (5-5) — a partida abre com ela." vindo do
              evento, e "Você tem a maior peça: abra com esta." logo abaixo, junto da peça.
              A segunda é melhor (mostra a peça), então a primeira cala nesse caso.
            */}
            {match.lastEvent && !match.aberturaObrigatoria && (
              <Text style={styles.eventText}>{match.lastEvent}</Text>
            )}
            {actionError && <Text style={styles.errorText}>{actionError}</Text>}

            {selectedTile && !boardEmpty && (
              <View style={styles.endRow}>
                <Pressable onPress={() => playSelected('esquerda')} disabled={!matchesLeft || busy} style={[styles.secondaryButton, (!matchesLeft || busy) && styles.buttonDisabled]}>
                  <Text style={styles.secondaryButtonLabel}>Jogar à esquerda</Text>
                </Pressable>
                <Pressable onPress={() => playSelected('direita')} disabled={!matchesRight || busy} style={[styles.secondaryButton, (!matchesRight || busy) && styles.buttonDisabled]}>
                  <Text style={styles.secondaryButtonLabel}>Jogar à direita</Text>
                </Pressable>
              </View>
            )}
            {selectedTile && boardEmpty && (
              <Pressable onPress={() => playSelected()} disabled={busy} style={[styles.primaryButton, busy && styles.buttonDisabled]}>
                <Text style={styles.primaryButtonLabel}>Abrir com essa peça</Text>
              </Pressable>
            )}

            {/*
              Quem tem a maior dupla abre, e abre com ela. Em vez de deixar tocar em
              qualquer peça pra o servidor recusar, a mão inteira menos essa fica apagada
              — a regra fica visível antes do erro, não depois.
            */}
            {match.aberturaObrigatoria && (
              <View style={styles.avisoDaAbertura}>
                <Text style={styles.aviso}>Você tem a maior peça: abra com esta.</Text>
                <PecaDeDomino peca={match.aberturaObrigatoria} largura={26} />
              </View>
            )}

            <View style={styles.handRow} onLayout={(e) => setLarguraDaMao(e.nativeEvent.layout.width)}>
              {match.playerHand.map((tile, index) => {
                const ehAbertura =
                  !match.aberturaObrigatoria ||
                  (tile.a === match.aberturaObrigatoria.a && tile.b === match.aberturaObrigatoria.b);
                return (
                  <Pressable
                    key={index}
                    onPress={() => setSelectedIndex(index === selectedIndex ? null : index)}
                    disabled={busy || !ehAbertura}
                    accessibilityRole="button"
                    accessibilityLabel={`Peça ${tile.a} ${tile.b}${ehAbertura ? '' : ' — não é a peça de abertura'}`}
                    style={styles.lugarDaPeca}
                  >
                    <PecaDeDomino
                      peca={tile}
                      largura={larguraDaPeca(larguraDaMao, match.playerHand.length)}
                      escolhida={index === selectedIndex}
                      apagada={!ehAbertura}
                    />
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={() => run(passDominoTurn)}
              disabled={busy || match.canPlay}
              style={[styles.secondaryButton, (busy || match.canPlay) && styles.buttonDisabled]}
            >
              <Text style={styles.secondaryButtonLabel}>Passar a vez</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>

      <TutorialModal visible={tutorialVisible} gameName="Dominó" tutorial={tutorial} onClose={() => setTutorialVisible(false)} />
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
  topActions: { flexDirection: 'row', gap: spacing.xs },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 20,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  title: { fontFamily: fontFamily.displayExtraBold, fontSize: fontSize.xl, color: colors.textPrimary },
  loading: { marginTop: spacing.xxxl },
  errorBox: { marginTop: spacing.xxxl, alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg },
  errorText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.danger, textAlign: 'center' },
  errorHint: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint, textAlign: 'center' },
  startBlock: { alignItems: 'center', gap: spacing.md, marginTop: spacing.xxxl },
  aviso: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
    color: colors.goldBright,
    textAlign: 'center',
  },
  /* Peça que não pode abrir: apagada, mas ainda legível — some do toque, não da vista. */
  resultLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.base, textAlign: 'center', maxWidth: 280 },
  resultWin: { color: colors.goldBright },
  resultLoss: { color: colors.textFaint },
  resultDraw: { color: colors.textSecondary },
  matchBlock: { width: '100%', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  score: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.textSecondary },
  boardEnds: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.base, color: colors.textPrimary },
  /*
   * A MESA TEM ALTURA RESERVADA. Sem `minHeight`, o tampo nasce com zero e a tela inteira
   * pula pra baixo quando a primeira peça é assentada — e volta a pular a cada dobra da
   * corrente. Mesa que muda de tamanho no meio da partida é mesa que se perde de vista.
   */
  mesa: { width: '100%', minHeight: 150, marginTop: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  eventText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.goldBright, textAlign: 'center', maxWidth: 300 },
  endRow: { flexDirection: 'row', gap: spacing.md },
  /*
   * A MÃO NÃO QUEBRA LINHA. São sempre sete peças, e sete peças de 38 cabem numa tela de
   * celular — `flexWrap` só serviria pra mandar a sétima pra uma segunda fileira em
   * telas apertadas, o que não é como ninguém segura dominó.
   */
  handRow: {
    flexDirection: 'row',
    gap: VAO_ENTRE_PECAS,
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginTop: spacing.lg,
    alignSelf: 'stretch',
  },
  /* O aviso mostra A PEÇA, e não o nome dela: "abra com o 6|6" é código, 6|6 é a peça. */
  avisoDaAbertura: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  /* O lugar da peça na mão: área de toque confortável em volta da arte. */
  lugarDaPeca: { paddingVertical: 6 },
  primaryButton: {
    backgroundColor: colors.goldBright,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxxl,
    alignItems: 'center',
    minWidth: 180,
  },
  secondaryButton: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.feltLine,
    minWidth: 140,
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonLabel: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.md, color: colors.background },
  secondaryButtonLabel: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.md, color: colors.textPrimary },
});
