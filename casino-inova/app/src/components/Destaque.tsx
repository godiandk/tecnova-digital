import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { Game } from '../data/games';
import { GAME_POSTERS } from '../data/lobbyAssets';
import { FIGURA_DO_DESTAQUE } from '../data/dealerImages';
import { TABLE_IMAGES } from '../data/tableImages';
import { Entrada, Pressionavel } from '../animation';
import { Brilho } from '../animation/Brilho';
import { colors, fontFamily, fontSize, radius, spacing } from '../theme';

interface DestaqueProps {
  game: Game;
  largura: number;
  onPress: () => void;
}

/**
 * Proporção do herói.
 *
 * Baixa de propósito: a arte de fundo é a foto da mesa, que foi feita em formato de
 * celular em pé. Recortada larga demais ela vira um campo de feltro vazio. Numa faixa
 * dessa altura o recorte pega a mesa, e não o vão em volta dela.
 */
const PROPORCAO = 0.32;

/**
 * A mesa em destaque — o "herói" da tela principal.
 *
 * Existe pelo item 3 do docs/design-atencao-visual.md: dez cartazes do mesmo tamanho
 * fazem o olho não escolher nenhum. Salão de cassino tem a mesa grande no meio e as
 * outras em volta, e é isso que essa peça reproduz.
 *
 * A arte é a FOTO DA MESA (as mesmas de dentro do jogo), recortada larga — o cartaz
 * vertical entra pequeno na lateral, servindo de assinatura. Assim o herói mostra o
 * ambiente do jogo, que é o que convence, e não só o nome de novo.
 */
export function Destaque({ game, largura, onPress }: DestaqueProps) {
  const altura = Math.round(largura * PROPORCAO);
  const mesa = TABLE_IMAGES[game.id];
  /*
   * A figura da direita: o crupiê ou a anfitriã do jogo quando existe, senão o cartaz.
   * Rosto vale mais que arte de cartaz aqui — é o que faz o herói parecer a entrada de
   * um salão e não um banner de loja.
   */
  const figura = FIGURA_DO_DESTAQUE[game.id];
  const cartaz = GAME_POSTERS[game.id];
  /*
   * Largura e altura em pixel, calculadas aqui: as fotos de crupiê são 3:4 em pé, e na
   * web o Image volta pro tamanho natural do arquivo quando a altura sai de `aspectRatio`
   * em vez de vir escrita. Com número na mão o recorte é o mesmo em todo lugar.
   */
  const larguraDaFigura = Math.round(altura * 1.55);

  return (
    <Entrada indice={0}>
      <Pressionavel onPress={onPress}>
        <View style={[styles.moldura, { width: largura, height: altura }]}>
          {mesa && <Image source={mesa} style={styles.foto} resizeMode="cover" />}

          {/*
            Dois véus: um geral, que rebaixa a foto a textura de fundo, e um da esquerda
            pra direita, que dá ao texto onde pousar sem precisar de caixa cinza atrás.
          */}
          <View style={styles.veu} />
          <LinearGradient
            colors={['rgba(11,15,13,0.95)', 'rgba(11,15,13,0.60)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />

          {figura ? (
            <View style={[styles.figuraArea, { width: larguraDaFigura }]}>
              <Image
                source={figura}
                style={[styles.figura, { width: larguraDaFigura, height: (larguraDaFigura * 4) / 3 }]}
                resizeMode="cover"
              />
              {/* Desmancha a borda esquerda da foto no fundo, pra não virar retângulo colado. */}
              <LinearGradient
                colors={['rgba(11,15,13,1)', 'rgba(11,15,13,0.35)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.75, y: 0 }}
                style={StyleSheet.absoluteFillObject}
              />
            </View>
          ) : (
            cartaz && (
              <Image source={cartaz} style={[styles.cartaz, { height: altura * 0.86, width: altura * 0.57 }]} resizeMode="contain" />
            )
          )}

          {/*
            O texto para onde a figura começa a aparecer. Sem esse limite, no celular a
            linha "Mesa com gente · aberta agora" corria por baixo do crupiê e sumia.
            O fator 0.72 aproveita a parte da figura que já está desmanchada no fundo.
          */}
          <View style={[styles.conteudo, { maxWidth: largura - larguraDaFigura * 0.72 }]}>
            <View style={styles.etiqueta}>
              <Ionicons name="star" size={11} color={colors.goldBright} />
              <Text style={styles.etiquetaTexto}>MESA EM DESTAQUE</Text>
            </View>
            <Text style={styles.nome} numberOfLines={1}>{game.name}</Text>
            <Text style={styles.formato}>
              {game.format === 'vs-casa' ? 'Contra a casa · aberta agora' : 'Mesa com gente · aberta agora'}
            </Text>
            <View style={styles.botao}>
              <Text style={styles.botaoTexto}>Entrar na mesa</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.background} />
            </View>
          </View>


          <Brilho largura={largura} intervalo={7} />
        </View>
      </Pressionavel>
    </Entrada>
  );
}

const styles = StyleSheet.create({
  moldura: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: 'rgba(229,181,103,0.45)',
    justifyContent: 'center',
  },
  foto: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  veu: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11,15,13,0.42)' },
  conteudo: { paddingLeft: spacing.xl, gap: 4 },
  etiqueta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  etiquetaTexto: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: colors.goldBright,
  },
  nome: { fontFamily: fontFamily.displayExtraBold, fontSize: fontSize.xl, color: colors.textPrimary },
  formato: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textSecondary },
  botao: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
  },
  botaoTexto: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, color: colors.background },
  cartaz: { position: 'absolute', right: spacing.lg, borderRadius: radius.md },
  figuraArea: { position: 'absolute', right: 0, top: 0, bottom: 0, overflow: 'hidden' },
  /*
   * A foto do crupiê é 3:4 em pé, e a faixa do herói é deitada. Ancorando no topo e
   * deixando a altura crescer pela proporção, o que fica no quadro é a cabeça e o
   * tronco — `cover` puro pegaria a faixa do meio e cortaria o rosto fora.
   */
  figura: { position: 'absolute', top: 0, left: 0, right: 0, aspectRatio: 3 / 4 },
});
