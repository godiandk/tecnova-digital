import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import { getGameById } from '../data/games';
import { getGameMode, GameModeOption } from '../data/gameModes';
import { LOBBY_UI, MODE_BANNERS } from '../data/lobbyAssets';
import { colors, fontFamily, fontSize, radius, spacing } from '../theme';
import { Fundo } from '../components/Fundo';

/** Os cartazes de variante são 1200x600 — deitados, empilhados numa lista. */
/*
 * A altura do cartaz sai da largura MEDIDA, dividida pela proporção da arte (1000×500).
 *
 * Duas tentativas anteriores erraram, e vale registrar as duas porque a segunda parece
 * certa e não é:
 *
 * 1. `Dimensions.get('window').width / 2`, lido no topo do arquivo. Isso é a janela do
 *    instante em que o arquivo carregou, e nunca mais — girar o telefone ou
 *    redimensionar a aba deixava a altura de outro tamanho de tela.
 *
 * 2. `aspectRatio` puro. NÃO FUNCIONA COM IMAGEM: uma imagem já tem altura própria, a
 *    do arquivo, e ela ganha. O cartaz de 1000×500 saía 354 de largura por 500 de
 *    altura — quase três vezes mais alto do que devia. Era o que fazia a tela de
 *    escolha do dominó virar duas caixas pretas gigantes: como o recorte é `cover`, o
 *    que aparecia era só o pedaço escuro da esquerda, sem o nome nem a mesa. Medido no
 *    navegador: o `aspect-ratio: 2/1` estava lá no CSS e era ignorado, porque `height`
 *    vinha em pixel junto.
 *
 * Com a largura medida por `onLayout` e a altura em número, o recorte é o mesmo em todo
 * lugar e acompanha qualquer tela — que é a mesma solução já usada no Destaque.
 */
const PROPORCAO_DO_CARTAZ = 1000 / 500;

type Props = NativeStackScreenProps<RootStackParamList, 'GameMode'>;

/**
 * Tela do meio: aparece só pros jogos que têm mais de um jeito de jogar (truco,
 * dominó, banca francesa). Os grupos vêm de gameModes.ts — variante primeiro, modo
 * depois — e a escolha de cada grupo vai se acumulando até a última, que é a que
 * dispara a navegação.
 */
