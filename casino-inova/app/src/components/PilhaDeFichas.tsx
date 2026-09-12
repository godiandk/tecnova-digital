import { StyleSheet, View } from 'react-native';

import { Ficha } from './Ficha';
import { FICHAS_VISIVEIS_NA_PILHA, PASSO_DA_PILHA } from '../theme/medidasDaMesa';

/**
 * A PILHA DE FICHAS APOSTADA, do jeito que ela fica na mesa.
 *
 * O PRINCÍPIO, que vale pros dez jogos: a aposta é uma PILHA NUM LUGAR, e não um número
 * num painel. Enquanto a tela dizia "Aposta 50.000" num rótulo, o jogador estava lendo um
 * formulário; com a pilha no pano, ele está olhando a mesa dele.
 *
 * QUANTAS FICHAS APARECEM não é a quantidade apostada — é a ALTURA da pilha, que cresce
 * com a aposta e para em cinco. Uma pilha de mil fichas desenhadas seria uma torre saindo
 * do tampo; cinco fichas com o valor gravado na de cima é como uma mesa de verdade mostra
 * qualquer aposta, de cinquenta a um trilhão.
 */
export function PilhaDeFichas({ valor, tamanho = 30 }: { valor: number; tamanho?: number }) {
  if (!Number.isFinite(valor) || valor <= 0) return null;

  const quantas = Math.max(
    1,
    Math.min(FICHAS_VISIVEIS_NA_PILHA, Math.ceil(Math.log10(Math.max(10, valor)))),
  );

  return (
    <View
      style={[estilos.pilha, { width: tamanho, height: tamanho + (quantas - 1) * PASSO_DA_PILHA * tamanho }]}
      pointerEvents="none"
    >
      {Array.from({ length: quantas }, (_, i) => (
        <View key={i} style={[estilos.ficha, { bottom: i * PASSO_DA_PILHA * tamanho }]}>
          {/* Só a de cima mostra o valor: as de baixo estão tapadas por ela. */}
          <Ficha valor={valor} cor={undefined} tamanho={tamanho} mostrarValor={i === quantas - 1} />
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  pilha: { alignItems: 'center', justifyContent: 'flex-end' },
  ficha: { position: 'absolute' },
});
