import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  APOSTAS_DE_FORA,
  CasaDoPano,
  COLUNA_DA_FILEIRA,
  DUZIAS,
  FILEIRAS,
  casaDeNumero,
  casaVenceu,
  corDoNumero,
} from '../data/panoDaRoleta';
import { chapaEmPartes, chapaEmTexto } from '../data/fichasDeValor';
import { larguraEmCorpos } from '../data/larguraDoTexto';
import { colors, fontFamily } from '../theme';

/**
 * O PANO DA ROLETA — onde a ficha encosta.
 *
 * Antes desta tela não existia pano: a roleta era uma lista de botões escritos
 * ("Vermelho · ×2", "Número exato · ×36") e não havia como escolher QUAL número. O
 * jogo tinha 37 casas e a tela oferecia dez pílulas.
 *
 * A disposição é a da mesa: três fileiras de doze, com o zero à esquerda cobrindo as
 * três, o "2:1" de cada fileira no fim dela (que é a aposta de coluna daquela fileira),
 * as dúzias embaixo — cada uma exatamente sobre as quatro colunas que ela paga — e as
 * apostas de fora na última linha. Nada aqui é decoração: cada caixa é uma aposta que o
 * servidor aceita, e o que ela paga está em `paga`.
 *
 * O PANO É DESENHADO, e não recortado da foto da mesa. A foto tem o pano impresso
 * errado (faltam o 27, o 28 e o 29, e o 30 está no lugar do 27), então usar a arte como
 * área de toque faria a pessoa apostar num número diferente do que está lendo. Ver
 * `src/data/panoDaRoleta.ts`.
 */
interface PanoProps {
  /** Quanto está encostado em cada casa, pela chave da casa. */
  apostas: Record<string, number>;
  /** O número que saiu na última bola, pra acender as casas que ganharam. */
  saiu: number | null;
  /** Enquanto a bola corre ninguém encosta ficha. */
  travado: boolean;
  onEncostar: (casa: CasaDoPano) => void;
  /** A largura que o pano tem pra ocupar. As casas se dimensionam a partir dela. */
  largura: number;
}

