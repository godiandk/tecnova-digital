import { ReactNode, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { ARCO_DA_CASA, MAPA_BANCA_EM_PE, TIGELA_DA_BANCA_EM_PE } from '../data/mapaDosTampos';
import { useJanela } from '../theme/useJanela';
import { ComPalco } from './TampoDaMesa';
import { colors, fontFamily } from '../theme';

/**
 * O FELTRO DA BANCA FRANCESA DESENHADO, pra celular em pé.
 *
 * A arte 16:9 é a fotografia de uma mesa oval. Mesa oval é larga, e num celular em pé
 * ela cabe com 390 de largura por 219 de altura: uma tira de mesa entre duas faixas
 * pretas, com o feltro ocupando um quarto da tela. Isso não se conserta com zoom nem
 * com recorte — a forma é que não serve. Então no retrato o pano é REDESENHADO em
 * faixas empilhadas, que é o que todo cassino de celular faz, e o feltro passa a ocupar
 * a tela inteira que sobra dos controles.
 *
 * DUAS COISAS QUE ESTE ARQUIVO NÃO FAZ, de propósito:
 *
 * 1. Não estica a fotografia. Uma mesa oval espremida na vertical vira uma mesa
 *    deformada, e o jogador vê isso mesmo sem saber nomear.
 * 2. Não inventa marcação que a mesa não tem. As faixas são as mesmas cinco casas, com
 *    os mesmos números impressos (14 15 16 / 5 6 7), o mesmo lugar de linha e a mesma
 *    tigela. O que muda é o arranjo, não o jogo.
 *
 * E o ganho que só o desenho dá: aqui a MARCA PINTADA E A ÁREA DE TOQUE SÃO O MESMO
 * RETÂNGULO, tirado do mesmo número em `MAPA_BANCA_EM_PE`. No tampo fotografado as duas
 * coisas são independentes — a arte veio de um lado, as frações foram medidas do outro —
 * e por isso lá elas precisam de conferência pra não se separarem com o tempo.
 *
 * As cores saíram da própria arte, medidas na imagem (mediana de RGB em amostras):
 * feltro claro #1e2819, feltro escuro #0e180c, couro da borda #352c23, couro da tigela
 * #ac8e6e, traço dourado #cc9b65. É a mesma mesa, na mesma luz.
 */

/*
 * AS CORES SÃO AS DA ARTE, medidas nela — não escolhidas.
 *
 * Varrendo os 1.026.301 pixels de feltro da arte 1920x1080 (verde escuro: g acima de r e
 * de b, sem dourado) e ordenando por luminância, o pano vai de #122718 no percentil 97
 * (a parte que pega a luz do lustre, lá em cima) a #051108 no percentil 5 (a barriga da
 * mesa, na sombra). O desenho usa essas duas pontas, na mesma ordem: claro em cima,
 * escuro embaixo.
 *
 * O couro da borda (#352c23), o couro da tigela (#ac8e6e) e o dourado do traço (#cc9b65)
 * saíram da mesma varredura, cada um na sua região.
 */
const FELTRO_CLARO = '#122718';
const FELTRO_ESCURO = '#061308';
const COURO = '#352c23';
const COURO_DA_TIGELA = '#ac8e6e';
const TRACO = '#cc9b65';

/** Acima disto o painel para de crescer: um feltro de 700 de largura num tablet em pé
 *  viraria uma mesa gigante com fichas perdidas no meio. */
const LARGURA_MAXIMA = 560;

interface Props {
  /** Quanto de tela os controles ocupam em cima e embaixo, em pixels. */
  reserva?: { topo: number; base: number };
  children?: ReactNode;
}

export function FeltroDaBancaEmPe({ reserva, children }: Props) {
  const janela = useJanela();
  const { topo: reservaTopo = 0, base: reservaBase = 0 } = reserva ?? {};

  const { palco, couro } = useMemo(() => {
    const alturaLivre = Math.max(1, janela.height - reservaTopo - reservaBase);
    const fora = Math.min(janela.width, LARGURA_MAXIMA);
    const espessuraDoCouro = Math.max(10, fora * 0.035);
    /*
     * O PALCO É O FELTRO, NÃO A MESA INTEIRA — e a diferença não é preciosismo.
     *
     * Com o couro desenhado como BORDA do mesmo retângulo, as frações do mapa (que são
     * do painel inteiro) eram aplicadas dentro da borda: tudo descia e encolhia treze
     * pontos, o brasão do pé saía cortado pela madeira e a ficha assentava mais alto do
     * que o mapa mandava. Agora o couro é uma moldura DESENHADA POR FORA, e o retângulo
     * que o mapa endereça é exatamente o pano verde.
     *
     * O feltro OCUPA O QUE SOBRA, sem proporção fixa: lá no tampo fotografado a
     * proporção é da arte e manda no tamanho; aqui o desenho é elástico, então quem
     * manda é o espaço livre. Numa tela mais alta as faixas ficam mais altas.
     */
    return {
      couro: espessuraDoCouro,
      palco: {
        largura: fora - espessuraDoCouro * 2,
        altura: Math.max(1, alturaLivre - espessuraDoCouro * 2),
        esquerda: (janela.width - fora) / 2 + espessuraDoCouro,
        topo: reservaTopo + espessuraDoCouro,
        emPe: true,
      },
    };
  }, [janela.width, janela.height, reservaTopo, reservaBase]);

  return (
    <View style={styles.salao}>
      <LinearGradient
        colors={[colors.background, '#050706', colors.background]}
        style={StyleSheet.absoluteFillObject}
      />
      {/* O couro da borda, desenhado POR FORA do pano. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: palco.esquerda - couro,
          top: palco.topo - couro,
          width: palco.largura + couro * 2,
          height: palco.altura + couro * 2,
          borderRadius: couro * 6,
          backgroundColor: COURO,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: palco.esquerda,
          top: palco.topo,
          width: palco.largura,
          height: palco.altura,
          borderRadius: couro * 4.5,
          overflow: 'hidden',
        }}
      >
        <Mesa largura={palco.largura} altura={palco.altura} />
      </View>
      <ComPalco palco={palco}>{children}</ComPalco>
    </View>
  );
}

/**
 * O desenho da mesa: feltro, tigela de couro e A MESMA MARCAÇÃO DA ARTE.
 *
 * A marcação foi lida da própria arte 16:9, isolando o dourado do feltro e olhando a
 * máscara: uma chapa dos ASES no alto e à esquerda, com o 3 em cima e o nome embaixo;
 * a palavra GRANDE sobre um arco em U com 14, 15 e 16 deitados na curva; um círculo
 * pendurado embaixo do meio do arco, que é o lugar da aposta na linha; e o mesmo par,
 * mais largo, pro PEQUENO com 5, 6 e 7. É esse vocabulário que faz a mesa ser
 * reconhecível como Banca Francesa, e não a fotografia: faixas retas empilhadas seriam
 * um formulário com nome de jogo.
 */
function Mesa({ largura, altura }: { largura: number; altura: number }) {
  const emX = (f: number) => f * largura;
  const emY = (f: number) => f * altura;
  const caixaDe = (nome: keyof typeof MAPA_BANCA_EM_PE.apostas) => {
    const [e, t, d, b] = MAPA_BANCA_EM_PE.apostas[nome].caixa;
    return { left: emX(e), top: emY(t), width: emX(d - e), height: emY(b - t) };
  };

  const traco = Math.max(1, largura * 0.004);
  const corpoDoNumero = Math.max(15, largura * 0.058);
  const corpoDoNome = Math.max(12, largura * 0.045);

  const tigela = {
    left: emX(TIGELA_DA_BANCA_EM_PE.fora.esquerda),
    top: emY(TIGELA_DA_BANCA_EM_PE.fora.topo),
    width: emX(TIGELA_DA_BANCA_EM_PE.fora.direita - TIGELA_DA_BANCA_EM_PE.fora.esquerda),
    height: emY(TIGELA_DA_BANCA_EM_PE.fora.base - TIGELA_DA_BANCA_EM_PE.fora.topo),
  };

  return (
    <View style={styles.mesa}>
      {/* O feltro pega luz em cima e escurece na barriga, como pano sob lustre. */}
      <LinearGradient colors={[FELTRO_CLARO, FELTRO_ESCURO]} style={StyleSheet.absoluteFillObject} />

      {/* A tigela de couro onde os dados caem. */}
      <View
        style={[
          styles.tigela,
          { ...tigela, borderRadius: tigela.height / 2, borderWidth: traco * 2 },
        ]}
      />

      <ChapaDosAses {...caixaDe('ases')} traco={traco} corpoDoNome={corpoDoNome} corpoDoNumero={corpoDoNumero} />

      <ArcoDaCasa
        {...caixaDe('grande')}
        traco={traco}
        nome="GRANDE"
        numeros={[14, 15, 16]}
        corpo={corpoDoNumero}
        corpoDoNome={corpoDoNome}
      />
      <CirculoDaLinha {...caixaDe('linha-grande')} traco={traco} corpo={corpoDoNome} />

      <ArcoDaCasa
        {...caixaDe('pequeno')}
        traco={traco}
        nome="PEQUENO"
        numeros={[5, 6, 7]}
        corpo={corpoDoNumero}
        corpoDoNome={corpoDoNome}
      />
      <CirculoDaLinha {...caixaDe('linha-pequeno')} traco={traco} corpo={corpoDoNome} />

      <Text style={[styles.brasao, { fontSize: corpoDoNome * 0.9, top: emY(0.925), width: largura }]}>
        CASINO INOVA
      </Text>
    </View>
  );
}

/**
 * A CHAPA DOS ASES: o número em cima, um traço, o nome embaixo.
 *
 * É assim na arte, e é assim numa mesa de verdade — a aposta de soma 3 tem plaquinha
 * própria, separada dos arcos, porque ela não é "menor" nem "maior": é uma combinação
 * só, que paga 62 por 1.
 */
function ChapaDosAses({
  left,
  top,
  width,
  height,
  traco,
  corpoDoNome,
  corpoDoNumero,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
  traco: number;
  corpoDoNome: number;
  corpoDoNumero: number;
}) {
  return (
    <View
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        borderWidth: traco,
        borderColor: TRACO,
        borderRadius: Math.min(width, height) * 0.16,
        alignItems: 'center',
        /*
         * O conteúdo mora na METADE DE CIMA: a de baixo é da ficha, que sobe a partir do
         * pé da chapa. Sem isso a pilha cobria o "3" e o nome, e a chapa virava um disco.
         */
        paddingTop: height * 0.04,
      }}
    >
      <Text style={{ fontFamily: fontFamily.displaySemiBold, color: TRACO, fontSize: corpoDoNumero * 0.78 }}>
        3
      </Text>
      <View style={{ height: traco, backgroundColor: TRACO, width: '78%', opacity: 0.8 }} />
      <Text
        style={{
          fontFamily: fontFamily.displayBold,
          color: TRACO,
          fontSize: corpoDoNome * 0.62,
          letterSpacing: 1.2,
        }}
      >
        ASES
      </Text>
    </View>
  );
}

/**
 * UM ARCO EM U com os números deitados na curva.
 *
 * SEM BIBLIOTECA DE SVG, um arco se desenha com o que existe: um círculo enorme, com
 * borda fina, dentro de uma janela que corta tudo menos a barriga de baixo dele. Dois
 * círculos concêntricos dão as duas linhas da faixa; um terceiro, no meio, é a risca que
 * atravessa os números na arte.
 *
 * O raio sai da flecha medida na arte (`FLECHA_DO_ARCO`): com meia-corda `m` e flecha
 * `f = 0,18 m`, o raio é `(m² + f²) / (2f)`. É a mesma conta de sempre — e é conta, não
 * tentativa, porque errar o raio aqui não dá "quase certo": dá uma curva que ninguém
 * reconhece.
 *
 * Cada número é girado pelo ângulo da tangente naquele ponto (`asin(dx / raio)`), que é
 * o que faz o 14 e o 16 tombarem pros lados como na mesa impressa.
 */
function ArcoDaCasa({
  left,
  top,
  width,
  height,
  traco,
  nome,
  numeros,
  corpo,
  corpoDoNome,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
  traco: number;
  nome: string;
  numeros: number[];
  corpo: number;
  corpoDoNome: number;
}) {
  const meiaCorda = width / 2;
  /*
   * A FLECHA VEM DA ALTURA DA CASA, e não da largura.
   *
   * Escrita em cima da largura, ela virava uma fração diferente da altura a cada formato
   * de tela — e as frações do mapa, que são de altura, deixavam de valer. Ancorada na
   * altura, a casa desenhada e a casa do mapa são a mesma coisa em qualquer tela.
   */
  const flecha = height * ARCO_DA_CASA.FLECHA;
  /*
   * O RAIO SAI DA FLECHA. Com meia-corda `m` e flecha `f`, o raio de um arco circular é
   * `(m² + f²) / (2f)` — conta fechada, sem tentativa. E a faixa inteira (flecha mais
   * espessura) tem que caber na altura da caixa: se não couber, o arco de dentro sai
   * pela borda de cima e o desenho vira duas curvas soltas em vez de uma faixa.
   */
  const raio = (meiaCorda * meiaCorda + flecha * flecha) / (2 * flecha);
  const espessura = Math.min(Math.max(0, height - flecha - traco * 2), height * ARCO_DA_CASA.ESPESSURA);

  const raioDeFora = raio;
  const raioDeDentro = raio - espessura;
  /*
   * A LINHA DOS NÚMEROS NÃO FICA NO MEIO DA FAIXA.
   *
   * Na arte ela corre a 62% da espessura, contada de fora pra dentro: sobra pouco acima
   * dela (só o nome da casa) e sobra MUITA faixa abaixo — que é justamente onde a ficha
   * assenta. Foi essa proporção que se perdeu quando a faixa virou um retângulo, e é por
   * isso que a ficha passou a cair em cima do 14.
   */
  const raioDosNumeros = raio - espessura * ARCO_DA_CASA.NUMEROS;

  /*
   * O centro dos arcos é o MESMO ponto, bem acima da janela: é a barriga de baixo deles
   * que aparece. A altura do centro é escolhida pra que a barriga do arco de fora encoste
   * no pé da faixa (flecha + espessura) — daí as pontas do de dentro caem exatamente na
   * borda de cima.
   */
  const centroY = flecha + espessura - raio;

  const anel = (r: number, opacidade = 1) => ({
    position: 'absolute' as const,
    left: width / 2 - r,
    top: centroY - r,
    width: r * 2,
    height: r * 2,
    borderRadius: r,
    borderWidth: traco,
    borderColor: TRACO,
    opacity: opacidade,
  });

  const naCurva = (fracao: number, r: number) => {
    const dx = (fracao - 0.5) * width;
    const y = centroY + Math.sqrt(Math.max(0, r * r - dx * dx));
    const giro = (Math.asin(Math.min(1, Math.max(-1, dx / r))) * 180) / Math.PI;
    return { dx, y, giro };
  };


  return (
    <View style={{ position: 'absolute', left, top, width, height, overflow: 'hidden' }}>
      <View style={anel(raioDeFora)} />
      <View style={anel(raioDeDentro)} />
      {/* A linha dos números é um pouco mais fraca que as bordas, como na arte. */}
      <View style={anel(raioDosNumeros, 0.8)} />

      {/*
        AS PONTAS DA FAIXA SÃO FECHADAS, como na arte: um traço reto ligando o arco de
        fora ao de dentro, tombado no ângulo da curva naquele ponto. Sem elas a faixa
        parece duas linhas soltas que alguém esqueceu de terminar.
      */}
      {[-1, 1].map((lado) => {
        /*
         * A PONTA É RADIAL: ela liga o arco de fora ao de dentro NO MESMO ÂNGULO, e não
         * na mesma vertical. Como os dois arcos são concêntricos, no mesmo ângulo eles
         * estão em x diferentes — por isso o meio do traço fica no RAIO MÉDIO, e não na
         * ponta do arco de fora. Com o traço centrado na ponta de fora ele sobrava onze
         * pontos pra fora da curva e lia como um risco solto ao lado da faixa.
         */
        const seno = Math.min(1, meiaCorda / raio);
        const cosseno = Math.sqrt(Math.max(0, 1 - seno * seno));
        const raioMedio = raio - espessura / 2;
        const anguloEmGraus = (Math.asin(seno) * 180) / Math.PI;
        return (
          <View
            key={lado}
            style={{
              position: 'absolute',
              left: width / 2 + lado * raioMedio * seno - traco / 2,
              top: centroY + raioMedio * cosseno - espessura / 2,
              width: traco,
              height: espessura,
              backgroundColor: TRACO,
              transform: [{ rotate: `${(lado * anguloEmGraus).toFixed(1)}deg` }],
            }}
          />
        );
      })}

      {/*
        O NOME DA CASA FICA ACIMA DO ARCO, como na arte — não dentro dele.
        Dentro, ele disputava altura com o 14 e o 16, que sobem junto com a curva e
        acabam no alto da faixa; o resultado era GRANDE escrito no meio dos algarismos.
        A barriga do arco de cima desce `flecha`, então o espaço acima dela é justamente
        o lugar do nome, e ele cabe ali por construção.
      */}
      <Text
        style={[
          styles.nomeDaCasa,
          { fontSize: corpoDoNome, left: 0, width, top: Math.max(0, flecha - corpoDoNome * 1.25) },
        ]}
      >
        {nome}
      </Text>

      {numeros.map((n, i) => {
        const ponto = naCurva((i + 0.5) / numeros.length, raioDosNumeros);
        return (
          <Text
            key={n}
            style={[
              styles.numero,
              {
                fontSize: corpo,
                left: width / 2 + ponto.dx - corpo,
                top: ponto.y - corpo * 0.66,
                width: corpo * 2,
                transform: [{ rotate: `${ponto.giro.toFixed(1)}deg` }],
              },
            ]}
          >
            {n}
          </Text>
        );
      })}
    </View>
  );
}

/**
 * O CÍRCULO DA LINHA, pendurado embaixo do meio do arco.
 *
 * Na arte ele encosta na borda de baixo da faixa, e é ali que a ficha da linha vai — a
 * cavalo entre o arco e o círculo. O "metade" fica escrito ao lado porque é a única
 * regra da mesa que não dá pra deduzir olhando, e uma aposta que rende metade sem avisar
 * é a mesa enganando.
 */
function CirculoDaLinha({
  left,
  top,
  width,
  height,
  traco,
  corpo,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
  traco: number;
  corpo: number;
}) {
  const lado = Math.min(width, height) * 0.86;
  return (
    <View style={{ position: 'absolute', left, top, width, height, alignItems: 'center' }}>
      <View
        style={{
          width: lado,
          height: lado,
          borderRadius: lado / 2,
          borderWidth: traco,
          borderColor: TRACO,
        }}
      />
      <Text style={[styles.linha, { fontSize: corpo * 0.5 }]}>METADE</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  salao: { flex: 1, backgroundColor: colors.background },
  mesa: { flex: 1 },
  tigela: {
    position: 'absolute',
    backgroundColor: COURO_DA_TIGELA,
    borderColor: TRACO,
  },
  nomeDaCasa: {
    position: 'absolute',
    fontFamily: fontFamily.displayBold,
    color: TRACO,
    letterSpacing: 3,
    textAlign: 'center',
  },
  numero: {
    position: 'absolute',
    fontFamily: fontFamily.displaySemiBold,
    color: TRACO,
    textAlign: 'center',
  },
  linha: {
    position: 'absolute',
    bottom: 0,
    fontFamily: fontFamily.bodySemiBold,
    color: TRACO,
    letterSpacing: 1.4,
    opacity: 0.7,
  },
  brasao: {
    position: 'absolute',
    fontFamily: fontFamily.displayExtraBold,
    color: TRACO,
    opacity: 0.3,
    letterSpacing: 4,
    textAlign: 'center',
  },
});
