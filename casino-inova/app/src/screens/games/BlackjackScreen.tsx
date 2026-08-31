import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../../navigation/types';
import { getTutorialByGameId } from '../../data/tutorials';
import { BLACKJACK, MESAS_ONLINE } from '../../data/mesasOnline';
import { TutorialModal } from '../../components/TutorialModal';
import { MesaDeJogo, NaMesa, Regua } from '../../components/MesaDeJogo';
import { Carta } from '../../components/Carta';
import { PilhaDeFichas } from '../../components/PilhaDeFichas';
import { ApiError } from '../../api/client';
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
import { colors, fontFamily, fontSize, radius, spacing, useOrientacaoLivre, useJanela } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Blackjack'>;

const BET_STEP = 50;

/** Largura da carta MEDIDA NA ARTE. A régua converte pra tela. */
const CARTA_NA_ARTE = 92;

/**
 * Quanto cada carta seguinte anda pra direita.
 *
 * Medido na arte de demonstração do próprio projeto: no blackjack as cartas ficam LADO
 * A LADO, encostadas, com uma sobreposição pequena — e EM PÉ, sem inclinação. Não é
 * leque: leque é mão que a pessoa segura na mão (truco, pôquer). Carta de blackjack
 * fica aberta no pano pra todo mundo ler.
 *
 * Uma versão anterior espalhava as cartas em leque inclinado, o que fica bonito e é o
 * jogo errado.
 */
const PASSO_DA_MAO = 70;

/**
 * Quanto uma mão dividida se afasta da outra, MEDIDO NA ARTE. Precisa caber quatro
 * mãos (o limite da mesa) sem que a última encoste na casa do vizinho.
 */
const ESPACO_ENTRE_MAOS = 200;

/** Tudo que está na mesa agora: cada mão mais o seguro, se foi feito. */
function apostaTotal(hand: BlackjackHandResponse): number {
  return hand.maos.reduce((soma, mao) => soma + mao.aposta, 0) + hand.seguro;
}

const OUTCOME_LABEL: Record<NonNullable<MaoDeBlackjack['outcome']>, string> = {
  'jogador-ganhou': 'Você ganhou!',
  'dealer-ganhou': 'A casa ganhou.',
  empate: 'Empate — sua aposta voltou.',
};

/**
 * Uma mão aberta no pano: cartas em pé, encostadas, ligeiramente sobrepostas.
 *
 * Devolve também a largura que a mão ocupou, porque o selo do total encosta à direita
 * dela — e a mão cresce quando o jogador pede carta.
 */
function MaoNaMesa({ cartas, regua }: { cartas: (string | null)[]; regua: Regua }) {
  const meio = ((cartas.length - 1) * PASSO_DA_MAO) / 2;
  const larguraDaCarta = CARTA_NA_ARTE * regua.escala;
  const alturaDaCarta = larguraDaCarta * 1.5;
  return (
    <View>
      {cartas.map((carta, indice) => (
        <View
          key={indice}
          style={{
            position: 'absolute',
            /*
             * `left` posiciona a BORDA da carta, e o ponto medido é o MEIO da mão —
             * por isso desconta meia carta. Sem isso a mão inteira fica deslocada meia
             * carta pra direita do círculo.
             */
            left: (indice * PASSO_DA_MAO - meio) * regua.escala - larguraDaCarta / 2,
            top: -alturaDaCarta / 2,
          }}
        >
          <Carta carta={carta} indice={indice} largura={CARTA_NA_ARTE * regua.escala} />
        </View>
      ))}
    </View>
  );
}

/** Onde o selo do total encosta, à direita da mão — que cresce a cada carta pedida. */
function bordaDireitaDaMao(quantas: number): number {
  return ((quantas - 1) * PASSO_DA_MAO) / 2 + CARTA_NA_ARTE * 0.5 + 46;
}

