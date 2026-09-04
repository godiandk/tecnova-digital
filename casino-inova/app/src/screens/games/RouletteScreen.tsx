import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../../navigation/types';
import { getTutorialByGameId } from '../../data/tutorials';
import { TABLE_IMAGES } from '../../data/tableImages';
import { TutorialModal } from '../../components/TutorialModal';
import { GameBackdrop } from '../../components/GameBackdrop';
import { ChipStack } from '../../components/ChipStack';
import { RodaDaRoleta } from '../../components/RodaDaRoleta';
import { PanoDaRoleta } from '../../components/PanoDaRoleta';
import { TrilhoDeFichas } from '../../components/TrilhoDeFichas';
import { RouletteHistoryPanel, RouletteHistory } from '../../components/RouletteHistoryPanel';
import { ApiError, novaAcao } from '../../api/client';
import {
  fetchRouletteConfig,
  fetchRouletteHistory,
  spinRoulette,
  ApostaDaRoleta,
  RouletteConfig,
  RouletteSpinResponse,
} from '../../api/roulette';
import { fetchMeuNivel, MeuNivel } from '../../api/niveis';
import { CASAS_POR_CHAVE, CasaDoPano } from '../../data/panoDaRoleta';
import { chapaEmTexto, corDoJogador } from '../../data/fichasDeValor';
import { usePlayer, saldoChegouDeFora } from '../../data/usePlayer';
import { usuarioLogadoId } from '../../api/session';
import { useJanela } from '../../theme/useJanela';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Roulette'>;

const COR_DA_CASA: Record<string, string> = {
  vermelho: '#B0201C',
  preto: '#171A18',
  verde: '#116B3C',
};

/** Quanto a bola leva pra assentar. É o mesmo tempo da parada em RodaDaRoleta. */
const ATE_A_BOLA_PARAR = 3200;

/**
 * A ROLETA, jogada na mesa.
 *
 * A tela anterior tinha dez pílulas escritas ("Vermelho · ×2", "Número exato · ×36") e
 * um − / + preso no teto da configuração. Duas coisas erradas ao mesmo tempo: não havia
 * como escolher QUAL número (a pílula "número exato" não perguntava qual), e quem tinha
 * bilhões precisava apertar o "mais" a vida inteira pra chegar na própria aposta mínima.
 *
 * Agora é mesa: o pano com as 37 casas e as doze apostas de fora, a ficha escolhida no
 * trilho (que vem do degrau da pessoa, calculado pelo servidor sobre o saldo), quantas
 * apostas quiser antes de a bola correr, e desfazer/limpar/repetir como na mesa.
 *
 * A BOLA CONTINUA NÃO DECIDINDO NADA. O servidor sorteia e responde ANTES de a roda
 * começar a parar; a animação leva a bola até a casa que já saiu. É por isso que o
 * resultado escrito e o saldo só aparecem depois que ela assenta — não pra criar
 * suspense falso, mas porque contar antes seria a tela entregando um resultado que ela
 * não produziu.
 */