export function GameModeScreen({ navigation, route }: Props) {
  const { gameId } = route.params;
  const game = getGameById(gameId);
  const config = getGameMode(gameId);

  const [escolhas, setEscolhas] = useState<Record<string, GameModeOption>>({});
  /*
   * A largura de verdade do cartão, medida quando ele é desenhado.
   *
   * Nasce zerada e o cartaz só aparece depois da primeira medida — um quadro de atraso,
   * imperceptível, e em troca a altura é sempre a certa em qualquer tela, inclusive
   * depois de girar o telefone ou redimensionar a janela.
   */
  const [larguraDoCartao, setLarguraDoCartao] = useState(0);
  const alturaDoCartaz = Math.round(larguraDoCartao / PROPORCAO_DO_CARTAZ);

  if (!config?.groups) {
    return (
      <SafeAreaView style={styles.fallback}>
        <Text style={styles.errorText}>Esse jogo não tem modos pra escolher.</Text>
      </SafeAreaView>
    );
  }

  const grupos = config.groups;
  const ultimoGrupo = grupos[grupos.length - 1];

  const escolher = (grupoTitulo: string, option: GameModeOption) => {
    if (option.comingSoon) return;

    const novas = { ...escolhas, [grupoTitulo]: option };
    setEscolhas(novas);

    // Só navega quando o último grupo for escolhido — antes disso é só ir montando.
    if (grupoTitulo !== ultimoGrupo.title) return;

    // Junta os parâmetros de todas as escolhas (variante + modo, por exemplo).
    const params = Object.values(novas).reduce<Record<string, unknown>>(
      (acc, item) => ({ ...acc, ...(item.params ?? {}) }),
      {},
    );
    navigation.replace(option.route as never, params as never);
  };

  return (
    <Fundo source={LOBBY_UI.fundoSelecaoModo} style={styles.fundo} resizeMode="cover">
      <View style={styles.veu} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Voltar" style={styles.iconButton} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.title}>{game?.name ?? 'Escolha o modo'}</Text>
          <View style={styles.iconButton} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {grupos.map((grupo) => {
            const escolhido = escolhas[grupo.title];
            return (
              <View key={grupo.title} style={styles.group}>
                <Text style={styles.groupTitle}>{grupo.title}</Text>
                {grupo.options.map((option) => {
                  const selecionado = escolhido?.id === option.id;
                  const cartaz = MODE_BANNERS[option.id];
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => escolher(grupo.title, option)}
                      disabled={option.comingSoon}
                      accessibilityRole="button"
                      /*
                       * Mesma história dos cartazes do salão: o nome da opção está
                       * DENTRO da arte, então sem este rótulo o leitor de tela anuncia
                       * só "botão" e as opções ficam indistinguíveis.
                       */
                      accessibilityLabel={
                        option.comingSoon
                          ? `${option.label} — em breve`
                          : `${option.label}${option.hint ? ` — ${option.hint}` : ''}`
                      }
                      accessibilityState={{ selected: selecionado, disabled: option.comingSoon }}
                      style={[
                        styles.option,
                        selecionado && styles.optionSelected,
                        option.comingSoon && styles.optionDisabled,
                      ]}
                      // Todos os cartões da lista têm a mesma largura: medir um mede todos.
                      onLayout={(e) => setLarguraDoCartao(e.nativeEvent.layout.width)}
                    >
                      {/*
                        O cartaz já traz o nome da opção escrito na arte. Quando não
                        existe cartaz pra essa opção, o nome aparece em texto — assim
                        acrescentar um modo novo em gameModes.ts não quebra a tela
                        enquanto a arte dele não chega.
                      */}
                      {cartaz ? (
                        <Image source={cartaz} style={[styles.cartaz, { height: alturaDoCartaz }]} resizeMode="cover" />
                      ) : (
                        <View style={[styles.cartazVazio, { height: alturaDoCartaz }]}>
                          <Text style={styles.optionLabel}>{option.label}</Text>
                        </View>
                      )}

                      <View style={styles.rodape}>
                        <Text style={styles.optionHint}>{option.hint}</Text>
                        {option.comingSoon ? (
                          <Text style={styles.badge}>em breve</Text>
                        ) : (
                          <Ionicons
                            name={selecionado ? 'checkmark-circle' : 'chevron-forward'}
                            size={20}
                            color={selecionado ? colors.goldBright : colors.textFaint}
                          />
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Fundo>
  );
}

const styles = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: colors.background },
  veu: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11,15,13,0.55)' },
  safe: { flex: 1, paddingHorizontal: spacing.lg },
  fallback: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: fontFamily.displayBold, fontSize: fontSize.lg, color: colors.textPrimary },
  scroll: { paddingVertical: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
  group: { gap: spacing.sm },
  groupTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  option: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  optionSelected: { borderColor: colors.goldBright },
  optionDisabled: { opacity: 0.45 },
  /*
   * `height: undefined` NÃO É ENFEITE, é o que faz a proporção valer.
   *
   * Uma imagem no React Native já tem altura própria — a do arquivo. Com só
   * `aspectRatio`, a altura natural ganha e a proporção é ignorada: o cartaz de
   * 1000×500 saía 354 de largura por 500 de ALTURA, quase três vezes mais alto do que
   * devia. Era o que fazia a tela de escolha do dominó virar duas caixas pretas
   * gigantes, cada uma tomando meia tela — e como o recorte é `cover`, o que aparecia
   * era o pedaço escuro da esquerda do cartaz, sem o nome nem a mesa.
   *
   * Anulando a altura, quem decide passa a ser a largura de verdade, medida no
   * layout — e aí a proporção acompanha qualquer tela sem ninguém recalcular nada.
   */
  cartaz: { width: '100%' },
  cartazVazio: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.felt,
  },
  rodape: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  optionLabel: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.md, color: colors.textPrimary },
  badge: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textFaint,
    borderWidth: 1,
    borderColor: colors.feltLine,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
  },
  optionHint: { flex: 1, fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textSecondary },
  errorText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.danger },
});
