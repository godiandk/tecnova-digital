import { Image, StyleSheet, Text, View } from 'react-native';

import { BigRoadCell, DerivedMark, RoadOutcome, Roadmap } from '../api/roadmap';
import { MARCADORES_DO_PLACAR, ROADMAP_IMAGES } from '../data/gameAssets';
import { colors, fontFamily } from '../theme';

/**
 * O PLACAR DE HISTÓRICO — as cinco estradas de uma mesa de bacará, bac bo ou banca
 * francesa, desenhadas na moldura de placar que veio com a arte.
 *
 * Cada peça aqui é imagem, não forma de código: as contas de vidro, os anéis vazados,
 * os riscos, os quadrados e os triângulos são os dezesseis marcadores de
 * `placar/marcadores/`, e as molduras são `placar-painel-grande`, `placar-painel-pequeno`
 * e `placar-legenda`. Uma versão anterior desenhava tudo com View e borda arredondada e
 * deixava esses arquivos parados na pasta — o resultado era um círculo chapado de CSS
 * ao lado de uma moldura dourada com brasão, duas mesas diferentes na mesma tela.
 *
 * AS GRADES SÃO MEDIDAS NA PRÓPRIA MOLDURA, não inventadas. As linhas da grade estão
 * desenhadas na arte, e os marcadores têm que cair EM CIMA delas, senão o placar fica
 * torto de um jeito que ninguém consegue apontar mas todo mundo vê. Ver GRADE_GRANDE e
 * GRADE_PEQUENA abaixo, onde estão as medições.
 *
 * E O QUE ELE NÃO É: um sinal. O placar mostra o que já saiu; cada rodada é sorteada do
 * zero e o passado não muda a chance da próxima. Ele existe porque faz parte da mesa e
 * porque quem joga quer ver — nunca como ferramenta de previsão. Por isso não há aqui
 * nenhuma seta, nenhuma "tendência quente", nenhuma sugestão de aposta.
 */

/** Como esta mesa chama cada lado. A marca é a mesma; a palavra é da casa. */
export interface VocabularioDoPlacar {
  banca: string;
  jogador: string;
  empate: string;
}

const VOCABULARIO_PADRAO: VocabularioDoPlacar = { banca: 'Banca', jogador: 'Jogador', empate: 'Empate' };

/**
 * A grade do painel grande (1024x512), medida na imagem.
 *
 * As linhas verticais estão de 41 em 41 pixels, de x=101 a x=923 — 21 linhas, 20
 * colunas. As horizontais estão de 43 em 43, de y=116 a y=375 — 7 linhas, 6 fileiras,
 * que é exatamente o que uma estrada de bacará usa.
 */
const GRADE_GRANDE = {
  colunas: 20,
  fileiras: 6,
  esquerda: 101 / 1024,
  topo: 116 / 512,
  celulaX: 41 / 1024,
  celulaY: 43.17 / 512,
};

/** A grade do painel pequeno (512x256): 10 colunas por 6 fileiras. */
const GRADE_PEQUENA = {
  colunas: 10,
  fileiras: 6,
  esquerda: 65 / 512,
  topo: 30 / 256,
  celulaX: 38.2 / 512,
  celulaY: 32.4 / 256,
};

/** As duas molduras são 2:1 — a altura sai da largura, sem chute. */
const PROPORCAO_DO_PAINEL = 2;

/**
 * Onde a moldura realmente COMEÇA e ACABA dentro do arquivo.
 *
 * Os três PNGs têm margem transparente em cima e embaixo, e ela é grande: a legenda só
 * ocupa 32% da altura do arquivo, o painel grande 67%, o pequeno 91%. Desenhar a imagem
 * inteira e deixar o layout medir o arquivo põe esse vazio entre as seções como se
 * fosse espaçamento — foi o que abriu o buraco entre a legenda e o primeiro painel.
 *
 * Medido pelo canal alfa de cada arquivo.
 */
const OPACO = {
  legenda: { topo: 41 / 128, base: 82 / 128 },
  grande: { topo: 67 / 512, base: 412 / 512 },
  pequeno: { topo: 10 / 256, base: 243 / 256 },
};

/**
 * As quatro caixas de valor da moldura da legenda (512x128), medidas nela.
 *
 * São as caixas ESCURAS dentro de cada plaqueta, isoladas por alfa e brilho: x 72..122,
 * 195..245, 318..368 e 441..491, todas em y 52..71. Guardo a caixa inteira, não só o
 * centro: com a caixa dá pra pôr o número exatamente dentro dela, centrado nos dois
 * eixos. Com só o centro, a conta da vertical vira estimativa a partir do corpo da
 * letra — foi assim que os números saíram desalinhados.
 */
