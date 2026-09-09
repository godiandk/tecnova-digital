import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AreaDaMesa, LARGURA_UTIL, assentoDaPilha } from '../data/mapaDosTampos';
import { usePalco } from './TampoDaMesa';
import { colors } from '../theme';

/** Uma pilha de alguém dentro da casa. Numa mesa cheia há uma por jogador. */
export interface PilhaNaCasa {
  /** Quem é o dono — usado só como chave; a cor vai no que `desenhar` devolve. */
  chave: string;
  desenhar: () => ReactNode;
}

interface CasaDeApostaProps {
  area: AreaDaMesa;
  /** Chave da casa no mapa, pra saber a largura útil dela. */
  nome: string;
  /**
   * Quanto de pano as pilhas podem ocupar, quando o tampo em uso não é o de sempre.
   *
   * A largura útil de uma casa muda com a composição: a mesma casa é larga e baixa no
   * tampo deitado e estreita e alta no de celular. Sem isto, as pilhas de mesa cheia
   * usariam a medida do tampo errado e sairiam pela borda.
   */
  larguraUtil?: number;
  /** Quanto VOCÊ já apostou aqui. Zero = você não pôs nada nesta casa. */
  valor: number;
  /** O que anunciar sobre as suas fichas daqui, pra quem usa leitor de tela. */
  descricao?: string;
  /** As pilhas de todo mundo, uma por jogador, na ordem em que sentaram. */
  pilhas?: PilhaNaCasa[];
  /** A rodada fechou: dá pra ver, não dá pra apostar. */
  travada?: boolean;
  /** Esta casa ganhou a rodada. */
  vencedora?: boolean;
  onPress?: () => void;
  children?: ReactNode;
}

/**
 * Uma área de aposta DO PANO — a área que já está desenhada na arte, agora tocável.
 *
 * Este componente é o que tira a mesa do papel de fundo de tela. E ele é INVISÍVEL: não
 * desenha borda, não pinta fundo, não escreve nada. Só existe pra receber o toque e pra
 * saber onde a ficha assenta.
 *
 * POR QUE INVISÍVEL. Um retângulo aceso em cima do feltro denuncia o programa por trás
 * do jogo: a pessoa para de ver uma mesa e passa a ver uma área clicável de aplicativo.
 * A arte já imprimiu JOGADOR, EMPATE e BANCA no pano — é ela que diz onde tocar, como
 * numa mesa de verdade, onde também não existe contorno luminoso em volta da sua
 * aposta. E o retorno de que a aposta entrou não precisa de moldura nenhuma: as fichas
 * aparecem no lugar. A ficha é a confirmação.
 *
 * O que continua existindo, porque é informação e não enfeite: o nome da casa e o valor
 * apostado, ditos em voz alta pra quem usa leitor de tela (`rotulo` e `descricao`), e a
 * luz de quem ganhou — que é luz no pano, sem contorno, do jeito que um holofote cai
 * numa mesa e não do jeito que um aplicativo desenha uma caixa.
 */
