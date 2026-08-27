import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';

import { GanhoRecente, ganhosRecentes } from '../api/lobby';
import { games } from '../data/games';
import { colors, fontFamily, fontSize, radius, spacing } from '../theme';

/** De quanto em quanto tempo a fita troca de ganhador. */
const TROCA_EM_MS = 4200;

/** De quanto em quanto tempo busca a lista de novo no servidor. */
const RECARGA_EM_MS = 60_000;

/**
 * A fita de ganhos do salão.
 *
 * É o painel de "fulano ganhou tanto" que todo cassino tem na parede — e aqui ele é de
 * verdade: sai do extrato, com ganho líquido, nome de quem ganhou e quanto tempo faz.
 * Quando não tem ninguém ganhando alto, a fita simplesmente não aparece. O documento
 * docs/design-atencao-visual.md explica por que essa foi a linha.
 */
export function FitaDeGanhos() {
  const [ganhos, setGanhos] = useState<GanhoRecente[]>([]);
  const [atual, setAtual] = useState(0);

  useEffect(() => {
    let vivo = true;
    const buscar = () => {
      ganhosRecentes()
        .then((lista) => vivo && setGanhos(lista))
        // Fita é enfeite: se o servidor não responder, ela some e o salão segue.
        .catch(() => vivo && setGanhos([]));
    };
    buscar();
    const recarga = setInterval(buscar, RECARGA_EM_MS);
    return () => {
      vivo = false;
      clearInterval(recarga);
    };
  }, []);

  useEffect(() => {
    if (ganhos.length < 2) return;
    const troca = setInterval(() => setAtual((i) => (i + 1) % ganhos.length), TROCA_EM_MS);
    return () => clearInterval(troca);
  }, [ganhos.length]);

  if (ganhos.length === 0) return null;

  const ganho = ganhos[atual % ganhos.length];

  return (
    <View style={styles.fita}>
      <View style={styles.selo}>
        <Ionicons name="flame" size={13} color={colors.goldBright} />
      </View>
      {/*
        A chave força o Reanimated a remontar a linha a cada troca, que é o que faz a
        anterior subir e a nova entrar por baixo — sem isso o texto trocaria seco.
      */}
      <Animated.View
        key={`${ganho.jogador}-${ganho.quando}`}
        entering={FadeInDown.duration(320)}
        exiting={FadeOutUp.duration(220)}
        style={styles.linha}
      >
        <Text style={styles.texto} numberOfLines={1}>
          <Text style={styles.nome}>{ganho.jogador}</Text>
          <Text> ganhou </Text>
          <Text style={styles.valor}>{ganho.valor.toLocaleString('pt-BR')}</Text>
          <Text>{` no ${nomeDoJogo(ganho.jogo)} ${faz(ganho.quando)}`}</Text>
        </Text>
      </Animated.View>
    </View>
  );
}

/** O ledger guarda o id do jogo; a fita mostra o nome que a pessoa vê no cartaz. */
function nomeDoJogo(id: string): string {
  return games.find((jogo) => jogo.id === id)?.name ?? id;
}

function faz(quando: string): string {
  const minutos = Math.round((Date.now() - new Date(quando).getTime()) / 60000);
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  return `há ${horas} h`;
}

const styles = StyleSheet.create({
  fita: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 34,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: 'rgba(229,181,103,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(229,181,103,0.28)',
  },
  selo: { justifyContent: 'center' },
  linha: { flex: 1, justifyContent: 'center' },
  texto: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textSecondary },
  nome: { fontFamily: fontFamily.bodySemiBold, color: colors.textPrimary },
  valor: { fontFamily: fontFamily.displayBold, color: colors.goldBright },
});
