import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { PlayerColor } from '../data/chipImages';
import { Ficha } from './Ficha';
import { colors } from '../theme';

/**
 * O trilho de fichas — a fileira na frente do jogador, de onde ele pega uma pra encostar
 * no pano.
 *
 * Isto é o que substituiu o "POR CASA: 100" com − e +, que é um controle de formulário e
 * não tem nada a ver com apostar numa mesa. Numa mesa você não digita um número: escolhe
 * uma ficha e a encosta onde quer. Tocar de novo empilha outra.
 *
 * As fichas do trilho são as SUAS: saem todas na sua cor, e o que muda de uma pra outra é
 * o valor na chapa. Ver a própria cor aqui embaixo e depois no pano é o que fecha o
 * gesto — a ficha que você pegou é a ficha que está lá.
 */
interface TrilhoDeFichasProps {
  selecionada: number;
  onSelecionar: (valor: number) => void;
  /** A cor de quem está jogando. Vem do servidor quando a mesa é compartilhada. */
  cor: PlayerColor | undefined;
  /** Diâmetro da ficha. Quem chama mede pela mesa; ver TAMANHO_DA_FICHA_NO_TRILHO. */
  tamanho?: number;
  /** Ficha acima do saldo fica apagada: não dá pra pegar o que não se tem. */
  saldo: number;
  /** Rodada em andamento: dá pra ver, não dá pra pegar. */
  travado?: boolean;
  /** Só as denominações que fazem sentido pros limites da mesa. */
  /** As fichas deste degrau, calculadas pelo servidor. É a lista de verdade. */
  fichas?: number[];
  minimo?: number;
}

export function TrilhoDeFichas({
  selecionada,
  onSelecionar,
  cor,
  tamanho = 56,
  saldo,
  travado,
  fichas,
  minimo = 50,
}: TrilhoDeFichasProps) {
  /*
   * AS FICHAS VÊM DA MESA, prontas. O servidor calcula as cinco do degrau em que a
   * pessoa está — a menor É a aposta mínima, a maior É o teto — e este componente só
   * desenha. Filtrar uma lista fixa por mínimo e máximo era o que fazia o trilho parar
   * em cem milhões pra quem tinha noventa e nove bilhões: a lista acabava antes.
   *
   * O `cabem` de reserva existe só pro instante em que a resposta do servidor ainda não
   * chegou, e é a mesma conta que o servidor faz.
   */
  const cabem = (fichas?.length ? fichas : [1, 2, 5, 10, 20].map((m) => minimo * m))
    .filter((v) => v > 0)
    .map((valor) => ({ valor }));

  /*
   * O TRILHO ROLA, COM SETAS NAS PONTAS.
   *
   * Antes ele era uma fileira fixa e as fichas das pontas saíam CORTADAS pela borda da
   * tela — dava pra ver meia ficha de 25k e meia de 50k, sem jeito de alcançar as
   * maiores. Numa mesa Safira, que aposta de 5 a 100 milhões, isso escondia justamente
   * as fichas que servem.
   *
   * A rolagem horizontal resolve o corte, e as setas resolvem o que a rolagem sozinha
   * não resolve: numa mesa de cassino ninguém "desliza" um trilho, e sem seta nenhuma
   * quem olha não sabe que existe mais ficha do lado de fora. A seta é a única parte da
   * interface que precisa dizer isso.
   */
  const rolagem = useRef<ScrollView>(null);
  const [larguraVisivel, setLarguraVisivel] = useState(0);
  const [posicao, setPosicao] = useState(0);

  /*
   * A LARGURA DO TRILHO É CALCULADA, e não medida.
   *
   * Medir criava um laço que se mordia: a centralização é padding, o padding entra na
   * largura do conteúdo, a largura do conteúdo decide o padding. Na primeira passada as
   * fichas sobravam e ganhavam folga; na segunda a folga tinha feito o conteúdo caber
   * exato, então a folga virava zero; na terceira sobrava de novo. Onde ele parava
   * dependia de qual passada ganhava — e era por isso que o mesmo trilho aparecia
   * centrado numa tela e grudado na esquerda em outra.
   *
   * Não precisa medir: sabemos quantas fichas são, o diâmetro de cada uma e o vão entre
   * elas. A conta é exata e não depende de nada que ela mesma produza.
   */
  const vao = tamanho * 0.16;
  const respiro = tamanho * 0.2;
  const larguraTotal =
    cabem.length * tamanho + Math.max(0, cabem.length - 1) * vao + respiro * 2;

  const passo = (tamanho + tamanho * 0.16) * 3;
  /*
   * A seta só aparece quando sobra MEIA FICHA de conteúdo escondido.
   *
   * Com tolerância de poucos pixels, ela aparecia quando faltavam três ou quatro pixels
   * de respiro — uma seta que, tocada, não revelava ficha nenhuma. Meia ficha é o mínimo
   * pra a seta prometer alguma coisa que existe.
   */
  const folgaMinima = tamanho / 2;
  const temMaisAEsquerda = posicao > folgaMinima;
  const temMaisADireita = posicao + larguraVisivel < larguraTotal - folgaMinima;

  /*
   * A CENTRALIZAÇÃO É PADDING, e não `flexGrow`.
   *
   * Com `flexGrow: 1` no conteúdo, ele estica pra preencher o visível — e aí a largura
   * do conteúdo passa a ser SEMPRE igual à visível. O laço se fecha: nunca "não cabe",
   * as setas nunca aparecem, e as fichas das pontas continuam cortadas. Foi o que
   * aconteceu na primeira versão.
   *
   * Com padding, a medida do conteúdo continua sendo a natural, a comparação continua
   * valendo, e o trilho fica centrado do mesmo jeito quando sobra espaço.
   */
  const folgaLateral = Math.max(0, larguraVisivel - larguraTotal) / 2;

  const deslizar = (direcao: 1 | -1) => {
    const alvo = Math.max(0, Math.min(larguraTotal - larguraVisivel, posicao + direcao * passo));
    rolagem.current?.scrollTo({ x: alvo, animated: true });
  };

  return (
    <View style={styles.moldura}>
      <SetaDoTrilho
        lado="esquerda"
        visivel={temMaisAEsquerda}
        tamanho={tamanho}
        onPress={() => deslizar(-1)}
      />

      <ScrollView
        ref={rolagem}
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={(e) => setLarguraVisivel(e.nativeEvent.layout.width)}
        onScroll={(e) => setPosicao(e.nativeEvent.contentOffset.x)}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.trilho,
          { gap: vao, paddingHorizontal: respiro + folgaLateral },
        ]}
        accessibilityRole="radiogroup"
        accessibilityLabel="Fichas"
      >
      {cabem.map((ficha) => {
        const semSaldo = ficha.valor > saldo;
        const escolhida = ficha.valor === selecionada;
        return (
          <Pressable
            key={ficha.valor}
            onPress={() => onSelecionar(ficha.valor)}
            disabled={travado || semSaldo}
            accessibilityRole="radio"
            accessibilityState={{ selected: escolhida, disabled: travado || semSaldo }}
            accessibilityLabel={`Ficha de ${ficha.valor}${semSaldo ? ', saldo insuficiente' : ''}`}
            style={[
              styles.ficha,
              { borderRadius: tamanho, marginVertical: tamanho * 0.14 },
              // A ficha escolhida sobe, como quem a separou do trilho pra jogar.
              escolhida && { transform: [{ translateY: -tamanho * 0.14 }, { scale: 1.1 }] },
              escolhida && styles.escolhida,
              (travado || semSaldo) && styles.apagada,
            ]}
          >
            <Ficha valor={ficha.valor} cor={cor} tamanho={tamanho} />
          </Pressable>
        );
      })}
      </ScrollView>

      <SetaDoTrilho
        lado="direita"
        visivel={temMaisADireita}
        tamanho={tamanho}
        onPress={() => deslizar(1)}
      />
    </View>
  );
}