export function CasaDeAposta({
  area,
  nome,
  larguraUtil: larguraUtilDada,
  valor,
  descricao,
  pilhas,
  travada,
  vencedora,
  onPress,
  children,
}: CasaDeApostaProps) {
  const palco = usePalco();
  if (!palco) return null;

  const [esquerda, topo, direita, base] = area.caixa;
  const caixa = {
    position: 'absolute' as const,
    left: palco.esquerda + esquerda * palco.largura,
    top: palco.topo + topo * palco.altura,
    width: (direita - esquerda) * palco.largura,
    height: (base - topo) * palco.altura,
  };

  /*
   * Onde a pilha assenta. Com `alvo`, é o ponto medido no pano — a base da ficha de
   * baixo encosta ali e a pilha cresce pra cima, como pilha de verdade. A faixa tem a
   * largura da casa inteira em vez de largura zero, pro conteúdo centralizar dentro
   * dela sem transbordar pelos lados, que na web viraria corte.
   */
  const larguraUtil = larguraUtilDada ?? LARGURA_UTIL[nome] ?? 0;
  const assentar = (indice: number, quantas: number) => {
    const ponto = assentoDaPilha(area, larguraUtil, indice, quantas);
    return {
      position: 'absolute' as const,
      left: 0,
      width: caixa.width,
      bottom: (base - ponto.y) * palco.altura,
      alignItems: 'center' as const,
      transform: [{ translateX: (ponto.x - esquerda) * palco.largura - caixa.width / 2 }],
    };
  };
  const assento = area.alvo ? assentar(0, 1) : null;

  /*
   * O TOQUE SEGUE O DESENHO, quando o desenho não é retângulo.
   *
   * As casas da Banca Francesa são arcos, e a caixa envolvente de um arco invade a do
   * vizinho: a do GRANDE desce até 0,4988 no meio da mesa enquanto a do PEQUENO já
   * começa em 0,4821 nas pontas, embora os dois traços nunca se toquem. Com uma caixa
   * só, quem fosse desenhado por último ficava com o toque no cruzamento.
   *
   * Então, quando a área traz `tiras`, o toque vai numa ESCADA de retângulos finos
   * calculada a partir dos arcos medidos — e não numa caixa. A caixa continua sendo a
   * envolvente, que é o que posiciona as pilhas e a luz de vitória.
   *
   * A PRIMEIRA TIRA É QUEM FALA. Ela leva o papel, o nome e o estado pro leitor de tela;
   * as outras somem da árvore de acessibilidade. Uma casa é UMA aposta, e anunciar
   * catorze botões "Apostar no centro do Grande" tornaria a mesa injogável de ouvido —
   * que é o defeito oposto do que a escada veio consertar.
   */
  const aoTocar = travada ? undefined : onPress;
  const acessibilidade = {
    accessibilityRole: 'button' as const,
    accessibilityLabel: area.rotulo,
    accessibilityState: { selected: valor > 0, disabled: Boolean(travada) },
    accessibilityHint: valor > 0 ? `${valor.toLocaleString('pt-BR')} apostados aqui: ${descricao ?? ''}`.trim() : undefined,
  };

  const conteudo = (
    <>
      {vencedora && <LuzDeVitoria alvo={assento} largura={palco.largura} />}
      {pilhas
        ? pilhas.map((pilha, i) => (
            <View key={pilha.chave} style={assentar(i, pilhas.length)} pointerEvents="none">
              {pilha.desenhar()}
            </View>
          ))
        : null}
      <View style={assento ?? styles.rodape} pointerEvents="none">
        {children}
      </View>
    </>
  );

  if (!area.tiras) {
    return (
      <Pressable onPress={aoTocar} disabled={travada} {...acessibilidade} style={[caixa, styles.casa]}>
        {conteudo}
      </Pressable>
    );
  }

  return (
    <View style={[caixa, styles.casa]} pointerEvents="box-none">
      {area.tiras.map((tira, i) => {
        const [tiraEsquerda, tiraTopo, tiraDireita, tiraBase] = tira;
        return (
          <Pressable
            key={i}
            onPress={aoTocar}
            disabled={travada}
            {...(i === 0
              ? acessibilidade
              : { importantForAccessibility: 'no-hide-descendants' as const, accessibilityElementsHidden: true })}
            style={{
              position: 'absolute',
              left: (tiraEsquerda - esquerda) * palco.largura,
              top: (tiraTopo - topo) * palco.altura,
              width: (tiraDireita - tiraEsquerda) * palco.largura,
              height: (tiraBase - tiraTopo) * palco.altura,
            }}
          />
        );
      })}
      {conteudo}
    </View>
  );
}

/**
 * A luz que marca a casa que ganhou.
 *
 * São três elipses concêntricas, cada uma mais fraca e mais larga que a de dentro. Sem
 * biblioteca de SVG não dá pra fazer um degradê radial de verdade, e três anéis com
 * opacidade caindo chegam perto o bastante: a borda some antes de virar linha, então
 * lê como luz caindo no feltro e não como contorno de caixa.
 */
function LuzDeVitoria({ alvo, largura }: { alvo: { bottom: number } | null; largura: number }) {
  const base = alvo?.bottom ?? 0;
  /*
   * A luz cresce com a mesa. Em pixel fixo ela ficava do tamanho de um prato numa mesa
   * de 1600 e some — e o ponto dela é justamente ser vista sem ser um contorno.
   */
  const raio = Math.max(120, largura * 0.19);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.centroDaLuz, { paddingBottom: base }]}>
      {[
        { fracao: 1, opacidade: 0.07 },
        { fracao: 0.68, opacidade: 0.1 },
        { fracao: 0.42, opacidade: 0.13 },
      ].map((anel) => (
        <View
          key={anel.fracao}
          style={{
            position: 'absolute',
            width: raio * anel.fracao,
            height: raio * anel.fracao * 0.62,
            borderRadius: raio,
            backgroundColor: colors.success,
            opacity: anel.opacidade,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  /*
   * Nada de cor, nada de borda. A arte já pintou a casa; o que este componente
   * acrescenta é o toque, e toque não tem aparência.
   */
  casa: { alignItems: 'center', justifyContent: 'flex-end' },
  /* Sem `alvo` no mapa: a pilha vai pro rodapé da casa. */
  rodape: { alignItems: 'center', paddingBottom: 10 },
  centroDaLuz: { alignItems: 'center', justifyContent: 'flex-end' },
});