const CAIXAS_DA_LEGENDA = [72, 195, 318, 441].map((x) => x / 512);
const LARGURA_DA_CAIXA = 50 / 512;
const TOPO_DA_CAIXA = 52 / 128;
const ALTURA_DA_CAIXA = 20 / 128;

type Marcador = keyof typeof MARCADORES_DO_PLACAR;

interface Peca {
  coluna: number;
  fileira: number;
  marcador: Marcador;
  /** Desenhado por cima — o risco verde do empate, o anel de "esta foi a última". */
  porCima?: Marcador;
}

/** Um painel com a grade preenchida. A moldura é a arte; as peças caem nas casas. */
function Painel({
  largura,
  grande,
  pecas,
  rotulo,
}: {
  largura: number;
  grande: boolean;
  pecas: Peca[];
  rotulo: string;
}) {
  const altura = largura / PROPORCAO_DO_PAINEL;
  const opaco = grande ? OPACO.grande : OPACO.pequeno;
  // A caixa que o layout mede é só a parte visível; o resto do arquivo é transparente.
  const deslocamento = opaco.topo * altura;
  const alturaVisivel = (opaco.base - opaco.topo) * altura;
  const grade = grande ? GRADE_GRANDE : GRADE_PEQUENA;
  const ladoX = grade.celulaX * largura;
  const ladoY = grade.celulaY * altura;
  // A conta ocupa a casa quase inteira; a folga é o que deixa a linha da grade aparecer.
  const lado = Math.min(ladoX, ladoY) * 0.94;

  // Só cabe o que a grade tem: mostro as últimas colunas, como um placar de mesa faz.
  const ultima = pecas.reduce((maior, p) => Math.max(maior, p.coluna), 0);
  const desloca = Math.max(0, ultima - grade.colunas + 1);

  return (
    <View
      style={{ width: largura, height: alturaVisivel, overflow: 'visible' }}
      accessibilityLabel={rotulo}
      accessible
    >
      <Image
        source={grande ? ROADMAP_IMAGES.painelGrande : ROADMAP_IMAGES.painelPequeno}
        style={{ position: 'absolute', top: -deslocamento, width: largura, height: altura }}
        resizeMode="stretch"
      />
      {pecas.map((peca, i) => {
        const coluna = peca.coluna - desloca;
        if (coluna < 0 || coluna >= grade.colunas || peca.fileira >= grade.fileiras) return null;
        const esquerda = grade.esquerda * largura + (coluna + 0.5) * ladoX - lado / 2;
        const topo = grade.topo * altura + (peca.fileira + 0.5) * ladoY - lado / 2 - deslocamento;
        return (
          <View key={i} pointerEvents="none" style={{ position: 'absolute', left: esquerda, top: topo }}>
            <Image source={MARCADORES_DO_PLACAR[peca.marcador]} style={{ width: lado, height: lado }} resizeMode="contain" />
            {peca.porCima && (
              <Image
                source={MARCADORES_DO_PLACAR[peca.porCima]}
                style={{ position: 'absolute', width: lado, height: lado }}
                resizeMode="contain"
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

/** A legenda: a moldura é arte, os quatro números entram nas caixas medidas nela. */
function Legenda({ largura, totais, palavras }: { largura: number; totais: Roadmap['totals']; palavras: VocabularioDoPlacar }) {
  const altura = largura * (128 / 512);
  const deslocamento = OPACO.legenda.topo * altura;
  const alturaVisivel = (OPACO.legenda.base - OPACO.legenda.topo) * altura;
  const valores = [totais.banca, totais.jogador, totais.empate, totais.total];
  const nomes = [palavras.banca, palavras.jogador, palavras.empate, 'Total'];
  return (
    <View style={{ width: largura, height: alturaVisivel, overflow: 'visible' }}>
      <Image
        source={ROADMAP_IMAGES.legenda}
        style={{ position: 'absolute', top: -deslocamento, width: largura, height: altura }}
        resizeMode="stretch"
      />
      {valores.map((valor, i) => {
        const alturaDaCaixa = ALTURA_DA_CAIXA * altura;
        return (
          <Text
            key={i}
            numberOfLines={1}
            accessibilityLabel={`${nomes[i]}: ${valor}`}
            style={[
              styles.numeroDaLegenda,
              {
                left: CAIXAS_DA_LEGENDA[i] * largura,
                top: TOPO_DA_CAIXA * altura - deslocamento,
                width: LARGURA_DA_CAIXA * largura,
                height: alturaDaCaixa,
                // lineHeight igual à altura da caixa centra na vertical sem estimativa.
                lineHeight: alturaDaCaixa,
                fontSize: Math.max(10, alturaDaCaixa * 0.82),
              },
            ]}
          >
            {valor}
          </Text>
        );
      })}
    </View>
  );
}

const CONTA: Record<RoadOutcome, Marcador> = { banca: 'banca', jogador: 'jogador', empate: 'empate' };
const VAZADO = { banca: 'bancaVazado', jogador: 'jogadorVazado' } as const;

export function RoadmapPanel({
  roadmap,
  vocabulario,
  largura = 320,
}: {
  roadmap: Roadmap;
  vocabulario?: VocabularioDoPlacar;
  largura?: number;
}) {
  const palavras = vocabulario ?? VOCABULARIO_PADRAO;

  /* Bead plate: uma conta por rodada, na ordem, seis por coluna. O par vira a conta
     com o pontinho, que é o marcador que a arte já traz pronto. */
  const contas: Peca[] = [];
  roadmap.beadPlate.forEach((coluna, c) =>
    coluna.forEach((celula, f) => {
      const comPar = celula.outcome === 'banca' ? celula.bankerPair : celula.outcome === 'jogador' ? celula.playerPair : false;
      contas.push({
        coluna: c,
        fileira: f,
        marcador: comPar ? (celula.outcome === 'banca' ? 'bancaPar' : 'jogadorPar') : CONTA[celula.outcome],
      });
    }),
  );

  /* Big road: anéis vazados, e o empate vira o risco verde por cima da conta anterior
     — que é como uma mesa marca "houve empate aqui" sem abrir casa nova. */
  const estrada: Peca[] = roadmap.bigRoadLayout.map(({ column, row, cell }: { column: number; row: number; cell: BigRoadCell }) => ({
    coluna: column,
    fileira: row,
    marcador: VAZADO[cell.outcome],
    porCima: cell.ties > 0 ? ('riscoVerde' as Marcador) : undefined,
  }));

  const derivada = (colunas: DerivedMark[][], vermelho: Marcador, azul: Marcador): Peca[] =>
    colunas.flatMap((coluna, c) =>
      coluna.map((marca, f) => ({ coluna: c, fileira: f, marcador: marca === 'vermelho' ? vermelho : azul })),
    );

  /*
   * Tudo mede a mesma coluna de `largura`, e é ela que dá a estrutura: legenda, painéis
   * e rótulos começam e terminam alinhados, e o vão entre as seções é sempre o mesmo.
   * Antes cada peça escolhia o próprio tamanho e alinhamento — os rótulos encostados na
   * esquerda da folha, os painéis centrados no meio dela, e os três pequenos como
   * miniaturas soltas embaixo.
   */
  const VAO_PEQUENO = 6;
  const larguraPequena = (largura - VAO_PEQUENO * 2) / 3;

  return (
    <View style={[styles.placar, { width: largura }]}>
      <Legenda largura={largura} totais={roadmap.totals} palavras={palavras} />

      <View style={styles.secao}>
        <Text style={styles.titulo}>Rodada a rodada</Text>
        <Painel largura={largura} grande pecas={contas} rotulo="Histórico rodada a rodada" />
      </View>

      <View style={styles.secao}>
        <Text style={styles.titulo}>Estrada principal</Text>
        <Painel largura={largura} grande pecas={estrada} rotulo="Estrada principal" />
      </View>

      <View style={styles.secao}>
        <Text style={styles.titulo}>Tendência · vermelho repete, azul pica</Text>
        <View style={[styles.tresPequenos, { gap: VAO_PEQUENO }]}>
          <Painel largura={larguraPequena} grande={false} pecas={derivada(roadmap.bigEyeBoy, 'quadradoVermelho', 'quadradoAzul')} rotulo="Olho grande" />
          <Painel largura={larguraPequena} grande={false} pecas={derivada(roadmap.smallRoad, 'riscoVermelho', 'riscoAzul')} rotulo="Estrada pequena" />
          <Painel largura={larguraPequena} grande={false} pecas={derivada(roadmap.cockroachPig, 'trianguloCima', 'trianguloBaixo')} rotulo="Barata" />
        </View>
      </View>

      <Text style={styles.aviso}>
        O placar mostra o que já saiu. Cada rodada é sorteada do zero — o histórico não muda a chance da próxima.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  /* A coluna é a estrutura: tudo dentro dela tem a mesma largura e o mesmo começo. */
  placar: { gap: 14, alignSelf: 'center' },
  secao: { gap: 5 },
  titulo: { fontFamily: fontFamily.body, fontSize: 11, color: colors.textFaint },
  tresPequenos: { flexDirection: 'row' },
  numeroDaLegenda: {
    position: 'absolute',
    textAlign: 'center',
    fontFamily: fontFamily.displayBold,
    color: colors.goldBright,
  },
  aviso: { fontFamily: fontFamily.body, fontSize: 11, color: colors.textFaint, lineHeight: 16, marginTop: 4 },
});
