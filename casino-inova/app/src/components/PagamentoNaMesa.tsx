import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Ficha } from './Ficha';
import { CURVA, TEMPO } from '../animation';

/**
 * O PAGAMENTO ACONTECE NA MESA — as fichas viajam do lugar onde a aposta estava até o
 * saldo, no topo.
 *
 * O QUE ISTO VEIO SUBSTITUIR: uma frase. "Banca venceu — +9.750 fichas", em texto, embaixo
 * do pano. O jogador ganhava e a tela CONTAVA pra ele, como um extrato conta. Num jogo,
 * pagar é um acontecimento com lugar e direção: o crupiê empurra as fichas da casa
 * vencedora até quem ganhou. É isso que o olho procura, e era isso que não existia.
 *
 * A REGRA QUE NÃO SE QUEBRA AQUI, e vale repetir porque esta é justamente a camada onde
 * seria fácil quebrá-la: **a animação conta o que JÁ aconteceu**. O servidor decidiu a
 * rodada, creditou o ledger e devolveu o saldo novo antes de qualquer ficha se mexer. Se
 * o aparelho travar no meio do voo, o dinheiro está lá do mesmo jeito. Nada aqui decide,
 * sorteia, arredonda ou "quase" paga.
 *
 * O VOO NÃO É RETO. Uma ficha empurrada na mesa sobe um pouco, cruza o feltro e assenta —
 * reta é como um arquivo é copiado, não como uma ficha anda. A curva sai de um desvio
 * lateral no meio do caminho, diferente por ficha, pra as cinco não parecerem um trem.
 */
/**
 * O tamanho da ficha em voo.
 *
 * Maior que a da pilha (30) de propósito: a pilha fica parada e é lida com calma, a ficha
 * em voo passa em um segundo e precisa ser reconhecida de relance. O retrato do voo, com
 * ela em 28, mostrava uma moeda pequena demais pra se ler o valor gravado.
 */
const TAMANHO_DA_FICHA = 38;

export interface Pagamento {
  /** Quanto foi pago. Zero ou negativo não voa nada — perder não tem animação de prêmio. */
  valor: number;
  /** Um número que muda a cada rodada paga. É ele que dispara o voo. */
  rodada: number;
}

export function PagamentoNaMesa({
  pagamento,
  deOndeSai,
}: {
  pagamento: Pagamento | null;
  /**
   * De onde as fichas partem, em fração da área (0 a 1). O padrão é o meio da mesa; quem
   * souber onde está a casa vencedora passa a posição dela.
   */
  deOndeSai?: { x: number; y: number };
}) {
  const [voando, setVoando] = useState<Pagamento | null>(null);

  useEffect(() => {
    if (!pagamento || pagamento.valor <= 0) return;
    setVoando(pagamento);
  }, [pagamento?.rodada]);

  if (!voando) return null;

  /*
   * QUANTAS FICHAS VOAM não é a quantidade paga — é o TAMANHO do prêmio, em passos. Um
   * prêmio de mil e um de um bilhão não podem voar a mesma ficha só, e também não podem
   * voar um bilhão de fichas. Cinco é o teto, igual ao da pilha.
   */
  const quantas = Math.max(1, Math.min(5, Math.ceil(Math.log10(Math.max(10, voando.valor))) - 1));
  const origem = deOndeSai ?? { x: 0.5, y: 0.55 };

  return (
    <View style={estilos.ceu} pointerEvents="none">
      {Array.from({ length: quantas }, (_, i) => (
        <FichaVoando
          key={`${voando.rodada}-${i}`}
          valor={voando.valor}
          indice={i}
          origem={origem}
          aoTerminar={i === quantas - 1 ? () => setVoando(null) : undefined}
        />
      ))}
    </View>
  );
}

function FichaVoando({
  valor,
  indice,
  origem,
  aoTerminar,
}: {
  valor: number;
  indice: number;
  origem: { x: number; y: number };
  aoTerminar?: () => void;
}) {
  const andar = useSharedValue(0);
  const sumir = useSharedValue(1);

  /* O desvio lateral desta ficha: ímpares pra um lado, pares pro outro, tamanhos diferentes. */
  const desvio = (indice % 2 === 0 ? 1 : -1) * (12 + indice * 9);
  const atraso = indice * 70;

  useEffect(() => {
    andar.value = withDelay(atraso, withTiming(1, { duration: TEMPO.festa + 200, easing: CURVA.saida }));
    sumir.value = withDelay(
      atraso + TEMPO.festa + 40,
      withTiming(0, { duration: 200, easing: Easing.linear }, (acabou) => {
        if (acabou && aoTerminar) runOnJS(aoTerminar)();
      }),
    );
  }, []);

  const estilo = useAnimatedStyle(() => {
    const t = andar.value;
    return {
      opacity: sumir.value,
      transform: [
        /* O caminho: da origem até o topo da tela, com a barriga da curva no meio. */
        { translateY: -t * 1000 * origem.y },
        { translateX: Math.sin(t * Math.PI) * desvio },
        /* Encolhe ao chegar: a ficha "entra" na pilha do saldo em vez de sumir do nada. */
        { scale: 1 - t * 0.35 },
      ],
    };
  });

  return (
    <Animated.View
      style={[estilos.ficha, { left: `${origem.x * 100}%`, top: `${origem.y * 100}%` }, estilo]}
    >
      <Ficha valor={valor} cor={undefined} tamanho={TAMANHO_DA_FICHA} mostrarValor />
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  /* Céu: cobre a mesa inteira e não recebe toque — a mesa continua jogável durante o voo. */
  ceu: { ...StyleSheet.absoluteFillObject, zIndex: 20 },
  ficha: { position: 'absolute', marginLeft: -TAMANHO_DA_FICHA / 2 },
});
