import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import {
  type CalendarioDeRecompensa,
  coletarRecompensa,
  fetchCalendarioDeRecompensa,
} from '../api/recompensas';
import { ApiError, mensagemParaOJogador } from '../api/client';
import { RECOMPENSA, estadoDaCasa } from '../data/recompensaAssets';
import { CasaDoCalendario } from '../components/CasaDoCalendario';
import { usePlayer } from '../data/usePlayer';
import { chaveDeColeta } from '../data/chaveDeColeta';
import { colors, fontFamily, fontSize, radius, spacing, useJanela, LARGURA_MAXIMA } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'RecompensaDiaria'>;

/**
 * O CALENDÁRIO DA RECOMPENSA DIÁRIA.
 *
 * A tela existe porque o servidor já tinha tudo — tabela, regra de sequência, trava de
 * corrida, extrato — e nada em `app/src/` referenciava os arquivos de arte. A recompensa
 * era invisível: funcionava e ninguém via.
 *
 * O QUE ELA DIZ, E POR QUE CADA COISA ESTÁ ESCRITA:
 *
 *   - O CALENDÁRIO INTEIRO, com o valor de cada dia, inclusive os que ainda não abriram.
 *     Não existe prêmio surpresa nem caixa que pode vir vazia.
 *   - A REGRA DO RESET, dita antes e não depois: perder um dia volta pro dia 1. Uma regra
 *     que só aparece quando morde é uma pegadinha.
 *   - QUANDO O DIA VIRA, com hora. O dia do jogo é em UTC, o que no Brasil quer dizer 21h
 *     — e a única coisa pior que uma virada em horário estranho é descobri-la perdendo a
 *     sequência.
 *   - OS DOIS NÚMEROS: a casa da grade deste mês e a sequência de verdade, que atravessa a
 *     virada do mês. Mostrar só a casa faria parecer que a sequência zerou no dia 1º.
 */