export function RouletteScreen({ navigation }: Props) {
  const tutorial = getTutorialByGameId('roleta');
  const [tutorialVisible, setTutorialVisible] = useState(true);

  const { jogador } = usePlayer();
  const saldo = jogador?.chipBalance ?? 0;
  const janela = useJanela();

  const [config, setConfig] = useState<RouletteConfig | null>(null);
  const [erroDaConfig, setErroDaConfig] = useState<string | null>(null);
  const [meuNivel, setMeuNivel] = useState<MeuNivel | null>(null);
  const [historico, setHistorico] = useState<RouletteHistory | null>(null);

  /** Quanto está encostado em cada casa, pela chave dela. */
  const [apostas, setApostas] = useState<Record<string, number>>({});
  /**
   * As fichas encostadas, na ordem, cada uma com O VALOR QUE ELA TINHA.
   *
   * Guardar só a casa não bastava: quem encosta uma de 500 mil, troca pra uma de 10
   * milhões, encosta de novo e desfaz teria 10 milhões tirados da primeira. O valor vem
   * junto porque é ele que volta.
   */
  const [ordem, setOrdem] = useState<Array<{ chave: string; valor: number }>>([]);
  /** A última rodada apostada, pro "repetir". */
  const [anterior, setAnterior] = useState<Record<string, number> | null>(null);
  const [ficha, setFicha] = useState(50);
  const [fichaAjustada, setFichaAjustada] = useState(false);

  const [girando, setGirando] = useState(false);
  const [rodada, setRodada] = useState<RouletteSpinResponse | null>(null);
  /** O resultado só é ESCRITO depois que a bola assenta. Antes disso a roda é que fala. */
  const [resultadoNaTela, setResultadoNaTela] = useState<RouletteSpinResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);

  useEffect(() => {
    fetchRouletteConfig()
      .then(setConfig)
      .catch((e: unknown) =>
        setErroDaConfig(e instanceof ApiError ? e.message : 'Não foi possível falar com o servidor.'),
      );
    fetchRouletteHistory().then(setHistorico).catch(() => undefined);
  }, []);

  /* O degrau é relido a cada mudança de saldo: perder um degrau muda mínimo e fichas. */
  useEffect(() => {
    fetchMeuNivel().then(setMeuNivel).catch(() => undefined);
  }, [saldo]);

  /* A ficha começa valendo o mínimo da mesa, e não 50 — uma vez só, sem atropelar escolha. */
  useEffect(() => {
    if (!meuNivel || fichaAjustada) return;
    setFicha(meuNivel.nivel.minimo);
    setFichaAjustada(true);
  }, [meuNivel, fichaAjustada]);

  const minimo = meuNivel?.nivel.minimo ?? config?.minBet ?? 50;
  const total = useMemo(() => Object.values(apostas).reduce((t, v) => t + v, 0), [apostas]);
  const travado = girando;

  const encostar = useCallback(
    (casa: CasaDoPano) => {
      if (travado) return;
      if (total + ficha > saldo) {
        setRecado('Você não tem fichas suficientes pra essa.');
        return;
      }
      setRecado(null);
      setErro(null);
      setApostas((atual) => ({ ...atual, [casa.chave]: (atual[casa.chave] ?? 0) + ficha }));
      setOrdem((atual) => [...atual, { chave: casa.chave, valor: ficha }]);
    },
    [travado, total, ficha, saldo],
  );

  /*
   * Desfaz A ÚLTIMA FICHA, e não a casa inteira: quem encostou três no 17 e errou a
   * terceira quer tirar uma, não perder as três.
   */
  const desfazer = () => {
    if (travado || ordem.length === 0) return;
    const ultima = ordem[ordem.length - 1];
    setOrdem((atual) => atual.slice(0, -1));
    setApostas((atual) => {
      const restante = (atual[ultima.chave] ?? 0) - ultima.valor;
      const proximo = { ...atual };
      if (restante > 0) proximo[ultima.chave] = restante;
      else delete proximo[ultima.chave];
      return proximo;
    });
    setRecado(null);
  };

  const limpar = () => {
    if (travado) return;
    setApostas({});
    setOrdem([]);
    setRecado(null);
  };

  const repetir = () => {
    if (travado || !anterior) return;
    const custo = Object.values(anterior).reduce((t, v) => t + v, 0);
    if (custo > saldo) {
      setRecado('Você não tem fichas suficientes pra repetir.');
      return;
    }
    setApostas(anterior);
    setOrdem(Object.entries(anterior).map(([chave, valor]) => ({ chave, valor })));
    setRecado(null);
  };

  const girar = async () => {
    if (travado || total === 0) return;
    const abaixo = Object.entries(apostas).filter(([, v]) => v < minimo);
    if (abaixo.length > 0) {
      setRecado(`O mínimo é ${chapaEmTexto(minimo)} por casa.`);
      return;
    }

    const montagem = { ...apostas };
    const bets: ApostaDaRoleta[] = Object.entries(montagem).map(([chave, amount]) => {
      const c = CASAS_POR_CHAVE.get(chave)!;
      return c.tipo === 'numero' ? { type: c.tipo, number: c.numero, amount } : { type: c.tipo, amount };
    });

    setGirando(true);
    setErro(null);
    setRecado(null);
    setResultadoNaTela(null);
    try {
      const r = await spinRoulette(bets, novaAcao());
      setRodada(r);
      setAnterior(montagem);
      setHistorico(r.history);
      /*
       * A bola já sabe onde vai parar — o servidor decidiu antes desta linha. O que
       * espera aqui é só a roda terminar de contar: o número escrito, o saldo e as
       * casas acesas entram todos quando ela assenta, juntos, porque é isso que
       * acontece na mesa quando o crupiê aponta a casa.
       */
      setTimeout(() => {
        setResultadoNaTela(r);
        setApostas({});
        setOrdem([]);
        saldoChegouDeFora(r.newBalance);
        setGirando(false);
      }, ATE_A_BOLA_PARAR);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível girar agora.');
      setGirando(false);
    }
  };

  /* A roda ocupa o que sobra da largura, com teto: num tablet ela não vira um prato. */
  const larguraDoPano = Math.min(janela.width - spacing.md * 2, 560);
  const tamanhoDaRoda = Math.min(larguraDoPano * 0.62, 240);

  return (
    <GameBackdrop source={TABLE_IMAGES.roleta} apagarAMesa>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.barraDeCima}>
          <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Sair da mesa" style={styles.botaoRedondo} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          {/*
            O saldo mostrado é o do JOGADOR, e ele só muda quando a bola para: até lá
            `saldoChegouDeFora` ainda não foi chamado. É o mesmo princípio do pano da
            Banca Francesa — a barra não entrega o resultado antes da animação.
          */}
          <ChipStack amount={saldo} />
          <Pressable onPress={() => setTutorialVisible(true)} accessibilityRole="button" accessibilityLabel="Como jogar" style={styles.botaoRedondo} hitSlop={12}>
            <Ionicons name="help-circle" size={24} color={colors.goldBright} />
          </Pressable>
        </View>

        {!config && !erroDaConfig && <ActivityIndicator color={colors.goldBright} style={styles.carregando} />}
        {erroDaConfig && (
          <View style={styles.caixaDeErro}>
            <Text style={styles.erro}>{erroDaConfig}</Text>
            <Text style={styles.dica}>Confira se o servidor (server/) está rodando em npm run start:dev.</Text>
          </View>
        )}

        {config && (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.rolagem}>
            <View style={styles.roda}>
              <RodaDaRoleta resultado={rodada ? rodada.pocket : null} girando={girando} tamanho={tamanhoDaRoda} />
              {!girando && resultadoNaTela && (
                <View style={[styles.selo, { backgroundColor: COR_DA_CASA[resultadoNaTela.color] }]}>
                  <Text style={styles.seloNumero}>{resultadoNaTela.pocket}</Text>
                </View>
              )}
            </View>

            {resultadoNaTela && !girando && (
              <Text style={[styles.placar, resultadoNaTela.win ? styles.ganhou : styles.perdeu]}>
                {resultadoNaTela.win
                  ? `Caiu no ${resultadoNaTela.pocket} — você recebeu ${resultadoNaTela.totalReturn.toLocaleString('pt-BR')} fichas`
                  : `Caiu no ${resultadoNaTela.pocket} — não foi dessa vez`}
              </Text>
            )}
            {erro && <Text style={styles.erro}>{erro}</Text>}
            {recado && <Text style={styles.recado}>{recado}</Text>}

            <PanoDaRoleta
              apostas={apostas}
              saiu={girando ? null : resultadoNaTela?.pocket ?? null}
              travado={travado}
              onEncostar={encostar}
              largura={larguraDoPano}
            />

            <Text style={styles.placaDaMesa}>
              Mesa {meuNivel?.nivel.nome ?? '—'} · mínimo {chapaEmTexto(minimo)} por casa · sem teto ·
              {' '}RTP {(config.theoreticalRtp * 100).toFixed(2)}% em toda aposta
            </Text>

            <TrilhoDeFichas
              selecionada={ficha}
              onSelecionar={setFicha}
              cor={corDoJogador(usuarioLogadoId() ?? undefined)}
              saldo={saldo}
              travado={travado}
              fichas={meuNivel?.nivel.fichas}
              minimo={minimo}
            />

            <View style={styles.botoesDaMesa}>
              <BotaoDaMesa icone="arrow-undo" rotulo="Tirar a última ficha" onPress={desfazer} apagado={travado || ordem.length === 0} />
              <BotaoDaMesa icone="trash" rotulo="Limpar a mesa" onPress={limpar} apagado={travado || total === 0} />
              <BotaoDaMesa icone="repeat" rotulo="Repetir a aposta anterior" onPress={repetir} apagado={travado || !anterior} />
            </View>

            <Pressable
              onPress={girar}
              disabled={travado || total === 0}
              accessibilityRole="button"
              style={[styles.girar, (travado || total === 0) && styles.girarApagado]}
            >
              <Text style={styles.girarTexto}>
                {girando ? 'A bola está correndo…' : total === 0 ? 'Encoste uma ficha no pano' : `Girar · ${chapaEmTexto(total)}`}
              </Text>
            </Pressable>

            {historico && <RouletteHistoryPanel history={historico} />}
          </ScrollView>
        )}

        {tutorial && (
          <TutorialModal visible={tutorialVisible} gameName="Roleta" tutorial={tutorial} onClose={() => setTutorialVisible(false)} />
        )}
      </SafeAreaView>
    </GameBackdrop>
  );
}

