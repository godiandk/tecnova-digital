/**
 * O PAINEL DE QUADROS — o número na tela, durante o jogo de verdade.
 *
 * Por que existe: a POC de renderização mediu uma cena de laboratório, num contêiner sem
 * GPU. O que decide o renderer é o jogo de verdade, num aparelho de verdade, com o
 * telefone morno e o navegador com outras abas abertas — e pra isso o medidor tem que
 * morar DENTRO do aplicativo, não num teste ao lado.
 *
 * Fica desligado. Ligar é a linha de baixo, e ele some sozinho de produção porque o
 * `__DEV__` do React Native é falso lá.
 *
 * NÃO É PARA O JOGADOR VER. É ferramenta de quem constrói; por isso não tem estilo de
 * marca, não anima, e é feio de propósito — pra ninguém confundir com parte do jogo.
 */
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { comoEstaIndo, ORCAMENTO_MS } from './medidorDeQuadros';
import { useMedidorDeQuadros } from './useMedidorDeQuadros';

const CORES = {
  bom: '#5fd68a',
  atencao: '#ffd98a',
  ruim: '#ff7a6b',
} as const;

export function PainelDeQuadros({ ligado, aoTocar }: { ligado: boolean; aoTocar?: () => void }) {
  const medida = useMedidorDeQuadros(ligado);
  if (!ligado) return null;

  const veredito = medida ? comoEstaIndo(medida) : null;

  return (
    <Pressable
      style={estilos.caixa}
      onPress={aoTocar}
      accessibilityRole="button"
      accessibilityLabel="Painel de desempenho. Toque para esconder."
    >
      {medida === null || veredito === null ? (
        <Text style={estilos.texto}>medindo…</Text>
      ) : (
        <>
          <Text style={[estilos.titulo, { color: CORES[veredito.nivel] }]}>
            {veredito.frase}
          </Text>
          <Text style={estilos.texto}>
            {`típico ${medida.p50} ms  ·  p95 ${medida.p95}  ·  p99 ${medida.p99}`}
          </Text>
          <Text style={estilos.texto}>
            {`pior ${medida.pior} ms  ·  ${medida.fps} q/s  ·  orçamento ${ORCAMENTO_MS.toFixed(1)}`}
          </Text>
          <Text style={estilos.texto}>
            {`perdeu ${medida.perdidos} viradas em ${medida.quadros} quadros (${medida.perdidosPorCento}%)`}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  caixa: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    zIndex: 9999,
    backgroundColor: 'rgba(6,19,8,0.92)',
    borderColor: '#cc9b65',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    /* Nunca mais largo que a tela, nem que os números fiquem grandes. */
    maxWidth: '94%',
  },
  titulo: { fontSize: 12, fontWeight: '700', marginBottom: 3 },
  texto: {
    color: '#e8dfd0',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
});

/** Só aparece em desenvolvimento — em produção `__DEV__` é falso e isto some. */
export const PODE_MEDIR_QUADROS = typeof __DEV__ !== 'undefined' && __DEV__;
