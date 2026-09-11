import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type PacoteDeFichas, fetchMinhaLoja, fetchVitrine } from '../api/store';
import { ApiError, mensagemParaOJogador } from '../api/client';
import { colors, fontFamily, fontSize, spacing } from '../theme';
import { CasinoCard } from '../components/CasinoCard';
import { Fundo } from '../components/Fundo';
import { FUNDOS } from '../data/artePorTela';
import { GoldButton } from '../components/GoldButton';

/**
 * A LOJA DE FICHAS.
 *
 * ELA PASSOU A PERGUNTAR AO SERVIDOR. Era uma lista escrita no aplicativo
 * (`data/chipPackages.ts`) com quatro números fixos, e nunca falava com a loja de verdade
 * — então mostrava "120.000 fichas" para todo mundo enquanto o servidor entregava outra
 * coisa, e o preço na tela não tinha relação com o pacote creditado.
 *
 * O QUE MUDOU NO NÚMERO: o pacote agora sai do DEGRAU em que a pessoa joga. Os mesmos
 * R$ 149,90 compram 2.400 apostas mínimas em qualquer mesa — antes compravam uma banca
 * inteira no Bronze e NEM UMA APOSTA no Rubi.
 *
 * E É POR ISSO QUE "APOSTAS MÍNIMAS" ESTÁ NA TELA, em cima do número de fichas: "40.000
 * fichas" não diz nada sozinho. "800 rodadas na sua mesa" diz tudo.
 */
export function StoreScreen() {
  const [pacotes, setPacotes] = useState<PacoteDeFichas[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetchMinhaLoja()
      .then(setPacotes)
      /*
       * Sem sessão (ou com ela expirada), cai na vitrine pública — que é a do Bronze, e é
       * honesta: é exatamente o que uma conta nova recebe. Mostrar a vitrine do degrau
       * mais alto para atrair seria anunciar um pacote que quem chega não vai receber.
       */
      .catch(() =>
        fetchVitrine()
          .then(setPacotes)
          .catch((e: unknown) =>
            setErro(mensagemParaOJogador(e, 'Não foi possível falar com o servidor.')),
          ),
      );
  }, []);

  const degrau = pacotes?.[0]?.degrau;
  const bonus = pacotes?.[0]?.bonusDeNivel ?? 1;

  return (
    /* O cofre de ouro é o fundo da loja desde que a arte foi feita; só faltava alguém
       desenhar. O escurecido por cima é o que mantém o texto legível sobre a foto. */
    <Fundo source={FUNDOS.loja} style={styles.fundo}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <Text style={styles.title}>Loja de fichas</Text>
        <Text style={styles.subtitle}>
          Fichas são só pra jogar dentro do Casino Inova — não têm valor de saque.
        </Text>

        {degrau && (
          <Text style={styles.contexto}>
            Mesa {degrau.nome} · aposta mínima {degrau.minimo.toLocaleString('pt-BR')}
            {bonus > 1 && ` · seu nível rende ${bonus.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}× em fichas`}
          </Text>
        )}

        {!pacotes && !erro && <ActivityIndicator color={colors.goldBright} style={styles.carregando} />}
        {erro && <Text style={styles.erro}>{erro}</Text>}

        {pacotes && (
          <FlatList
            data={pacotes}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <CasinoCard style={styles.packageCard}>
                <View style={styles.packageInfo}>
                  <Text style={styles.packageChips}>{item.chips.toLocaleString('pt-BR')} fichas</Text>
                  <Text style={styles.packageRodadas}>
                    {item.apostasMinimas.toLocaleString('pt-BR')} apostas mínimas na sua mesa
                  </Text>
                  {item.promocao && (
                    <Text style={styles.packageBonus}>
                      {item.promocao.nome}: +{item.promocao.bonusPercent}% · termina em{' '}
                      {item.promocao.terminaEm.split('-').reverse().join('/')}
                    </Text>
                  )}
                </View>
                <GoldButton label={item.precoEscrito} onPress={() => {}} />
              </CasinoCard>
            )}
          />
        )}
      </SafeAreaView>
    </Fundo>
  );
}

const styles = StyleSheet.create({
  fundo: { flex: 1 },
  container: { flex: 1, backgroundColor: 'rgba(6,9,8,0.62)', paddingHorizontal: spacing.xl },
  title: { fontFamily: fontFamily.displayBold, fontSize: fontSize.xl, color: colors.textPrimary, marginTop: spacing.lg },
  subtitle: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textFaint, marginTop: spacing.xs },
  contexto: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.goldBright, marginTop: spacing.sm, marginBottom: spacing.md },
  carregando: { marginTop: spacing.xl },
  erro: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.danger, marginTop: spacing.lg },
  list: { gap: spacing.md, paddingBottom: spacing.xxxl },
  packageCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  packageInfo: { gap: spacing.xs, flex: 1, paddingRight: spacing.md },
  packageChips: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.md, color: colors.textPrimary },
  packageRodadas: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textSecondary },
  packageBonus: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.xs, color: colors.success },
});