function BotaoDaMesa({
  icone,
  rotulo,
  onPress,
  apagado,
}: {
  icone: keyof typeof Ionicons.glyphMap;
  rotulo: string;
  onPress: () => void;
  apagado: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={apagado}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      style={[styles.botaoDaMesa, apagado && styles.botaoApagado]}
      hitSlop={8}
    >
      <Ionicons name={icone} size={20} color={colors.goldBright} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  barraDeCima: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  botaoRedondo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,14,11,0.72)',
  },
  carregando: { marginTop: spacing.xl },
  caixaDeErro: { paddingHorizontal: spacing.md },
  rolagem: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm, alignItems: 'center' },
  roda: { alignItems: 'center', justifyContent: 'center' },
  selo: {
    position: 'absolute',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.goldBright,
  },
  seloNumero: { fontFamily: fontFamily.displayBold, fontSize: 30, color: '#F4EFE2' },
  placar: { fontFamily: fontFamily.displayBold, fontSize: fontSize.md, textAlign: 'center' },
  ganhou: { color: colors.goldBright },
  perdeu: { color: colors.textSecondary },
  erro: { color: '#E8A0A0', fontSize: fontSize.sm, textAlign: 'center' },
  recado: { color: colors.goldBright, fontSize: fontSize.sm, textAlign: 'center' },
  dica: { color: colors.textSecondary, fontSize: fontSize.xs, textAlign: 'center' },
  placaDaMesa: { color: colors.textSecondary, fontSize: fontSize.xs, textAlign: 'center' },
  botoesDaMesa: { flexDirection: 'row', gap: spacing.lg, justifyContent: 'center' },
  botaoDaMesa: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,14,11,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(214,178,94,0.45)',
  },
  botaoApagado: { opacity: 0.35 },
  girar: {
    alignSelf: 'stretch',
    paddingVertical: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.goldBright,
    alignItems: 'center',
  },
  girarApagado: { backgroundColor: 'rgba(214,178,94,0.35)' },
  girarTexto: { fontFamily: fontFamily.displayBold, fontSize: fontSize.md, color: '#10201A' },
});