/**
 * A seta que leva pras fichas de fora da tela.
 *
 * Fica POR CIMA do trilho, na ponta, e some quando não há mais nada daquele lado — uma
 * seta que não leva a lugar nenhum ensina errado. O fundo escuro por baixo dela é o que
 * separa a seta da ficha que passa embaixo; sem ele, seta dourada sobre ficha dourada
 * some.
 */
function SetaDoTrilho({
  lado,
  visivel,
  tamanho,
  onPress,
}: {
  lado: 'esquerda' | 'direita';
  visivel: boolean;
  tamanho: number;
  onPress: () => void;
}) {
  if (!visivel) return <View style={{ width: tamanho * 0.52 }} />;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={lado === 'esquerda' ? 'Ver as fichas menores' : 'Ver as fichas maiores'}
      hitSlop={10}
      style={[styles.seta, { width: tamanho * 0.52, height: tamanho * 0.52, borderRadius: tamanho * 0.26 }]}
    >
      <Ionicons
        name={lado === 'esquerda' ? 'chevron-back' : 'chevron-forward'}
        size={Math.round(tamanho * 0.34)}
        color={colors.goldBright}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /*
   * `minWidth: 0` NÃO É DETALHE: sem ele o trilho transborda a tela em vez de rolar.
   *
   * No flexbox, um filho com `flex: 1` não encolhe abaixo do próprio conteúdo — o
   * padrão é `min-width: auto`. Então a fileira de fichas empurrava a caixa pra além da
   * borda, as fichas das pontas saíam cortadas pela tela, e a rolagem nunca era acionada
   * porque, do ponto de vista da caixa, tudo cabia dentro dela. Medido: em 320px de
   * largura, duas fichas ficavam metade fora e nenhuma seta aparecia.
   */
  moldura: { flexDirection: 'row', alignItems: 'center', flex: 3, minWidth: 0 },
  seta: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,15,13,0.82)',
    borderWidth: 1,
    borderColor: colors.gold,
  },
  trilho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  ficha: { borderWidth: 2, borderColor: 'transparent' },
  escolhida: { borderColor: colors.goldBright },
  apagada: { opacity: 0.35 },
});