export function RecompensaDiariaScreen({ navigation }: Props) {
  const [calendario, setCalendario] = useState<CalendarioDeRecompensa | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [coletando, setColetando] = useState(false);
  const [coletouAgora, setColetouAgora] = useState<number | null>(null);
  const { recarregar } = usePlayer();

  const janela = useJanela();
  const largura = Math.min(janela.width, LARGURA_MAXIMA) - spacing.lg * 2;
  /* Sete colunas em tela larga, cinco no celular: a grade de um calendário de verdade. */
  const colunas = largura >= 520 ? 7 : 5;
  const tamanhoDaCasa = Math.floor((largura - spacing.sm * (colunas - 1)) / colunas);

  const carregar = useCallback(() => {
    fetchCalendarioDeRecompensa()
      .then(setCalendario)
      .catch((e: unknown) => setErro(mensagemParaOJogador(e, 'Não foi possível falar com o servidor.')));
  }, []);

  useEffect(carregar, [carregar]);

  const coletar = async () => {
    if (!calendario || coletando) return;
    setColetando(true);
    setErro(null);
    try {
      /*
       * A CHAVE É A DO DIA, e não uma nova por toque. Sortear a cada toque transformaria o
       * segundo toque numa coleta DIFERENTE, que o servidor recusaria com "já coletou" — e
       * quem tocou duas vezes por causa de rede lenta veria um erro no lugar do prêmio.
       */
      const feita = await coletarRecompensa(chaveDeColeta(calendario.hoje));
      setCalendario(feita.calendario);
      setColetouAgora(feita.premio);
      recarregar();
    } catch (e: unknown) {
      setErro(mensagemParaOJogador(e, 'Não foi possível coletar agora. Tente de novo.'));
      carregar();
    } finally {
      setColetando(false);
    }
  };

  const maiorDoMes = calendario ? Math.max(...calendario.dias.map((d) => d.premio)) : 0;

  return (
    <View style={estilos.raiz}>
      <Image
        source={janela.width >= 720 ? RECOMPENSA.fundoComputador : RECOMPENSA.fundoCelular}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      <View style={[StyleSheet.absoluteFill, estilos.veu]} />
      <SafeAreaView style={estilos.seguro} edges={['top']}>
        <View style={estilos.topo}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            style={estilos.botaoDeIcone}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <Text style={estilos.titulo}>Recompensa diária</Text>
          <View style={estilos.botaoDeIcone} />
        </View>

        {!calendario && !erro && <ActivityIndicator color={colors.goldBright} style={estilos.carregando} />}
        {erro && <Text style={estilos.erro}>{erro}</Text>}

        {calendario && (
          <ScrollView contentContainerStyle={[estilos.conteudo, { maxWidth: LARGURA_MAXIMA }]}>
            <View style={estilos.resumo}>
              <View>
                <Text style={estilos.rotulo}>Sequência</Text>
                <Text style={estilos.numeroGrande}>
                  {calendario.diasSeguidos} {calendario.diasSeguidos === 1 ? 'dia' : 'dias'}
                </Text>
              </View>
              <View style={estilos.alinhadoADireita}>
                <Text style={estilos.rotulo}>Nível {calendario.nivel}</Text>
                <Text style={estilos.bonus}>
                  {calendario.bonusDeNivel.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}× no prêmio
                </Text>
              </View>
            </View>

            {calendario.sequenciaPerdida && (
              <Text style={estilos.aviso}>
                Você perdeu um dia e a sequência voltou para o começo. Coletando hoje, ela recomeça no dia 1.
              </Text>
            )}

            <View style={[estilos.grade, { gap: spacing.sm }]}>
              {calendario.dias.map((casa) => (
                <CasaDoCalendario
                  key={casa.dia}
                  dia={casa.dia}
                  premio={casa.premio}
                  marco={casa.marco}
                  estado={estadoDaCasa(casa.dia, calendario)}
                  maiorDoMes={maiorDoMes}
                  tamanho={tamanhoDaCasa}
                />
              ))}
            </View>

            {coletouAgora !== null && (
              <Text style={estilos.ganhou}>
                +{coletouAgora.toLocaleString('pt-BR')} fichas — volte amanhã para o próximo dia.
              </Text>
            )}

            <Pressable
              onPress={coletar}
              disabled={!calendario.podeColetar || coletando}
              accessibilityRole="button"
              style={[estilos.botao, (!calendario.podeColetar || coletando) && estilos.botaoDesligado]}
            >
              {coletando ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={estilos.botaoTexto}>
                  {calendario.podeColetar
                    ? `COLETAR ${calendario.premioDeHoje.toLocaleString('pt-BR')} FICHAS`
                    : 'JÁ COLETADO HOJE'}
                </Text>
              )}
            </Pressable>

            {/*
              AS DUAS REGRAS QUE MORDEM, ditas antes de morderem. A do reset, e a da hora em
              que o dia vira — o dia do jogo é contado em UTC, o que no Brasil é 21h.
            */}
            <Text style={estilos.regra}>
              Perder um dia volta a sequência para o dia 1. O dia do jogo vira à meia-noite UTC — 21h no
              horário de Brasília. {!calendario.podeColetar && `O próximo dia abre em ${calendario.proximaAbertura}.`}
            </Text>
            <Text style={estilos.regra}>
              O prêmio sai do seu NÍVEL, não do seu saldo: jogar aumenta a recompensa, e perder fichas não
              a diminui.
            </Text>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colors.background },
  veu: { backgroundColor: colors.overlay },
  seguro: { flex: 1 },
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  botaoDeIcone: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  titulo: { fontFamily: fontFamily.displayBold, fontSize: fontSize.lg, color: colors.textPrimary },
  carregando: { marginTop: spacing.xl },
  erro: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.danger, textAlign: 'center', padding: spacing.lg },
  conteudo: { padding: spacing.lg, gap: spacing.md, alignSelf: 'center', width: '100%' },
  resumo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  alinhadoADireita: { alignItems: 'flex-end' },
  rotulo: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },
  numeroGrande: { fontFamily: fontFamily.displayBold, fontSize: fontSize.xl, color: colors.textPrimary },
  bonus: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.md, color: colors.goldBright },
  aviso: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    lineHeight: 20,
  },
  grade: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  ganhou: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.md, color: colors.success, textAlign: 'center' },
  botao: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.goldBright,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  botaoDesligado: { backgroundColor: colors.backgroundElevated },
  botaoTexto: { fontFamily: fontFamily.displayBold, fontSize: fontSize.md, color: colors.background },
  regra: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint, lineHeight: 18, textAlign: 'center' },
});
