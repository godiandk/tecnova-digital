import { StyleSheet, Pressable, Text, View } from 'react-native';

import { Ficha } from './Ficha';
import { FICHAS_VISIVEIS_NA_PILHA, PASSO_DA_PILHA } from '../theme/medidasDaMesa';
import { colors, fontFamily } from '../theme';

export type ZonaDoBacara = 'jogador' | 'banca' | 'empate';

/**
 * O PANO DO BACARÁ — onde a ficha encosta.
 *
 * O QUE ESTAVA ERRADO, e dá pra ver no retrato de celular (`verificacao/retratos-antes`):
 * a tela mostrava a fotografia de uma mesa de bacará de verdade, com PLAYER, BANKER e TIE
 * impressos no pano em doze lugares, e por cima dela três pílulas de texto —
 * "Jogador · ×2", "Banca · ×1,95", "Empate · ×9" — com um rótulo "SUA APOSTA" e um botão
 * "Apostar". O jogador escolhia num formulário, em cima de uma mesa onde as casas já
 * estavam desenhadas e eram só enfeite.
 *
 * POR QUE O PANO É DESENHADO, e não recortado da foto: pelo mesmo motivo da roleta, e por
 * um a mais. A foto tem as casas de DOZE lugares, cada uma do tamanho de um selo — numa
 * tela de 390 pontos, tocar a caixa "BANKER" do assento 7 seria mirar em 30 pixels. Aqui
 * joga UMA pessoa, e uma pessoa ocupa uma posição inteira. As três casas desenhadas são a
 * posição dela, no tamanho de quem realmente vai encostar o dedo.
 *
 * A DISPOSIÇÃO É A DA MESA: empate por cima, atravessando as duas, e jogador e banca lado
 * a lado embaixo. É assim em qualquer pano de bacará do mundo, e é o que faz quem já jogou
 * reconhecer a mesa antes de ler qualquer palavra.
 *
 * A FICHA FICA NA CASA. Não é um número escrito num painel: é pilha de ficha dentro do
 * retângulo em que ela foi encostada, do mesmo jeito que na banca francesa e na roleta.
 */
interface PanoProps {
  /** Onde a ficha está encostada. Nulo = nada na mesa ainda. */
  escolhida: ZonaDoBacara | null;
  /** Quanto está encostado. Zero desenha a casa vazia. */
  valor: number;
  /** Quem ganhou a rodada que acabou de sair, pra acender a casa. */
  venceu: ZonaDoBacara | null;
  /** Enquanto as cartas correm, ninguém mexe a ficha. */
  travado: boolean;
  onEncostar: (zona: ZonaDoBacara) => void;
}

/** O que cada casa paga, escrito como a mesa escreve. */
const PAGAMENTO: Record<ZonaDoBacara, string> = {
  jogador: 'PAGA 1 : 1',
  banca: 'PAGA 0,95 : 1',
  empate: 'PAGA 8 : 1',
};

const NOME: Record<ZonaDoBacara, string> = {
  jogador: 'JOGADOR',
  banca: 'BANCA',
  empate: 'EMPATE',
};

export function PanoDoBacara({ escolhida, valor, venceu, travado, onEncostar }: PanoProps) {
  const casa = (zona: ZonaDoBacara, estilo: object) => (
    <Pressable
      onPress={() => !travado && onEncostar(zona)}
      disabled={travado}
      accessibilityRole="button"
      accessibilityState={{ selected: escolhida === zona, disabled: travado }}
      accessibilityLabel={
        escolhida === zona && valor > 0
          ? `${NOME[zona]}, ${PAGAMENTO[zona]}, com ${valor.toLocaleString('pt-BR')} fichas suas`
          : `Apostar em ${NOME[zona]}, ${PAGAMENTO[zona]}`
      }
      style={[
        estilos.casa,
        estilo,
        escolhida === zona && estilos.casaEscolhida,
        venceu === zona && estilos.casaVencedora,
        travado && estilos.travada,
      ]}
    >
      <Text style={estilos.nome}>{NOME[zona]}</Text>
      <Text style={estilos.pagamento}>{PAGAMENTO[zona]}</Text>
      {escolhida === zona && valor > 0 && <PilhaNaCasa valor={valor} />}
    </Pressable>
  );

  return (
    <View style={estilos.pano}>
      {casa('empate', estilos.empate)}
      <View style={estilos.linhaDeBaixo}>
        {casa('jogador', estilos.metade)}
        {casa('banca', estilos.metade)}
      </View>
    </View>
  );
}

