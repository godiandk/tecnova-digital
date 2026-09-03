import { Pressable, StyleSheet, View } from 'react-native';

import { PlayerColor } from '../data/chipImages';
import { DENOMINACOES } from '../data/fichasDeValor';
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
  minimo?: number;
  maximo?: number;
}

export function TrilhoDeFichas({
  selecionada,
  onSelecionar,
  cor,
  tamanho = 56,
  saldo,
  travado,
  minimo = 0,
  maximo = Number.MAX_SAFE_INTEGER,
}: TrilhoDeFichasProps) {
  const cabem = DENOMINACOES.filter((d) => d.valor >= minimo && d.valor <= maximo);

  return (
    <View
      style={[styles.trilho, { gap: tamanho * 0.16 }]}
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
    </View>
  );
}

const styles = StyleSheet.create({
  trilho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  ficha: { borderWidth: 2, borderColor: 'transparent' },
  escolhida: { borderColor: colors.goldBright },
  apagada: { opacity: 0.35 },
});
