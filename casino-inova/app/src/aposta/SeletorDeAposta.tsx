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
import { Pressable, StyleSheet, Text, View } from 'react-native';

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

/**
 * O CORPO DA LETRA SAI DO RÓTULO MAIS LONGO DO TRILHO.
 *
 * `adjustsFontSizeToFit` existe no iOS e NÃO existe no react-native-web — e o jogo chega
 * pelo navegador. No retrato de celular dá pra ver o resultado: com as cinco fichas
 * dividindo a largura, "100 mil" virava "100 …". Encolher só a última não resolve (as
 * cinco têm que ficar iguais), e cortar o texto é pior que letra menor.
 *
 * Então o tamanho é escolhido uma vez, pelo rótulo mais comprido, e vale pras cinco.
 */
function corpoDoTrilho(rotulos: string[]): number {
  const maior = rotulos.reduce((n, r) => Math.max(n, r.length), 0);
  if (maior <= 5) return 15;   // "50", "1 mi"
  if (maior <= 7) return 13;   // "100 mil", "2,5 bi"
  return 11;                   // "500 mil", "100 tri"
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
  const corpo = corpoDoTrilho(fichas.map(curto));
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
        AS CINCO FICHAS CABEM, TODAS, SEM ROLAR — e isto foi corrigido olhando o retrato.
        
        O trilho era uma gaveta horizontal. Num iPhone de 390 pontos as cinco fichas somam
        mais que a largura, então a quinta aparecia CORTADA na borda direita, sem barra de
        rolagem (ela estava desligada) e sem sombra de continuação: do lado do jogador, a
        maior ficha da mesa parecia um erro de desenho. O retrato de três jogos diferentes
        mostra a mesma ficha cortada no mesmo lugar.
        
        Agora cada ficha divide a largura em partes iguais (`flex: 1`). São sempre cinco —
        o degrau publica cinco —, então dividir é suficiente e não precisa rolar. O rótulo
        já é curto por construção ("50 mil", "1 mi", "2,5 bi"), e encolhe uma vez se
        precisar, em vez de vazar.
        
        E some um `ScrollView` de dentro da área de jogo, que é o gesto de documento que o
        diagnóstico pediu pra tirar das mesas.
      */}
      <View style={estilos.trilho}>
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
              <Text
                style={[estilos.fichaTexto, { fontSize: corpo }, escolhida && estilos.fichaTextoEscolhido]}
                numberOfLines={1}
              >
                {curto(ficha)}
              </Text>
            </Pressable>
          );
        })}
      </View>

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

  /*
   * A linha das cinco fichas. `minWidth: 0` deixa cada uma encolher — sem ele o React
   * Native respeita a largura do texto e a linha vaza pela borda, que era o defeito.
   */
  trilho: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
    minWidth: 0,
  },

  ficha: {
    flex: 1,
    minWidth: 0,
    minHeight: ALVO_DE_TOQUE,
    paddingHorizontal: spacing.xs,
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