/**
 * A pilha de fichas dentro da casa.
 *
 * Quantas fichas aparecem não é a quantidade apostada — é a ALTURA da pilha, que cresce
 * com a aposta e para em cinco. Uma pilha de mil fichas desenhadas seria uma torre saindo
 * da mesa; cinco fichas com o valor gravado na de cima é como uma mesa de verdade mostra
 * qualquer aposta.
 */
function PilhaNaCasa({ valor }: { valor: number }) {
  const quantas = Math.max(1, Math.min(FICHAS_VISIVEIS_NA_PILHA, Math.ceil(Math.log10(Math.max(10, valor)))));
  const TAMANHO = 30;
  return (
    <View style={[estilos.pilha, { height: TAMANHO + (quantas - 1) * PASSO_DA_PILHA * TAMANHO }]}>
      {Array.from({ length: quantas }, (_, i) => (
        <View
          key={i}
          style={[estilos.fichaDaPilha, { bottom: i * PASSO_DA_PILHA * TAMANHO }]}
          pointerEvents="none"
        >
          <Ficha valor={valor} cor={undefined} tamanho={TAMANHO} mostrarValor={i === quantas - 1} />
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  pano: { width: '100%', gap: 8 },
  linhaDeBaixo: { flexDirection: 'row', gap: 8 },
  metade: { flex: 1 },
  empate: { width: '100%' },

  /*
   * A CASA É UM LUGAR NO PANO, e não um botão.
   *
   * FELTRO OPACO, e isso foi decidido olhando o retrato. Com fundo translúcido, as caixas
   * PLAYER/BANKER/TIE impressas na fotografia apareciam POR DENTRO das nossas casas —
   * duas mesas de bacará sobrepostas, cada uma com suas linhas. Véu nenhum resolve isso
   * sem apagar a mesa inteira, porque o impresso é dourado sobre verde, de alto contraste.
   *
   * Uma casa de aposta numa mesa de verdade é feltro, não vidro. Pintando de feltro, ela
   * cobre o que estiver embaixo, e a fotografia volta a fazer o que faz bem: o couro da
   * borda, a madeira, a luz do salão e as cadeiras em volta.
   *
   * Borda dourada fina como a linha pintada de uma mesa, e canto pouco arredondado — pano
   * de cassino é reto. O que distingue a casa escolhida não é cor de "botão ativo": é a
   * linha ficar grossa e dourada, que é o que o crupiê faz ao marcar a casa.
   */
  casa: {
    minHeight: 74,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.feltLine,
    backgroundColor: colors.felt,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 2,
  },
  casaEscolhida: { borderWidth: 2, borderColor: colors.goldBright, backgroundColor: '#12603C' },
  casaVencedora: { borderWidth: 2, borderColor: colors.goldBright, backgroundColor: colors.feltBright },
  travada: { opacity: 0.7 },

  nome: { fontFamily: fontFamily.displayBold, fontSize: 15, letterSpacing: 1.5, color: colors.goldBright },
  pagamento: { fontFamily: fontFamily.body, fontSize: 10, letterSpacing: 1, color: colors.textFaint },

  pilha: { marginTop: 4, width: 30, alignItems: 'center', justifyContent: 'flex-end' },
  fichaDaPilha: { position: 'absolute' },
});
