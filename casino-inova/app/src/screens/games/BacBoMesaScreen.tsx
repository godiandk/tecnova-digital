import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { TAMPOS_16X9 } from '../../data/tamposDaMesa';
import { MAPA_BAC_BO } from '../../data/mapaDosTampos';
import { TampoDaMesa, usePalco } from '../../components/TampoDaMesa';
import { CasaDeAposta } from '../../components/CasaDeAposta';
import { Dado } from '../../components/Dado';
import { ChipStack } from '../../components/ChipStack';
import { ApiError, novaAcao } from '../../api/client';
import {
  fetchBacBoConfig,
  playBacBoRound,
  BacBoBet,
  BacBoBetType,
  BacBoConfig,
  BacBoRoundResponse,
} from '../../api/bacBo';
import { usePlayer } from '../../data/usePlayer';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme';

const PASSO_DA_APOSTA = 50;

/**
 * Bac Bo jogado NA MESA.
 *
 * A diferença pra tela antiga não é enfeite: lá a foto da mesa era papel de parede e a
 * aposta era um botão escrito "Player · paga 1 por 1" numa fileira embaixo. Aqui você
 * toca no PANO, na área que já está desenhada na arte, e a ficha fica onde você a pôs.
 * Os dados assentam na boca dos agitadores, que é onde eles estão desenhados.
 *
 * O nome e o pagamento de cada área já estão impressos no feltro, então a tela não os
 * repete — o que ela acrescenta é só o que muda: a borda acesa, a ficha, e o brilho de
 * quem ganhou.
 */
export function BacBoMesaScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const [config, setConfig] = useState<BacBoConfig | null>(null);
  const [erroDeConfig, setErroDeConfig] = useState<string | null>(null);
  const [saldo, setSaldo] = useState(0);
  const { jogador } = usePlayer();

  useEffect(() => {
    if (jogador) setSaldo(jogador.chipBalance);
  }, [jogador]);

  const [porAposta, setPorAposta] = useState(100);
  const [escolhidas, setEscolhidas] = useState<Set<BacBoBetType>>(new Set());
  const [rodada, setRodada] = useState<BacBoRoundResponse | null>(null);
  const [rolando, setRolando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetchBacBoConfig()
      .then((dados) => {
        setConfig(dados);
        setPorAposta(Math.max(dados.minBet, Math.min(100, dados.maxBet)));
      })
      .catch((e: unknown) => setErroDeConfig(e instanceof ApiError ? e.message : 'Não foi possível falar com o servidor.'));
  }, []);

  const alternar = (tipo: BacBoBetType) => {
    if (rolando) return;
    setRodada(null);
    setEscolhidas((atual) => {
      const nova = new Set(atual);
      if (nova.has(tipo)) nova.delete(tipo);
      else nova.add(tipo);
      return nova;
    });
  };

  const apostado = (tipo: BacBoBetType) => {
    if (rodada) return rodada.results.find((r) => r.type === tipo)?.amount ?? 0;
    return escolhidas.has(tipo) ? porAposta : 0;
  };

  const jogar = async () => {
    if (!config || rolando || escolhidas.size === 0) return;
    setRolando(true);
    setErro(null);
    setRodada(null);
    try {
      const apostas: BacBoBet[] = [...escolhidas].map((type) => ({ type, amount: porAposta }));
      const resultado = await playBacBoRound(apostas, novaAcao());
      /*
       * O resultado inteiro já chegou. A espera abaixo é só o tempo dos dados
       * assentarem — a animação mostra o que já aconteceu, não decide nada.
       */
      setTimeout(() => {
        setRodada(resultado);
        setSaldo(resultado.newBalance);
        setRolando(false);
      }, TEMPO_DOS_DADOS);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível apostar agora.');
      setRolando(false);
    }
  };

  const totalNaMesa = escolhidas.size * porAposta;
  const dados = rodada ? [...rodada.playerDice, ...rodada.bankerDice] : [null, null, null, null];

  return (
    <TampoDaMesa computador={TAMPOS_16X9['bac-bo'].computador} tablet={TAMPOS_16X9['bac-bo'].tablet}>
      {/* --- As três casas do pano, tocáveis --- */}
      {(['jogador', 'empate', 'banca'] as const).map((tipo) => (
        <CasaDeAposta
          key={tipo}
          area={MAPA_BAC_BO.apostas[tipo]}
          valor={apostado(tipo)}
          escolhida={escolhidas.has(tipo)}
          travada={rolando}
          vencedora={rodada?.outcome === tipo}
          onPress={() => alternar(tipo)}
        />
      ))}

      {/* --- Os quatro dados, cada um na boca do seu agitador --- */}
      {MAPA_BAC_BO.dados.map((ponto, indice) => (
        <DadoNoAgitador key={indice} ponto={ponto} face={dados[indice]} rolando={rolando} indice={indice} />
      ))}

      {/* --- Os controles, fora do pano --- */}
      <SafeAreaView style={styles.frente} edges={['top', 'bottom']} pointerEvents="box-none">
        <View style={styles.barraDeCima} pointerEvents="box-none">
          <Pressable
            onPress={navigation.goBack}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            style={styles.botaoRedondo}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <ChipStack amount={saldo} />
          <View style={styles.botaoRedondo} />
        </View>

        <View style={styles.barraDeBaixo} pointerEvents="box-none">
          {erroDeConfig && <Text style={styles.erro}>{erroDeConfig}</Text>}
          {erro && <Text style={styles.erro}>{erro}</Text>}

          {rodada && (
            <Text style={styles.placar}>
              Jogador {rodada.playerTotal} × {rodada.bankerTotal} Banca ·{' '}
              {rodada.totalReturn > rodada.totalStake
                ? `você recebeu ${rodada.totalReturn.toLocaleString('pt-BR')}`
                : rodada.totalReturn > 0
                  ? `voltou ${rodada.totalReturn.toLocaleString('pt-BR')}`
                  : 'não foi dessa vez'}
            </Text>
          )}

          <View style={styles.linhaDeControles}>
            <Pressable
              onPress={() => setPorAposta((v) => Math.max(config?.minBet ?? 50, v - PASSO_DA_APOSTA))}
              accessibilityRole="button"
              accessibilityLabel="Diminuir o valor por casa"
              style={styles.botaoRedondo}
              disabled={rolando}
            >
              <Ionicons name="remove" size={20} color={colors.textPrimary} />
            </Pressable>

            <View style={styles.valor}>
              <Text style={styles.valorRotulo}>POR CASA</Text>
              <Text style={styles.valorNumero}>{porAposta.toLocaleString('pt-BR')}</Text>
            </View>

            <Pressable
              onPress={() => setPorAposta((v) => Math.min(config?.maxBet ?? 5000, v + PASSO_DA_APOSTA))}
              accessibilityRole="button"
              accessibilityLabel="Aumentar o valor por casa"
              style={styles.botaoRedondo}
              disabled={rolando}
            >
              <Ionicons name="add" size={20} color={colors.textPrimary} />
            </Pressable>

            <Pressable
              onPress={jogar}
              disabled={rolando || escolhidas.size === 0}
              style={[styles.botaoJogar, (rolando || escolhidas.size === 0) && styles.desabilitado]}
            >
              {rolando ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.botaoJogarTexto}>
                  {escolhidas.size === 0 ? 'Toque numa casa' : `Apostar ${totalNaMesa.toLocaleString('pt-BR')}`}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </TampoDaMesa>
  );
}

