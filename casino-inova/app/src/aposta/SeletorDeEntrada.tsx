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
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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

/**
 * O CORPO DA LETRA SAI DA LARGURA MEDIDA, e não de uma contagem de caracteres.
 *
 * `adjustsFontSizeToFit` existe no iOS e NÃO existe no react-native-web — e o jogo chega
 * pelo navegador. A primeira tentativa escolheu o tamanho pelo número de letras do rótulo
 * mais comprido: funcionou no dominó e continuou cortando no pôquer ("100 mil" virava
 * "100 …"), porque as duas telas dão larguras diferentes ao trilho. Contar letra é chute;
 * a largura é medida.
 *
 * A conta: cada ficha recebe uma fatia igual da linha, menos o vão e o respiro interno. A
 * largura de um dígito na fonte do trilho é ~0,58 do corpo — daí sai o corpo que faz o
 * rótulo mais comprido caber. Os limites existem pelas duas pontas: abaixo de 10 não se lê,
 * acima de 15 não fica melhor.
 */
function corpoDoTrilho(rotulos: string[], larguraDaLinha: number, vao: number): number {
  const maior = rotulos.reduce((n, r) => Math.max(n, r.length), 0);
  if (maior === 0 || larguraDaLinha <= 0) return 13;
  const porFicha = (larguraDaLinha - vao * (rotulos.length - 1)) / rotulos.length;
  const util = porFicha - RESPIRO_DA_FICHA;
  return Math.max(10, Math.min(15, Math.floor(util / (maior * 0.58))));
}

/** O que sobra de cada ficha pra borda e o respiro dos dois lados do texto. */
const RESPIRO_DA_FICHA = 14;

/** O vão entre uma ficha e a próxima. Constante porque a conta do corpo usa ele. */
const VAO_DO_TRILHO = 6;

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
  const [larguraDoTrilho, setLarguraDoTrilho] = useState(0);
  const corpo = corpoDoTrilho(opcoes.map((o) => curto(o.entrada)), larguraDoTrilho, VAO_DO_TRILHO);

  return (
    /*
     * O SELETOR SE ESTICA NA LARGURA DO BLOCO, e isto é dele e não de cada tela.
     *
     * Sem `alignSelf: 'stretch'`, um bloco com `alignItems: 'center'` encolhe o filho até a
     * largura do conteúdo — foi o que aconteceu no pôquer: o trilho ficou com 238 pontos
     * em vez de 342, e "100 mil" virou "100 …" mesmo com o corpo da letra já medido. Duas
     * telas com o mesmo componente não podem depender de cada uma lembrar de esticá-lo.
     */
    <View style={estilos.raiz}>
      <View style={estilos.cabecalho}>
        <Text style={estilos.rotulo}>Entrada{legenda ? ` (${legenda})` : ''}</Text>
        <Text style={estilos.valor}>{escolhida.entrada.toLocaleString('pt-BR')}</Text>
      </View>
      {escolhida.bigBlind !== undefined && (
        <Text style={estilos.cegas}>
          cegas {escolhida.smallBlind?.toLocaleString('pt-BR')}/{escolhida.bigBlind.toLocaleString('pt-BR')}
        </Text>
      )}
      {/*
        AS ENTRADAS CABEM, TODAS, SEM ROLAR — o mesmo conserto do trilho de aposta, feito
        aqui pelo mesmo motivo e com a mesma evidência: no retrato de celular do dominó, a
        quinta entrada aparece PARTIDA na borda direita, sem barra de rolagem (ela está
        desligada) e sem sombra de continuação. São sempre cinco (as fichas do degrau), e
        cinco dividem a largura sem sobra.
      */}
      <View style={estilos.trilho} onLayout={(e) => setLarguraDoTrilho(e.nativeEvent.layout.width)}>
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
              <Text
                style={[estilos.fichaTexto, { fontSize: corpo }, ativa && estilos.fichaTextoAtivo]}
                numberOfLines={1}
              >
                {curto(opcao.entrada)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { alignSelf: 'stretch' },
  cabecalho: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  /*
   * O RÓTULO ERA ILEGÍVEL SOBRE A MESA. `textFaint` é um cinza pensado pra fundo de
   * painel; por cima da fotografia escura da mesa de dominó ele desaparecia — no retrato
   * dá pra ver "Entrada (paga ×2 se ganhar)" sumindo dentro da madeira. Texto de controle
   * fica no tom de leitura, não no de rodapé.
   */
  rotulo: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textSecondary },
  valor: { fontFamily: fontFamily.displayBold, fontSize: fontSize.xl, color: colors.textPrimary },
  cegas: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint, marginTop: 2 },
  trilho: { flexDirection: 'row', gap: VAO_DO_TRILHO, paddingVertical: spacing.sm, alignItems: 'center' },
  ficha: {
    flex: 1,
    minWidth: 0,
    minHeight: ALVO_DE_TOQUE,
    paddingHorizontal: spacing.xs,
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