export function PanoDaRoleta({ apostas, saiu, travado, onEncostar, largura }: PanoProps) {
  /*
   * A CONTA DA LARGURA. O pano tem, na horizontal: o zero, doze colunas de número e a
   * casa do 2:1. Treze e meia colunas, na prática — o zero e o 2:1 são mais estreitos
   * que um número porque neles cabe menos texto.
   *
   * É uma conta e não uma tabela de tamanhos porque o pano tem que caber igual num
   * celular de 320 e num tablet de 900: com medida fixa, ou sobra pano fora da tela num
   * lado, ou sobra tela vazia no outro.
   */
  const medidas = useMemo(() => {
    const larguraDoZero = largura * 0.075;
    const larguraDaColunaBet = largura * 0.085;
    const paraOsNumeros = largura - larguraDoZero - larguraDaColunaBet;
    const casa = paraOsNumeros / 12;
    return {
      zero: larguraDoZero,
      colunaBet: larguraDaColunaBet,
      casa,
      // A casa é um retângulo em pé, como na mesa. Mais alta que larga, sem exagero.
      altura: Math.max(30, casa * 1.15),
      corpo: Math.max(10, Math.min(15, casa * 0.46)),
    };
  }, [largura]);

  const desenhar = (casa: CasaDoPano, larguraDaCasa: number, estilo: object, conteudo: React.ReactNode) => {
    const valor = apostas[casa.chave] ?? 0;
    const venceu = saiu !== null && casaVenceu(casa, saiu);
    return (
      <Pressable
        key={casa.chave}
        onPress={() => !travado && onEncostar(casa)}
        disabled={travado}
        accessibilityRole="button"
        accessibilityLabel={
          valor > 0 ? `${casa.descricao}. ${chapaEmTexto(valor)} apostado` : casa.descricao
        }
        style={[styles.casa, estilo, venceu && styles.vencedora]}
      >
        {conteudo}
        {valor > 0 && <MarcaDaAposta valor={valor} unidade={medidas.casa} larguraDaCasa={larguraDaCasa} />}
      </Pressable>
    );
  };

  const numero = (n: number) => {
    const cor = corDoNumero(n);
    return desenhar(
      casaDeNumero(n),
      medidas.casa,
      [
        { width: medidas.casa, height: medidas.altura },
        cor === 'vermelho' ? styles.fundoVermelho : styles.fundoPreto,
      ] as unknown as object,
      <Text style={[styles.numero, { fontSize: medidas.corpo }]} numberOfLines={1}>
        {n}
      </Text>,
    );
  };

  return (
    <View style={[styles.pano, { width: largura }]}>
      <View style={styles.corpoDoPano}>
        {/* O zero, em pé, cobrindo as três fileiras — como na mesa. */}
        {desenhar(
          casaDeNumero(0),
          medidas.zero,
          [
            { width: medidas.zero, height: medidas.altura * 3 },
            styles.fundoVerde,
          ] as unknown as object,
          <Text style={[styles.numero, { fontSize: medidas.corpo }]}>0</Text>,
        )}

        <View>
          {FILEIRAS.map((fileira, i) => (
            <View key={i} style={styles.linha}>
              {fileira.map(numero)}
            </View>
          ))}
          {/* As dúzias ficam sob as quatro colunas que cada uma paga. */}
          <View style={styles.linha}>
            {DUZIAS.map((d) =>
              desenhar(
                d,
                medidas.casa * 4,
                { width: medidas.casa * 4, height: medidas.altura } as object,
                <Text style={[styles.forasTexto, { fontSize: medidas.corpo * 0.86 }]} numberOfLines={1}>
                  {d.rotulo}
                </Text>,
              ),
            )}
          </View>
          {/* E as apostas de fora, duas colunas cada. */}
          <View style={styles.linha}>
            {APOSTAS_DE_FORA.map((f) =>
              desenhar(
                f,
                medidas.casa * 2,
                { width: medidas.casa * 2, height: medidas.altura } as object,
                f.cor ? (
                  <View
                    style={[
                      styles.losango,
                      {
                        width: medidas.casa * 0.62,
                        height: medidas.casa * 0.62,
                        backgroundColor: f.cor === 'vermelho' ? CORES.vermelho : CORES.preto,
                      },
                    ]}
                    /*
                     * O losango tem contorno dourado, e não só cor. O preto sobre o
                     * verde escuro do pano some — a casa ficava parecendo vazia, e a
                     * aposta mais comum da mesa era a única sem rótulo visível. Na mesa
                     * física os dois losangos são impressos com fio dourado pelo mesmo
                     * motivo.
                     */
                  />
                ) : (
                  <Text style={[styles.forasTexto, { fontSize: medidas.corpo * 0.86 }]} numberOfLines={1}>
                    {f.rotulo}
                  </Text>
                ),
              ),
            )}
          </View>
        </View>

        {/* O 2:1 de cada fileira: a coluna daquela fileira, no fim dela. */}
        <View>
          {COLUNA_DA_FILEIRA.map((c) =>
            desenhar(
              c,
              medidas.colunaBet,
              { width: medidas.colunaBet, height: medidas.altura } as object,
              <Text style={[styles.forasTexto, { fontSize: medidas.corpo * 0.86 }]}>2:1</Text>,
            ),
          )}
        </View>
      </View>
    </View>
  );
}

/**
 * A ficha encostada numa casa do pano.
 *
 * Numa casa de trinta pixels não cabe o disco de uma ficha de verdade, e cabe menos
 * ainda uma pilha — então a marca é um disco pequeno com o valor escrito, que é o que
 * a mesa acaba fazendo também quando a aposta é alta: o que se lê é o número.
 *
 * O CORPO DA LETRA É CALCULADO, não escolhido. A primeira versão usava tamanho fixo e a
 * marca de "500mi" saía mais larga que a própria casa, invadindo a vizinha e virando
 * "500m" cortado — o mesmo defeito que a ficha tinha, pelo mesmo motivo: a Poppins não
 * tem dígito de largura fixa. Aqui a largura do texto é medida (`larguraEmCorpos`) e o
 * corpo sai da divisão pelo espaço que existe, então cabe por construção, seja "5k" ou
 * "2,5tri".
 */
