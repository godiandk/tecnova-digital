import { ReactNode, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { TAMPOS_16X9 } from '../../data/tamposDaMesa';
import {
  MAPA_BAC_BO,
  TAMANHO_DA_FICHA_NO_PANO,
  TAMANHO_DA_FICHA_NO_TRILHO,
  FICHA_MINIMA_NO_PANO,
  FICHA_MINIMA_NO_TRILHO,
  FICHA_MAXIMA_NO_TRILHO,
} from '../../data/mapaDosTampos';
import { TampoDaMesa, usePalco } from '../../components/TampoDaMesa';
import { CasaDeAposta } from '../../components/CasaDeAposta';
import { TrilhoDeFichas } from '../../components/TrilhoDeFichas';
import { PilhaDeFichas } from '../../components/Ficha';
import { DENOMINACOES, corDoJogador, pilhaEmPalavras } from '../../data/fichasDeValor';
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
import { PlayerColor } from '../../data/chipImages';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme';

const CASAS = ['jogador', 'empate', 'banca'] as const;

/** Uma casa vazia é um array vazio — nunca `undefined`, pra não ter que checar em toda linha. */
type ApostasNaMesa = Record<BacBoBetType, number[]>;
const MESA_LIMPA: ApostasNaMesa = { jogador: [], empate: [], banca: [] };

const soma = (fichas: number[]) => fichas.reduce((t, f) => t + f, 0);

/**
 * Bac Bo jogado NA MESA.
 *
 * A diferença pra tela antiga não é enfeite: lá a foto da mesa era papel de parede e a
 * aposta era um botão escrito "Player · paga 1 por 1" numa fileira embaixo. Aqui você
 * pega uma ficha do trilho e a encosta no PANO, na área que já está desenhada na arte,
 * e a ficha FICA onde você a pôs. Os dados assentam na boca dos agitadores, que é onde
 * eles estão desenhados.
 *
 * O nome e o pagamento de cada área já estão impressos no feltro, então a tela não os
 * repete — o que ela acrescenta é só o que muda: a pilha de fichas, a borda acesa, e o
 * brilho de quem ganhou.
 */
export function BacBoMesaScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const [config, setConfig] = useState<BacBoConfig | null>(null);
  const [erroDeConfig, setErroDeConfig] = useState<string | null>(null);
  const [saldo, setSaldo] = useState(0);
  const { jogador } = usePlayer();
  /*
   * A SUA cor de ficha. Numa mesa compartilhada quem dá a cor é o servidor, que sabe
   * quem já sentou e não repete; aqui, jogando sozinho contra a casa, ela sai do seu
   * identificador, então é sempre a mesma pra você.
   */
  const minhaCor = corDoJogador(jogador?.id);

  useEffect(() => {
    if (jogador) setSaldo(jogador.chipBalance);
  }, [jogador]);

  const [ficha, setFicha] = useState(DENOMINACOES[1].valor);
  const [apostas, setApostas] = useState<ApostasNaMesa>(MESA_LIMPA);
  /** A ordem em que as fichas foram encostadas, pra desfazer uma de cada vez. */
  const [ordem, setOrdem] = useState<BacBoBetType[]>([]);
  /** A última rodada apostada, pra repetir sem remontar a pilha. */
  const [anterior, setAnterior] = useState<ApostasNaMesa | null>(null);
  const [rodada, setRodada] = useState<BacBoRoundResponse | null>(null);
  const [rolando, setRolando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    fetchBacBoConfig()
      .then(setConfig)
      .catch((e: unknown) =>
        setErroDeConfig(e instanceof ApiError ? e.message : 'Não foi possível falar com o servidor.'),
      );
  }, []);

  const total = useMemo(() => CASAS.reduce((t, c) => t + soma(apostas[c]), 0), [apostas]);

  /** Casas montadas abaixo do mínimo da mesa: o servidor recusaria, então avisamos antes. */
  const abaixoDoMinimo = useMemo(() => {
    const min = config?.minBet ?? 0;
    return CASAS.filter((c) => apostas[c].length > 0 && soma(apostas[c]) < min);
  }, [apostas, config]);

  /** Encostar a ficha escolhida numa casa. Tocar de novo empilha outra. */
  const encostar = (casa: BacBoBetType) => {
    if (rolando || !config) return;
    setRodada(null);
    setErro(null);

    if (total + ficha > saldo) {
      setAviso('Você não tem fichas suficientes pra essa.');
      return;
    }
    if (soma(apostas[casa]) + ficha > config.maxBet) {
      setAviso(`O máximo por casa é ${config.maxBet.toLocaleString('pt-BR')}.`);
      return;
    }

    setAviso(null);
    setApostas((atual) => ({ ...atual, [casa]: [...atual[casa], ficha] }));
    setOrdem((atual) => [...atual, casa]);
  };

  /** Tirar a última ficha encostada, seja em que casa for. */
  const desfazer = () => {
    if (rolando || ordem.length === 0) return;
    const ultima = ordem[ordem.length - 1];
    setApostas((atual) => ({ ...atual, [ultima]: atual[ultima].slice(0, -1) }));
    setOrdem((atual) => atual.slice(0, -1));
    setAviso(null);
    setRodada(null);
  };

  const limpar = () => {
    if (rolando) return;
    setApostas(MESA_LIMPA);
    setOrdem([]);
    setAviso(null);
    setRodada(null);
  };

  /** Remontar a mesa exatamente como estava na rodada passada. */
  const repetir = () => {
    if (rolando || !anterior) return;
    const custo = CASAS.reduce((t, c) => t + soma(anterior[c]), 0);
    if (custo > saldo) {
      setAviso('Você não tem fichas suficientes pra repetir.');
      return;
    }
    setApostas(anterior);
    setOrdem(CASAS.flatMap((c) => anterior[c].map(() => c)));
    setAviso(null);
    setRodada(null);
  };

  const jogar = async () => {
    if (!config || rolando || total === 0 || abaixoDoMinimo.length > 0) return;
    setRolando(true);
    setErro(null);
    setAviso(null);
    setRodada(null);
    const montagem = apostas;
    try {
      const lista: BacBoBet[] = CASAS.filter((c) => montagem[c].length > 0).map((type) => ({
        type,
        amount: soma(montagem[type]),
      }));
      const resultado = await playBacBoRound(lista, novaAcao());
      /*
       * O resultado inteiro já chegou. A espera abaixo é só o tempo dos dados
       * assentarem — a animação mostra o que já aconteceu, não decide nada.
       */
      setTimeout(() => {
        setRodada(resultado);
        setSaldo(resultado.newBalance);
        setAnterior(montagem);
        setRolando(false);
      }, TEMPO_DOS_DADOS);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível apostar agora.');
      setRolando(false);
    }
  };

  const dados = rodada ? [...rodada.playerDice, ...rodada.bankerDice] : [null, null, null, null];
  const podeJogar = total > 0 && abaixoDoMinimo.length === 0 && !rolando;

  /*
   * "Confirmar", não "Apostar": as três casas do pano já se chamam "Apostar no
   * Jogador", "Apostar no Empate" e "Apostar na Banca". Um quarto botão chamado
   * "Apostar 250" deixava quatro alvos com nome quase igual, e quem navega de ouvido
   * não tinha como saber qual fecha a rodada.
   */
  const rotuloDoBotao = () => {
    if (total === 0) return 'Encoste uma ficha no pano';
    if (abaixoDoMinimo.length > 0) return `Mínimo ${config?.minBet.toLocaleString('pt-BR')} por casa`;
    return `Confirmar ${total.toLocaleString('pt-BR')}`;
  };

  return (
    <TampoDaMesa computador={TAMPOS_16X9['bac-bo'].computador} tablet={TAMPOS_16X9['bac-bo'].tablet}>
      {/* --- As três casas do pano, com as fichas encostadas em cima --- */}
      {CASAS.map((casa) => (
        <CasaDeAposta
          key={casa}
          nome={casa}
          area={MAPA_BAC_BO.apostas[casa]}
          valor={soma(apostas[casa])}
          descricao={pilhaEmPalavras(apostas[casa])}
          travada={rolando}
          vencedora={rodada?.outcome === casa}
          onPress={() => encostar(casa)}
        >
          <PilhaNoPano fichas={apostas[casa]} cor={minhaCor} />
        </CasaDeAposta>
      ))}

      {/*
        --- Os quatro dados, cada um dentro do seu agitador ---
        Antes da primeira rodada os copos ficam VAZIOS, que é como a máquina de verdade
        fica enquanto a mesa aceita aposta. Dado parado no vidro sem rodada nenhuma é
        cenário; dado que aparece quando a rodada começa é o jogo.
      */}
      {(rolando || rodada) &&
        MAPA_BAC_BO.dados.map((ponto, indice) => (
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

        <Apron>
          {erroDeConfig && <Text style={styles.erro}>{erroDeConfig}</Text>}
          {erro && <Text style={styles.erro}>{erro}</Text>}
          {aviso && <Text style={styles.aviso}>{aviso}</Text>}

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

          <View style={styles.linhaDoTrilho}>
            <View style={styles.ladoDoTrilho}>
              <BotaoDeMesa
                icone="arrow-undo"
                rotulo="Desfazer a última ficha"
                onPress={desfazer}
                inativo={rolando || ordem.length === 0}
              />
              <BotaoDeMesa
                icone="trash-outline"
                rotulo="Limpar a mesa"
                onPress={limpar}
                inativo={rolando || total === 0}
              />
            </View>

            <Trilho
              cor={minhaCor}
              selecionada={ficha}
              onSelecionar={(v) => {
                setFicha(v);
                setAviso(null);
              }}
              saldo={saldo - total}
              travado={rolando}
            />

            <View style={styles.ladoDoTrilho}>
              <BotaoDeMesa
                icone="repeat"
                rotulo="Repetir a aposta anterior"
                onPress={repetir}
                inativo={rolando || !anterior}
              />
            </View>
          </View>

          <Pressable
            onPress={jogar}
            disabled={!podeJogar}
            accessibilityRole="button"
            accessibilityLabel={rotuloDoBotao()}
            accessibilityState={{ disabled: !podeJogar }}
            style={[styles.botaoJogar, !podeJogar && styles.desabilitado]}
          >
            {rolando ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.botaoJogarTexto}>{rotuloDoBotao()}</Text>
            )}
          </Pressable>
        </Apron>
      </SafeAreaView>
    </TampoDaMesa>
  );
}

