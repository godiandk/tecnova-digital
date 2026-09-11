import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { RECOMPENSA, type EstadoDaCasa, pilhaPara, seloDoEstado } from '../data/recompensaAssets';
import { colors, fontFamily, fontSize, radius, spacing } from '../theme';

interface Props {
  dia: number;
  premio: number;
  marco: boolean;
  estado: EstadoDaCasa;
  maiorDoMes: number;
  tamanho: number;
}

/** Números grandes ficam ilegíveis por extenso; a partir de dez mil vira "25 mil". */
function curto(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} tri`;
  if (n >= 1e9) return `${(n / 1e9).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} bi`;
  if (n >= 1e6) return `${(n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (n >= 1e4) return `${(n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`;
  return n.toLocaleString('pt-BR');
}

const COMO_SE_LE: Record<EstadoDaCasa, string> = {
  LOCKED: 'ainda não abriu',
  AVAILABLE: 'aberto para coletar hoje',
  CLAIMED: 'já coletado',
  MISSED: 'dia perdido',
};

/**
 * UMA CASA DO CALENDÁRIO — o dia, o prêmio e em que estado ele está.
 *
 * OS QUATRO ESTADOS SAEM DE TRÊS IMAGENS. `MISSED` é o selo fechado dessaturado, por
 * código: mesmo desenho, outro estado. Uma décima imagem pra dizer "este dia passou"
 * repetiria o que a posição no calendário já diz.
 *
 * O MARCO NÃO É UMA IMAGEM POR DIA. Os quatro dias de marco (7, 14, 21 e o último do mês)
 * ganham o cofre e uma moldura dourada por cima do mesmo selo — senão seriam 31 imagens
 * pra um calendário que muda de tamanho todo mês.
 *
 * E O VALOR ESTÁ ESCRITO EM TODA CASA, inclusive nas que ainda não abriram. O calendário
 * inteiro à vista é decisão de produto, não descuido: não existe prêmio surpresa, não
 * existe caixa que pode vir vazia, e a pessoa sabe hoje o que vai ganhar no dia 19 — e
 * decide se vale a pena voltar.
 */
export function CasaDoCalendario({ dia, premio, marco, estado, maiorDoMes, tamanho }: Props) {
  const apagada = estado === 'LOCKED' || estado === 'MISSED';
  return (
    <View
      style={[
        estilos.casa,
        { width: tamanho, height: tamanho * 1.22 },
        marco && estilos.casaDeMarco,
        estado === 'AVAILABLE' && estilos.casaAberta,
      ]}
      accessibilityRole="image"
      accessibilityLabel={`Dia ${dia}, ${premio.toLocaleString('pt-BR')} fichas, ${COMO_SE_LE[estado]}`}
    >
      <Image
        source={seloDoEstado(estado)}
        style={[StyleSheet.absoluteFill, apagada && estilos.apagado]}
        resizeMode="contain"
      />
      {marco && (
        <Image
          source={RECOMPENSA.cofreDoMes}
          style={[estilos.cofre, apagada && estilos.apagado]}
          resizeMode="contain"
        />
      )}
      <Text style={[estilos.dia, apagada && estilos.textoApagado]}>{dia}</Text>
      <Image
        source={pilhaPara(premio, maiorDoMes)}
        style={[estilos.pilha, apagada && estilos.apagado]}
        resizeMode="contain"
      />
      <Text style={[estilos.premio, apagada && estilos.textoApagado]} numberOfLines={1} adjustsFontSizeToFit>
        {curto(premio)}
      </Text>
      {estado === 'MISSED' && <Text style={estilos.perdido}>perdido</Text>}
    </View>
  );
}

const estilos = StyleSheet.create({
  casa: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
  },
  casaDeMarco: { borderWidth: 1, borderColor: colors.goldDeep },
  casaAberta: { borderWidth: 2, borderColor: colors.goldBright },
  /*
   * DESSATURAR E APAGAR, e não esconder: o dia perdido continua visível, com o valor que
   * ele teria pago. Sumir com ele deixaria buraco na grade e esconderia o custo de faltar.
   */
  apagado: { opacity: 0.32 },
  textoApagado: { color: colors.textFaint },
  cofre: { position: 'absolute', top: 0, right: 0, width: '38%', height: '38%' },
  dia: { fontFamily: fontFamily.displayBold, fontSize: fontSize.sm, color: colors.textPrimary },
  pilha: { width: '52%', height: '34%', marginVertical: 2 },
  premio: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.xs, color: colors.goldBright, paddingHorizontal: 2 },
  perdido: { fontFamily: fontFamily.body, fontSize: 9, color: colors.danger },
});