function MarcaDaAposta({
  valor,
  unidade,
  larguraDaCasa,
}: {
  valor: number;
  /** A largura de UMA coluna de número — é o espaço que a marca tem pra caber. */
  unidade: number;
  /** A largura da casa em que a marca está. Uma dúzia é quatro colunas. */
  larguraDaCasa: number;
}) {
  /*
   * A MARCA É EM DUAS LINHAS, pelo mesmo motivo que a ficha é: numa casa de vinte e oito
   * pixels, "500mi" numa linha só obriga a letra a encolher até sumir — e a primeira
   * tentativa aqui saiu exatamente como o defeito que estamos consertando, "500…".
   *
   * Quebrado em "500" em cima e "mi" embaixo, a linha mais larga passa de 3,3 corpos
   * pra 1,95, e o número sai quase 70% maior no mesmo espaço. A altura sobra: a casa
   * tem trinta e dois pixels e o bloco usa onze.
   *
   * O corpo é MEDIDO (`larguraEmCorpos` conhece a largura de cada letra na Poppins),
   * então cabe por construção — "5k", "500mi" ou "2,5tri".
   */
  const { numero, sufixo } = chapaEmPartes(valor);
  const dentro = unidade - 8; // desconta a borda e o respiro dos dois lados
  const corpo = Math.min(unidade * 0.36, dentro / larguraEmCorpos(numero));
  const corpoDoSufixo = corpo * 0.62;
  /*
   * Numa casa larga a marca vai pro lado, e não pro meio: centrada, ela tapava
   * justamente o "2ª dúzia" escrito ali — a casa ficava com uma ficha em cima e sem
   * dizer o que é. Na casa estreita de um número o meio é o único lugar que existe, e a
   * ficha por cima do número é o que acontece na mesa de verdade.
   */
  const noLado = larguraDaCasa > unidade * 1.5;
  return (
    <View
      style={[styles.marca, { minWidth: unidade * 0.68 }, noLado ? { right: unidade * 0.2 } : null]}
      pointerEvents="none"
      accessibilityElementsHidden
    >
      <Text style={[styles.marcaTexto, { fontSize: corpo, lineHeight: corpo * 0.95 }]}>{numero}</Text>
      {sufixo !== '' && (
        <Text style={[styles.marcaTexto, { fontSize: corpoDoSufixo, lineHeight: corpoDoSufixo * 0.95 }]}>
          {sufixo}
        </Text>
      )}
    </View>
  );
}

const CORES = {
  vermelho: '#B0201C',
  preto: '#171A18',
  verde: '#116B3C',
};

const styles = StyleSheet.create({
  /*
   * O pano tem feltro próprio, e não o da foto atrás. Sem ele, entre uma casa e outra
   * aparecia a mesa fotografada — que tem OUTRO pano impresso, com outros números. Duas
   * mesas empilhadas, a de baixo errada.
   */
  pano: {
    alignSelf: 'center',
    backgroundColor: '#0A2C1D',
    borderWidth: 1,
    borderColor: 'rgba(214,178,94,0.6)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  corpoDoPano: { flexDirection: 'row', alignItems: 'flex-start' },
  linha: { flexDirection: 'row' },
  casa: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(214,178,94,0.55)',
    backgroundColor: 'rgba(9,40,26,0.85)',
  },
  fundoVermelho: { backgroundColor: CORES.vermelho },
  fundoPreto: { backgroundColor: CORES.preto },
  fundoVerde: { backgroundColor: CORES.verde },
  /* A casa que ganhou acende por dentro: é o mesmo lugar, não um aviso em outro canto. */
  vencedora: { borderColor: colors.goldBright, borderWidth: 2 },
  numero: { fontFamily: fontFamily.displayBold, color: '#F4EFE2' },
  forasTexto: { fontFamily: fontFamily.displayBold, color: colors.goldBright, textAlign: 'center' },
  losango: {
    transform: [{ rotate: '45deg' }],
    borderWidth: 1,
    borderColor: colors.goldBright,
  },
  /*
   * A FICHA ENCOSTADA. Numa casa de trinta pixels não cabe o disco inteiro da ficha, e
   * cabe menos ainda uma pilha — então a marca é uma plaqueta com o valor. É o que a
   * mesa de verdade acaba fazendo também quando a aposta é alta: o que se lê é o número.
   */
  marca: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: 2,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: 'rgba(6,10,8,0.94)',
    borderWidth: 1.5,
    borderColor: colors.goldBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marcaTexto: { fontFamily: fontFamily.displayBold, color: colors.goldBright },
});
