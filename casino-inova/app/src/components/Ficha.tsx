import { Image, StyleSheet, Text, View } from 'react-native';

import { PlayerColor } from '../data/chipImages';
import { arteDaFicha, chapaEmPartes, chapaEmTexto, corDaChapa } from '../data/fichasDeValor';
import { ALTURA_DO_DIGITO, larguraEmCorpos } from '../data/larguraDoTexto';
import { FICHAS_VISIVEIS_NA_PILHA, PASSO_DA_PILHA } from '../theme/medidasDaMesa';
import { colors, fontFamily } from '../theme';

/**
 * Uma ficha: o corpo na cor de quem ela é, o valor na chapa do meio.
 *
 * A chapa não é um rótulo colado por cima da arte — é a parte da ficha onde a
 * denominação está gravada, que toda ficha de cassino com valor tem. Ela é escura por
 * baixo do número justamente pra o valor ler igual em cima de ficha branca e de ficha
 * vinho; a cor da borda da chapa é a convenção do valor (vermelho 5, verde 25, preto
 * 100), então quem já joga reconhece antes de ler.
 */
export function Ficha({
  valor,
  cor,
  tamanho,
  mostrarValor = true,
}: {
  valor: number;
  cor: PlayerColor | undefined;
  tamanho: number;
  /** Na pilha do pano só a de cima mostra o valor: as de baixo estão tapadas. */
  mostrarValor?: boolean;
}) {
  /*
   * O número curto vem de um lugar só (`chapaEmTexto`), e não de uma conta escrita aqui.
   * A conta antiga (`valor / 1000 + 'k'`) escrevia "100000k" numa ficha de cem milhões e
   * "2.5k" com ponto de inglês numa de 2.500.
   */
  const { numero, sufixo } = chapaEmPartes(valor);
  const chapa = medidasDaChapa(tamanho, numero, sufixo);

  return (
    <View style={{ width: tamanho, height: tamanho }}>
      <Image source={arteDaFicha(cor)} style={{ width: tamanho, height: tamanho }} resizeMode="contain" />
      {mostrarValor && (
        <View
          style={[
            styles.chapa,
            {
              width: chapa.diametro,
              height: chapa.diametro,
              borderRadius: chapa.diametro / 2,
              borderWidth: chapa.borda,
              borderColor: corDaChapa(valor),
              left: (tamanho - chapa.diametro) / 2,
              top: (tamanho - chapa.diametro) / 2,
            },
          ]}
          /* Lido em voz alta como o valor inteiro: "quinhentos milhões", não "500 mi". */
          accessible
          accessibilityLabel={chapaEmTexto(valor)}
        >
          <Text
            style={[styles.valor, { fontSize: chapa.corpoDoNumero, lineHeight: chapa.linhaDoNumero }]}
            /*
             * `numberOfLines` fica de fora de propósito. Ele é justamente o que corta o
             * texto com reticências quando não cabe — e o "50…" que aparecia na ficha de
             * 500mi era ele fazendo o trabalho dele. Aqui o tamanho da letra já foi
             * resolvido pra caber, então não há o que cortar; se algum dia não couber, a
             * falha aparece na hora em vez de virar um número diferente e plausível.
             */
            allowFontScaling={false}
          >
            {numero}
          </Text>
          {sufixo !== '' && (
            <Text
              style={[styles.valor, { fontSize: chapa.corpoDoSufixo, lineHeight: chapa.linhaDoSufixo }]}
              allowFontScaling={false}
            >
              {sufixo}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

/** O sufixo é escrito menor que o número: é a escala, não a grandeza. */
const PROPORCAO_DO_SUFIXO = 0.62;
/** A chapa vai até 0,64 da ficha — medido na arte, onde a faixa lisa acaba em 0,66. */
const DIAMETRO_DA_CHAPA = 0.64;
const BORDA_DA_CHAPA = 0.035;
/** Nenhuma letra passa disto, mesmo quando cabe: "5" ocupando a chapa inteira fica feio. */
const CORPO_MAXIMO = 0.3;
/**
 * A altura da CAIXA de cada linha, em múltiplos do corpo.
 *
 * É apertada de propósito — a caixa natural (1,2 a 1,5) abriria um buraco entre o número
 * e o sufixo num bloco que precisa ficar centrado num disco pequeno. Mas ela não desce
 * abaixo da altura da tinta (0,745): no Android uma entrelinha menor que a letra corta o
 * desenho da letra, e aí o "500" viraria um "500" sem topo — um jeito novo de mentir o
 * valor, que é justamente o que estamos consertando.
 */
const ENTRELINHA = 0.9;

/**
 * O maior corpo de letra que ainda cabe DENTRO DO CÍRCULO da chapa.
 *
 * A chapa é redonda, e é isso que torna a conta diferente de encaixar texto numa caixa:
 * a largura disponível depende da altura em que o texto está. Uma linha encostada no
 * topo do disco tem muito menos espaço do que uma linha no meio. Por isso a conta usa a
 * equação do próprio círculo — pra cada linha, no canto mais afastado dela, a
 * meia-largura do texto e a distância até o centro têm que caber no raio:
 *
 *     (largura / 2)² + (distância até o centro)² ≤ raio²
 *
 * Resolvendo pro corpo da letra, sai o maior tamanho que não encosta na borda. Vale o
 * menor dos dois resultados: quem não cabe manda no resto.
 *
 * As distâncias saem das caixas de linha de verdade, e não de um chute: o bloco todo
 * fica centrado no disco, cada tinta fica centrada na sua caixa, e daí sai onde está o
 * topo do número e a base do sufixo.
 *
 * O ganho é grande onde ele faz falta. Na ficha de 500 milhões a tabela antiga escolhia
 * o corpo por CONTAGEM DE LETRAS — tratando "1mi" e "500mi" como do mesmo tamanho, o que
 * a Poppins desmente: o "1" ocupa 0,376 do corpo e o "0" ocupa 0,652. O "500mi" não
 * cabia e saía como "50…". Aqui ele sai em duas linhas que cabem por construção.
 */
function medidasDaChapa(tamanho: number, numero: string, sufixo: string) {
  const diametro = tamanho * DIAMETRO_DA_CHAPA;
  const borda = Math.max(1.5, tamanho * BORDA_DA_CHAPA);
  const raio = diametro / 2 - borda;

  const temSufixo = sufixo !== '';
  // Tudo é medido em múltiplos do corpo do NÚMERO; o sufixo entra já reduzido.
  const caixaDoNumero = ENTRELINHA;
  const caixaDoSufixo = temSufixo ? ENTRELINHA * PROPORCAO_DO_SUFIXO : 0;
  const meioDoBloco = (caixaDoNumero + caixaDoSufixo) / 2;

  // Metade da tinta de cada linha, a partir do centro da caixa dela.
  const meiaTintaDoNumero = ALTURA_DO_DIGITO / 2;
  const meiaTintaDoSufixo = (ALTURA_DO_DIGITO * PROPORCAO_DO_SUFIXO) / 2;

  // O topo do número e a base do sufixo — os dois pontos mais apertados do bloco.
  const ateOTopoDoNumero = meioDoBloco - caixaDoNumero / 2 + meiaTintaDoNumero;
  const ateABaseDoSufixo = meioDoBloco - caixaDoSufixo / 2 + meiaTintaDoSufixo;

  const cabeDentro = (largura: number, distanciaDoCentro: number) =>
    raio / Math.hypot(largura / 2, distanciaDoCentro);

  const corpoDoNumero = Math.min(
    tamanho * CORPO_MAXIMO,
    cabeDentro(larguraEmCorpos(numero), ateOTopoDoNumero),
    temSufixo
      ? cabeDentro(larguraEmCorpos(sufixo) * PROPORCAO_DO_SUFIXO, ateABaseDoSufixo)
      : Number.POSITIVE_INFINITY,
  );

  return {
    diametro,
    borda,
    corpoDoNumero,
    corpoDoSufixo: corpoDoNumero * PROPORCAO_DO_SUFIXO,
    linhaDoNumero: corpoDoNumero * ENTRELINHA,
    linhaDoSufixo: corpoDoNumero * PROPORCAO_DO_SUFIXO * ENTRELINHA,
  };
}

/**
 * A pilha de fichas EM CIMA DO PANO — as fichas que a pessoa encostou na casa, na ordem
 * em que encostou.
 *
 * Isto não é um enfeite do número: é o número. Numa mesa de verdade não existe
 * "APOSTADO: 250" escrito em lugar nenhum — existe a pilha, e a altura dela mais a
 * denominação da ficha de cima dizem quanto está em jogo. Só a de cima mostra o valor
 * porque só a de cima está à vista; as de baixo aparecem pela borda, como na mesa.
 */
export function PilhaDeFichas({
  fichas,
  cor,
  tamanho = 44,
}: {
  fichas: number[];
  cor: PlayerColor | undefined;
  tamanho?: number;
}) {
  if (fichas.length === 0) return null;
  const mostradas = fichas.slice(-FICHAS_VISIVEIS_NA_PILHA);
  const passo = tamanho * PASSO_DA_PILHA;

  return (
    <View pointerEvents="none" style={{ width: tamanho, height: tamanho + passo * (mostradas.length - 1) }}>
      {mostradas.map((valor, i) => (
        <View key={i} style={{ position: 'absolute', bottom: i * passo }}>
          {/* A primeira encostada fica embaixo; só a última mostra a denominação. */}
          <Ficha valor={valor} cor={cor} tamanho={tamanho} mostrarValor={i === mostradas.length - 1} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chapa: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6,10,8,0.9)',
  },
  valor: { fontFamily: fontFamily.displayBold, color: colors.goldBright },
});
