/**
 * O SELETOR DE ENTRADA — o buy-in das mesas entre jogadores (truco, dominó, pôquer).
 *
 * Substitui cinco cópias de um `+` e um `−` que andavam de 100 em 100 dentro de uma faixa
 * fixa de 100 a 5.000. Com a faixa saindo do degrau da pessoa, esse par de botões deixou
 * de funcionar: no Eclipse, chegar de 500 trilhões a 100 quatrilhões custaria um trilhão
 * de toques. É o mesmo defeito que o seletor de aposta já tinha resolvido nas outras
 * mesas, e a resposta é a mesma — as fichas do degrau, um toque cada.
 *
 * AS OPÇÕES VÊM PRONTAS DO SERVIDOR (`config.entradas`), e não são calculadas aqui. No
 * pôquer isso é o que impede a tela de mentir: as cegas saem do buy-in, então cada opção
 * chega com as cegas dela e o rótulo é sempre o que a mão vai cobrar de verdade.
 *
 * QUEM NÃO TEM SALDO PRA NENHUMA ENTRADA recebe a frase que explica, com o número — e não
 * um seletor vazio nem um botão que toma erro do servidor depois de apertado.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, fontFamily, fontSize, radius, spacing } from '../theme';
import { ALVO_DE_TOQUE } from '../theme/medidasDaMesa';

export interface OpcaoDeEntrada {
  entrada: number;
  /** Só o pôquer manda: as cegas desta entrada. A tela mostra junto quando vierem. */
  smallBlind?: number;
  bigBlind?: number;
}

interface Props {
  opcoes: OpcaoDeEntrada[];
  valor: number;
  aoMudar: (novo: number) => void;
  /** O que a entrada paga, em uma linha. Ex.: "paga ×2 se ganhar". */
  legenda?: string;
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

export function SeletorDeEntrada({ opcoes, valor, aoMudar, legenda, travado = false }: Props) {
  if (opcoes.length === 0) {
    return (
      <View style={estilos.aviso}>
        <Text style={estilos.avisoTexto}>
          Você ainda não tem fichas para a entrada desta mesa. Colete a recompensa diária ou jogue
          uma rodada nas mesas contra a casa.
        </Text>
      </View>
    );
  }

  const escolhida = opcoes.find((o) => o.entrada === valor) ?? opcoes[0];

  return (
    <View>
      <View style={estilos.cabecalho}>
        <Text style={estilos.rotulo}>Entrada{legenda ? ` (${legenda})` : ''}</Text>
        <Text style={estilos.valor}>{escolhida.entrada.toLocaleString('pt-BR')}</Text>
      </View>
      {escolhida.bigBlind !== undefined && (
        <Text style={estilos.cegas}>
          cegas {escolhida.smallBlind?.toLocaleString('pt-BR')}/{escolhida.bigBlind.toLocaleString('pt-BR')}
        </Text>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.trilho}>
        {opcoes.map((opcao) => {
          const ativa = opcao.entrada === escolhida.entrada;
          return (
            <Pressable
              key={opcao.entrada}
              onPress={() => aoMudar(opcao.entrada)}
              disabled={travado}
              accessibilityRole="button"
              accessibilityState={{ selected: ativa, disabled: travado }}
              accessibilityLabel={`Entrada de ${opcao.entrada.toLocaleString('pt-BR')} fichas`}
              style={[estilos.ficha, ativa && estilos.fichaAtiva, travado && estilos.travada]}
            >
              <Text style={[estilos.fichaTexto, ativa && estilos.fichaTextoAtivo]}>{curto(opcao.entrada)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  cabecalho: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  rotulo: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },
  valor: { fontFamily: fontFamily.displayBold, fontSize: fontSize.xl, color: colors.textPrimary },
  cegas: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint, marginTop: 2 },
  trilho: { gap: spacing.sm, paddingVertical: spacing.sm },
  ficha: {
    minWidth: ALVO_DE_TOQUE * 1.4,
    minHeight: ALVO_DE_TOQUE,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.feltLine,
    backgroundColor: colors.backgroundElevated,
  },
  fichaAtiva: { borderColor: colors.goldBright, backgroundColor: colors.goldBright },
  travada: { opacity: 0.5 },
  fichaTexto: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, color: colors.textPrimary },
  fichaTextoAtivo: { color: colors.background },
  aviso: { padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.backgroundElevated },
  avisoTexto: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20 },
});
