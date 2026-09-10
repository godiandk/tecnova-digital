/**
 * O SELETOR DE APOSTA — o mesmo em todas as mesas de aposta numérica.
 *
 * Substitui oito cópias de um `+` e um `−` que andavam de 50 em 50 a partir de 100. Numa
 * mesa cujo mínimo é 500 milhões, chegar lá custava dez milhões de toques.
 *
 * O QUE ELE MOSTRA, e por quê:
 *
 *   - as FICHAS DO DEGRAU (mínimo × 1, 2, 5, 10, 20): um toque em qualquer uma delas.
 *     São as mesmas fichas do trilho das mesas de pano, então a pessoa vê os mesmos
 *     valores nos dois lugares;
 *   - METADE e DOBRO: é o que alcança o que fica entre as fichas sem virar calculadora;
 *   - TUDO: um toque. É a aposta que mais gente procura e a que mais dava trabalho.
 *
 * A conta toda mora em `escada.ts`, que não desenha nada — é por isso que a promessa dos
 * dois a três toques pode ser conferida (`verify:escada-de-aposta`) em vez de prometida.
 *
 * QUEM NÃO TEM SALDO PRO MÍNIMO não recebe um seletor quebrado: recebe a frase que
 * explica, com o número. Um seletor que aceita e depois toma 400 do servidor é pior que
 * um seletor que diz não.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, fontFamily, fontSize, radius, spacing } from '../theme';
import { ALVO_DE_TOQUE } from '../theme/medidasDaMesa';
import {
  ajustar, atalhos, dobrar, metade, podeApostar, tudo, type FaixaDeAposta,
} from './escada';

interface Props {
  faixa: FaixaDeAposta;
  valor: number;
  aoMudar: (novo: number) => void;
  /** Enquanto a rodada corre, ninguém muda a aposta. */
  travado?: boolean;
}

/** Números grandes ficam ilegíveis por extenso; a partir de milhão vira "2,5 mi". */
function curto(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} tri`;
  if (n >= 1e9) return `${(n / 1e9).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} bi`;
  if (n >= 1e6) return `${(n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (n >= 1e4) return `${(n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`;
  return n.toLocaleString('pt-BR');
}

export function SeletorDeAposta({ faixa, valor, aoMudar, travado = false }: Props) {
  if (!podeApostar(faixa)) {
    return (
      <View style={estilos.semSaldo} accessibilityRole="alert">
        <Text style={estilos.semSaldoTitulo}>Saldo insuficiente para esta mesa</Text>
        <Text style={estilos.semSaldoTexto}>
          {`A aposta mínima aqui é ${faixa.minimo.toLocaleString('pt-BR')} fichas e você tem `}
          {`${Math.max(0, Math.floor(faixa.saldo)).toLocaleString('pt-BR')}.`}
        </Text>
      </View>
    );
  }

  const fichas = atalhos(faixa);
  const mudar = (novo: number) => { if (!travado) aoMudar(novo); };

  return (
    <View style={estilos.caixa}>
      <View style={estilos.topo}>
        <Text style={estilos.rotulo}>Aposta</Text>
        <Text style={estilos.valor} accessibilityLabel={`Aposta de ${valor.toLocaleString('pt-BR')} fichas`}>
          {valor.toLocaleString('pt-BR')}
        </Text>
        <Text style={estilos.minimo}>{`mínimo ${curto(faixa.minimo)}`}</Text>
      </View>

      {/*
        O trilho rola de lado quando as fichas não cabem — e é a MESMA gaveta que a
        conferência de tamanhos aceita: o que sai da tela continua alcançável, e a
        própria gaveta cabe. Sem isso, num celular estreito a ficha maior sumiria.
      */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={estilos.trilho}
        contentContainerStyle={estilos.trilhoDentro}
      >
        {fichas.map((ficha) => {
          const escolhida = ficha === valor;
          return (
            <Pressable
              key={ficha}
              onPress={() => mudar(ajustar(faixa, ficha))}
              disabled={travado}
              accessibilityRole="button"
              accessibilityState={{ selected: escolhida, disabled: travado }}
              accessibilityLabel={`Apostar ${ficha.toLocaleString('pt-BR')} fichas`}
              style={[estilos.ficha, escolhida && estilos.fichaEscolhida, travado && estilos.travado]}
            >
              <Text style={[estilos.fichaTexto, escolhida && estilos.fichaTextoEscolhido]}>
                {curto(ficha)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={estilos.linhaDeAtalhos}>
        <Atalho rotulo="½" descricao="Metade da aposta" travado={travado}
          aoTocar={() => mudar(metade(faixa, valor))} />
        <Atalho rotulo="2×" descricao="Dobrar a aposta" travado={travado}
          aoTocar={() => mudar(dobrar(faixa, valor))} />
        <Atalho rotulo="Tudo" descricao={`Apostar tudo, ${curto(faixa.saldo)} fichas`} largo travado={travado}
          aoTocar={() => mudar(tudo(faixa))} />
      </View>
    </View>
  );
}

function Atalho({ rotulo, descricao, aoTocar, travado, largo = false }: {
  rotulo: string; descricao: string; aoTocar: () => void; travado: boolean; largo?: boolean;
}) {
  return (
    <Pressable
      onPress={aoTocar}
      disabled={travado}
      accessibilityRole="button"
      accessibilityLabel={descricao}
      accessibilityState={{ disabled: travado }}
      style={[estilos.atalho, largo && estilos.atalhoLargo, travado && estilos.travado]}
    >
      <Text style={estilos.atalhoTexto}>{rotulo}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  caixa: { width: '100%', gap: spacing.sm, marginTop: spacing.lg },
  topo: { alignItems: 'center' },
  rotulo: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },
  valor: { fontFamily: fontFamily.displayBold, fontSize: fontSize.xl, color: colors.textPrimary },
  minimo: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },

  /* `minWidth: 0` deixa o trilho encolher; sem ele o RN não encolhe e a linha vaza. */
  trilho: { alignSelf: 'stretch', minWidth: 0 },
  trilhoDentro: { gap: spacing.sm, paddingHorizontal: spacing.xs, alignItems: 'center' },

  ficha: {
    minWidth: 64,
    minHeight: ALVO_DE_TOQUE,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.feltLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fichaEscolhida: { backgroundColor: colors.goldBright, borderColor: colors.goldBright },
  fichaTexto: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, color: colors.textPrimary },
  fichaTextoEscolhido: { color: colors.background },

  linhaDeAtalhos: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  atalho: {
    minWidth: ALVO_DE_TOQUE,
    minHeight: ALVO_DE_TOQUE,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.feltLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  atalhoLargo: { paddingHorizontal: spacing.lg },
  atalhoTexto: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, color: colors.textPrimary },
  travado: { opacity: 0.45 },

  semSaldo: {
    width: '100%',
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.backgroundElevated,
    borderWidth: 1,
    borderColor: colors.feltLine,
    gap: spacing.xs,
  },
  semSaldoTitulo: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, color: colors.textPrimary },
  semSaldoTexto: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textSecondary },
});