/** Quanto tempo os dados chacoalham antes de mostrar a face. */
const TEMPO_DOS_DADOS = 1400;

/** Um dado assentado na boca do agitador onde ele está desenhado. */
function DadoNoAgitador({
  ponto,
  face,
  rolando,
  indice,
}: {
  ponto: { x: number; y: number };
  face: number | null;
  rolando: boolean;
  indice: number;
}) {
  const palco = usePalco();
  if (!palco) return null;
  // O dado cresce com a mesa. 5% da largura do tampo é o que cabe DENTRO do vidro do
  // agitador desenhado na arte — maior que isso e ele transborda o copo.
  const tamanho = Math.max(26, palco.largura * 0.05);
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: palco.esquerda + ponto.x * palco.largura - tamanho / 2,
        top: palco.topo + ponto.y * palco.altura - tamanho / 2,
      }}
    >
      <Dado face={face} rolando={rolando} indice={indice} tamanho={tamanho} bacBo />
    </View>
  );
}

const styles = StyleSheet.create({
  /* `box-none` deixa o toque atravessar pro pano onde não há controle. */
  frente: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  barraDeCima: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  barraDeBaixo: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
  botaoRedondo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,15,13,0.62)',
  },
  linhaDeControles: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  valor: { alignItems: 'center', minWidth: 96 },
  valorRotulo: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textSecondary, letterSpacing: 1 },
  valorNumero: { fontFamily: fontFamily.displayBold, fontSize: fontSize.lg, color: colors.textPrimary },
  botaoJogar: {
    minWidth: 190,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.goldBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoJogarTexto: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.base, color: colors.background },
  desabilitado: { opacity: 0.45 },
  placar: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    textAlign: 'center',
    backgroundColor: 'rgba(11,15,13,0.72)',
    borderRadius: radius.md,
    paddingVertical: 6,
  },
  erro: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.danger, textAlign: 'center' },
});
