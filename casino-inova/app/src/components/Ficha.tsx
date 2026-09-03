import { Image, StyleSheet, Text, View } from 'react-native';

import { PlayerColor } from '../data/chipImages';
import { arteDaFicha, corDaChapa } from '../data/fichasDeValor';
import { PASSO_DA_PILHA } from '../data/mapaDosTampos';
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
  const rotulo = valor >= 1000 ? `${valor / 1000}k` : String(valor);
  /*
   * O corpo da letra cai conforme o número cresce. Sem isto, "100" e "500" não cabiam
   * na chapa e saíam cortados como "1…" — três dígitos precisam de mais largura do que
   * um, e a chapa é redonda, então quem cede é a letra.
   */
  const corpoDaLetra = { 1: 0.34, 2: 0.3, 3: 0.24 }[rotulo.length] ?? 0.22;

  return (
    <View style={{ width: tamanho, height: tamanho }}>
      <Image source={arteDaFicha(cor)} style={{ width: tamanho, height: tamanho }} resizeMode="contain" />
      {mostrarValor && (
        <View
          style={[
            styles.chapa,
            {
              width: tamanho * 0.58,
              height: tamanho * 0.58,
              borderRadius: tamanho * 0.29,
              borderWidth: Math.max(2, tamanho * 0.045),
              borderColor: corDaChapa(valor),
              left: tamanho * 0.21,
              top: tamanho * 0.21,
            },
          ]}
        >
          <Text style={[styles.valor, { fontSize: Math.round(tamanho * corpoDaLetra) }]} numberOfLines={1}>
            {rotulo}
          </Text>
        </View>
      )}
    </View>
  );
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
  /*
   * Cinco de altura é o teto, e não é número redondo: a faixa de feltro livre da casa do
   * jogador mede 0.163 da altura da mesa, e cinco fichas ocupam 1 + 4×0.20 = 1.8
   * diâmetro, que é o que cabe ali sem subir por cima do nome da casa. Passando disso a
   * pilha continua contando certo — ela só para de crescer na tela, como pilha que
   * alguém arrumou.
   */
  const mostradas = fichas.slice(-5);
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