/** O selo redondo do total, como o que está pintado ao lado das cartas na arte. */
function SeloDoTotal({ total, escala, emJogo = false }: { total: number; escala: number; emJogo?: boolean }) {
  return (
    <View
      style={[
        styles.selo,
        { width: 68 * escala, height: 46 * escala, borderRadius: 23 * escala, borderWidth: Math.max(1, 2 * escala) },
        emJogo && styles.seloEmJogo,
      ]}
    >
      <Text style={[styles.seloTexto, { fontSize: Math.max(11, 26 * escala) }]}>{total}</Text>
    </View>
  );
}

export function BlackjackScreen({ navigation }: Props) {
  const tutorial = getTutorialByGameId('blackjack');
  useOrientacaoLivre();
  const janela = useJanela();

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

  const inProgress = Boolean(hand && !hand.finished);
  // Com seguro pendente a mesa está parada esperando resposta, não aceitando aposta nova.
  const minhaCasa = BLACKJACK.casas[BLACKJACK.minhaCasa];

  const adjustBet = (delta: number) => {
    if (!config) return;
    setBet((current) => Math.max(config.minBet, Math.min(config.maxBet, current + delta)));
  };

  const runAction = async (action: () => Promise<BlackjackHandResponse>) => {
    setBusy(true);
    setActionError(null);
    try {
      const result = await action();
      setHand(result);
      setBalance(result.newBalance);
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : 'Não foi possível completar a ação agora.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.tela}>
      <MesaDeJogo arte={MESAS_ONLINE.blackjack} largura={janela.width} altura={janela.height}>
        {(regua) => (
          <>
            {/* A mão do dealer, no ponto onde a arte já desenha as cartas. */}
            {hand && (
              <>
                <NaMesa ponto={regua.ponto(BLACKJACK.cartasDoDealer.x, BLACKJACK.cartasDoDealer.y)}>
                  <MaoNaMesa cartas={hand.cartasDoDealer} regua={regua} />
                </NaMesa>
                {hand.totalDoDealer !== undefined && (
                  <NaMesa
                    ponto={regua.ponto(
                      BLACKJACK.cartasDoDealer.x + bordaDireitaDaMao(hand.cartasDoDealer.length),
                      BLACKJACK.totalDoDealer.y,
                    )}
                  >
                    <SeloDoTotal total={hand.totalDoDealer} escala={regua.escala} />
                  </NaMesa>
                )}
              </>
            )}

            {/*
              As suas mãos. Sem dividir é uma só, na casa de sempre. Dividindo, elas se
              espalham pros lados a partir dali — cada uma com as suas cartas, a sua
              aposta e o seu total, porque cada uma ganha ou perde sozinha.
            */}
            {hand?.maos.map((mao, indice) => {
              const desvio = (indice - (hand.maos.length - 1) / 2) * ESPACO_ENTRE_MAOS;
              return (
                <View key={indice}>
                  <NaMesa ponto={regua.ponto(minhaCasa.x + desvio, minhaCasa.y + BLACKJACK.recuoDasCartas)}>
                    <MaoNaMesa cartas={mao.cartas} regua={regua} />
                  </NaMesa>
                  <NaMesa
                    ponto={regua.ponto(
                      minhaCasa.x + desvio + bordaDireitaDaMao(mao.cartas.length),
                      minhaCasa.y + BLACKJACK.recuoDasCartas + 34,
                    )}
                  >
                    <SeloDoTotal total={mao.total} escala={regua.escala} emJogo={mao.emJogo} />
                  </NaMesa>
                  {hand.maos.length > 1 && (
                    <NaMesa ponto={regua.ponto(minhaCasa.x + desvio, minhaCasa.y)}>
                      <PilhaDeFichas valor={mao.aposta} escala={regua.escala} />
                    </NaMesa>
                  )}
                </View>
              );
            })}

            {(!hand || hand.maos.length === 1) && (hand || bet > 0) && (
              <NaMesa ponto={regua.ponto(minhaCasa.x, minhaCasa.y)}>
                <PilhaDeFichas valor={hand ? hand.maos[0].aposta : bet} escala={regua.escala} />
              </NaMesa>
            )}

            {/* A barra de controles cobre a que está pintada na arte, com valores de verdade. */}
            <View style={[styles.barra, { height: (900 - BLACKJACK.alturaDoPano) * regua.escala }]}>
              <Pressable onPress={() => navigation.goBack()} style={styles.botaoRedondo} hitSlop={10}>
                <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
              </Pressable>

              <View style={styles.mostrador}>
                <Text style={styles.mostradorRotulo}>SALDO</Text>
                <Text style={styles.mostradorValor}>{balance.toLocaleString('pt-BR')}</Text>
              </View>
              <View style={styles.mostrador}>
                <Text style={styles.mostradorRotulo}>APOSTA</Text>
                <Text style={styles.mostradorValor}>{(hand ? apostaTotal(hand) : bet).toLocaleString('pt-BR')}</Text>
              </View>

              <View style={styles.acoes}>
                {configError && <Text style={styles.erro} numberOfLines={2}>{configError}</Text>}
                {actionError && <Text style={styles.erro} numberOfLines={2}>{actionError}</Text>}

                {hand?.finished &&
                  hand.maos.map((mao, indice) =>
                    mao.outcome ? (
                      <Text
                        key={indice}
                        style={[styles.resultado, mao.outcome === 'jogador-ganhou' ? styles.ganhou : styles.perdeu]}
                        numberOfLines={1}
                      >
                        {hand.maos.length > 1 ? `${indice + 1}ª: ` : ''}
                        {OUTCOME_LABEL[mao.outcome]}
                        {mao.totalReturn ? ` +${mao.totalReturn.toLocaleString('pt-BR')}` : ''}
                      </Text>
                    ) : null,
                  )}

                {!inProgress && config && (
                  <>
                    <Pressable onPress={() => adjustBet(-BET_STEP)} style={styles.botaoRedondo} disabled={busy}>
                      <Ionicons name="remove" size={18} color={colors.textPrimary} />
                    </Pressable>
                    <Pressable onPress={() => adjustBet(BET_STEP)} style={styles.botaoRedondo} disabled={busy}>
                      <Ionicons name="add" size={18} color={colors.textPrimary} />
                    </Pressable>
                    <Pressable
                      onPress={() => runAction(() => startBlackjackHand(bet))}
                      disabled={busy}
                      style={[styles.botaoPrincipal, busy && styles.desabilitado]}
                    >
                      {busy ? <ActivityIndicator color={colors.background} /> : <Text style={styles.botaoPrincipalTexto}>Distribuir</Text>}
                    </Pressable>
                  </>
                )}

                {/*
                  O seguro trava a mesa até ser respondido — é a ordem da mesa de
                  verdade. E a tela diz o que ele é: a pior aposta do blackjack. Não
                  esconder isso é o mínimo, já que a mesa é obrigada a oferecer.
                */}
                {hand?.esperandoSeguro && (
                  <>
                    <Text style={styles.avisoSeguro} numberOfLines={2}>
                      Dealer com Ás. Seguro custa {hand.seguroMaximo} e paga 2:1 — mas perde mais do que ganha a longo prazo.
                    </Text>
                    <Pressable
                      onPress={() => runAction(() => insureBlackjack(false))}
                      disabled={busy}
                      style={[styles.botaoPrincipal, busy && styles.desabilitado]}
                    >
                      <Text style={styles.botaoPrincipalTexto}>Não quero seguro</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => runAction(() => insureBlackjack(true))}
                      disabled={busy}
                      style={[styles.botaoSecundario, busy && styles.desabilitado]}
                    >
                      <Text style={styles.botaoSecundarioTexto}>Fazer seguro</Text>
                    </Pressable>
                  </>
                )}

                {inProgress && !hand?.esperandoSeguro && (
                  <>
                    <Pressable
                      onPress={() => runAction(hitBlackjack)}
                      disabled={busy || !hand?.podeComprar}
                      style={[styles.botaoSecundario, (busy || !hand?.podeComprar) && styles.desabilitado]}
                    >
                      <Text style={styles.botaoSecundarioTexto}>Pedir</Text>
                    </Pressable>
                    {/* Dobrar e dividir só aparecem quando cabem — quem decide é o servidor. */}
                    {hand?.podeDobrar && (
                      <Pressable
                        onPress={() => runAction(doubleBlackjack)}
                        disabled={busy}
                        style={[styles.botaoSecundario, busy && styles.desabilitado]}
                      >
                        <Text style={styles.botaoSecundarioTexto}>Dobrar</Text>
                      </Pressable>
                    )}
                    {hand?.podeDividir && (
                      <Pressable
                        onPress={() => runAction(splitBlackjack)}
                        disabled={busy}
                        style={[styles.botaoSecundario, busy && styles.desabilitado]}
                      >
                        <Text style={styles.botaoSecundarioTexto}>Dividir</Text>
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() => runAction(standBlackjack)}
                      disabled={busy || !hand?.podeParar}
                      style={[styles.botaoPrincipal, (busy || !hand?.podeParar) && styles.desabilitado]}
                    >
                      {busy ? <ActivityIndicator color={colors.background} /> : <Text style={styles.botaoPrincipalTexto}>Parar</Text>}
                    </Pressable>
                  </>
                )}
              </View>

              <Pressable onPress={() => setTutorialVisible(true)} style={styles.botaoRedondo} hitSlop={10}>
                <Ionicons name="help-circle" size={20} color={colors.goldBright} />
              </Pressable>
            </View>

            {!config && !configError && (
              <View style={styles.carregando}>
                <ActivityIndicator color={colors.goldBright} />
              </View>
            )}
          </>
        )}
      </MesaDeJogo>

      <TutorialModal
        visible={tutorialVisible}
        gameName="Blackjack"
        tutorial={tutorial}
        onClose={() => setTutorialVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  selo: {
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.gold,
    backgroundColor: 'rgba(11,15,13,0.82)',
  },
  seloTexto: { fontFamily: fontFamily.displayBold, color: colors.textPrimary },
  /* A mão da vez fica acesa: dividindo, é o que diz de qual mão são os botões. */
  seloEmJogo: { borderColor: colors.goldBright, backgroundColor: 'rgba(255,217,138,0.20)' },
  avisoSeguro: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: colors.goldBright,
    flexShrink: 1,
    maxWidth: 260,
  },

  barra: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: '#080B09',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(229,181,103,0.3)',
  },
  mostrador: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(229,181,103,0.28)',
    minWidth: 78,
  },
  mostradorRotulo: { fontFamily: fontFamily.body, fontSize: 8, letterSpacing: 1, color: colors.textFaint },
  mostradorValor: { fontFamily: fontFamily.displayBold, fontSize: fontSize.sm, color: colors.textPrimary },

  acoes: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.sm },
  botaoRedondo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(22,33,27,0.9)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.feltLine,
  },
  botaoPrincipal: {
    backgroundColor: colors.goldBright,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: spacing.lg,
    minWidth: 96,
    alignItems: 'center',
  },
  botaoPrincipalTexto: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.sm, color: colors.background },
  botaoSecundario: {
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.feltLine,
    backgroundColor: 'rgba(22,33,27,0.9)',
  },
  botaoSecundarioTexto: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, color: colors.textPrimary },
  desabilitado: { opacity: 0.5 },

  resultado: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, maxWidth: 220 },
  ganhou: { color: colors.goldBright },
  perdeu: { color: colors.textSecondary },
  erro: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.danger, maxWidth: 200 },

  carregando: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