/** Quanto tempo os dados chacoalham antes de mostrar a face. */
const TEMPO_DOS_DADOS = 1400;

/**
 * O AVENTAL — a faixa escura entre a beirada da mesa e a borda de baixo da tela.
 *
 * Numa mesa de verdade existe esse pedaço: o couro do parapeito onde o jogador apoia o
 * braço e deixa as fichas. Sem ele os controles ficavam metade em cima do feltro e
 * metade no preto do salão, cortados pela beirada da arte no meio de uma ficha. Aqui o
 * avental começa exatamente onde o tampo termina, então a divisão é a da própria mesa.
 */
function Apron({ children }: { children: ReactNode }) {
  const palco = usePalco();
  const fimDoTampo = palco ? palco.topo + palco.altura : undefined;
  return (
    <View style={[styles.avental, fimDoTampo !== undefined && { paddingTop: 0 }]} pointerEvents="box-none">
      <LinearGradient
        colors={['rgba(6,9,8,0)', 'rgba(6,9,8,0.86)', 'rgba(6,9,8,0.97)']}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

/** O trilho de fichas no tamanho medido pela mesa. */
function Trilho(props: {
  selecionada: number;
  onSelecionar: (valor: number) => void;
  cor: PlayerColor | undefined;
  saldo: number;
  travado: boolean;
}) {
  const palco = usePalco();
  return <TrilhoDeFichas {...props} tamanho={fichaNoTrilho(palco?.largura ?? 700)} />;
}

/** A pilha dentro da casa, no tamanho medido na arte (ver TAMANHO_DA_FICHA_NO_PANO). */
function PilhaNoPano({ fichas, cor }: { fichas: number[]; cor: PlayerColor | undefined }) {
  const palco = usePalco();
  if (!palco || fichas.length === 0) return null;
  return <PilhaDeFichas fichas={fichas} cor={cor} tamanho={fichaNoPano(palco.largura)} />;
}

/** Diâmetro da ficha em cima do pano, a partir da largura que o tampo ocupou na tela. */
function fichaNoPano(larguraDoTampo: number) {
  return Math.round(Math.max(FICHA_MINIMA_NO_PANO, larguraDoTampo * TAMANHO_DA_FICHA_NO_PANO));
}

/** Diâmetro da ficha no trilho: maior que a do pano, porque nela se toca. */
function fichaNoTrilho(larguraDoTampo: number) {
  const bruto = larguraDoTampo * TAMANHO_DA_FICHA_NO_TRILHO;
  return Math.round(Math.min(FICHA_MAXIMA_NO_TRILHO, Math.max(FICHA_MINIMA_NO_TRILHO, bruto)));
}

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
      <Dado
        face={face}
        rolando={rolando}
        indice={indice}
        tamanho={tamanho}
        nome={indice < 2 ? `Dado ${indice + 1} do jogador` : `Dado ${indice - 1} da banca`}
        bacBo
        noAgitador
      />
    </View>
  );
}

function BotaoDeMesa({
  icone,
  rotulo,
  onPress,
  inativo,
}: {
  icone: keyof typeof Ionicons.glyphMap;
  rotulo: string;
  onPress: () => void;
  inativo: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={inativo}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ disabled: inativo }}
      hitSlop={8}
      style={[styles.botaoRedondo, inativo && styles.desabilitado]}
    >
      <Ionicons name={icone} size={24} color={colors.textPrimary} />
    </Pressable>
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
  avental: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
  },
  botaoRedondo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,15,13,0.62)',
  },
  /*
   * O trilho fica no CENTRO da tela, não no centro do que sobrou depois dos botões:
   * os dois lados têm a mesma largura mínima, então desfazer/limpar de um lado e
   * repetir do outro não empurram as fichas pro canto.
   */
  linhaDoTrilho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  ladoDoTrilho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minWidth: 104 },
  botaoJogar: {
    minWidth: 210,
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
  aviso: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.gold, textAlign: 'center' },
});
