import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import { ApiError } from '../api/client';
import { PessoaAchada, concederFichas, extratoDe, procurarPessoa, LancamentoDoExtrato } from '../api/admin';
import { formatarCodigo } from '../api/perfil';
import { avatarEscolhido } from '../data/artePorTela';
import { usePlayer } from '../data/usePlayer';
import { CasinoCard } from '../components/CasinoCard';
import { GoldButton } from '../components/GoldButton';
import { colors, fontFamily, fontSize, radius, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Painel'>;

/** Valores que o suporte dá com mais frequência. Um toque em vez de digitar. */
const ATALHOS = [1_000, 10_000, 100_000, 1_000_000];

const MOTIVOS = ['Teste', 'Suporte', 'Compensação', 'Promoção'];

/**
 * Painel de administração.
 *
 * A tela confere o papel de quem abriu, mas isso é só cortesia: QUEM DECIDE É O
 * SERVIDOR. Toda rota daqui passa por `requirePermission` lá, e um jogador comum que
 * chegue nesta tela por qualquer caminho leva 403 em cada botão. Esconder a porta não é
 * a tranca — a tranca é a fechadura do outro lado.
 *
 * A busca aceita e-mail, id ou código público porque cada um aparece numa situação
 * diferente: o e-mail é o que a pessoa diz quando pede ajuda, o código é o que ela lê no
 * próprio perfil, e o id é o que aparece num registro de erro.
 */
export function AdminScreen({ navigation }: Props) {
  const { jogador } = usePlayer();
  const [termo, setTermo] = useState('');
  const [achada, setAchada] = useState<PessoaAchada | null>(null);
  const [extrato, setExtrato] = useState<LancamentoDoExtrato[] | null>(null);
  const [fichas, setFichas] = useState('');
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [recado, setRecado] = useState<string | null>(null);

  const podeEntrar = jogador?.role === 'admin' || jogador?.role === 'moderador';

  const rodar = async (acao: () => Promise<void>) => {
    if (ocupado) return;
    setOcupado(true);
    setErro(null);
    try {
      await acao();
    } catch (caught) {
      setErro(caught instanceof ApiError ? caught.message : 'Não deu pra falar com o servidor.');
    } finally {
      setOcupado(false);
    }
  };

  const procurar = () =>
    rodar(async () => {
      if (!termo.trim()) return;
      setExtrato(null);
      setRecado(null);
      setAchada(await procurarPessoa(termo.trim()));
    });

  const dar = () =>
    rodar(async () => {
      if (!achada) return;
      const quantas = Number(fichas.replace(/\D/g, ''));
      if (!Number.isInteger(quantas) || quantas <= 0) {
        setErro('Informe quantas fichas, em número inteiro.');
        return;
      }
      const feito = await concederFichas(achada.usuario.id, quantas, motivo);
      setRecado(`${quantas.toLocaleString('pt-BR')} fichas pra ${feito.targetName}. Saldo agora: ${feito.newBalance.toLocaleString('pt-BR')}.`);
      setFichas('');
      setAchada({ ...achada, balance: feito.newBalance });
    });

  const verExtrato = () =>
    rodar(async () => {
      if (!achada) return;
      setExtrato(await extratoDe(achada.usuario.id));
    });

  if (!podeEntrar) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Cabecalho aoVoltar={() => navigation.goBack()} />
        <Text style={styles.negado}>Esta área é da administração.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Cabecalho aoVoltar={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.rolagem} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <CasinoCard style={styles.cartao}>
          <Text style={styles.titulo}>Procurar jogador</Text>
          <Text style={styles.ajuda}>Pelo e-mail, pelo código do perfil (0000-0000) ou pelo id.</Text>
          <View style={styles.linhaDeBusca}>
            <TextInput
              value={termo}
              onChangeText={setTermo}
              placeholder="e-mail, código ou id"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={procurar}
              style={styles.campo}
              editable={!ocupado}
            />
            <GoldButton label="Buscar" onPress={procurar} style={styles.botaoBuscar} />
          </View>
        </CasinoCard>

        {ocupado && <ActivityIndicator color={colors.goldBright} style={{ marginTop: spacing.md }} />}
        {erro && <Text style={styles.erro}>{erro}</Text>}

        {achada && (
          <>
            <CasinoCard style={styles.cartao}>
              <View style={styles.pessoaLinha}>
                <Image
                  source={avatarEscolhido(achada.usuario.avatar, achada.usuario.id)}
                  style={styles.retrato}
                  resizeMode="cover"
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.pessoaNome}>{achada.usuario.name}</Text>
                  <Text style={styles.pessoaDetalhe} selectable>
                    {formatarCodigo(achada.usuario.publicCode)} · nível {achada.usuario.level} · {achada.usuario.role}
                  </Text>
                  {achada.emails.map((email) => (
                    <Text key={email} style={styles.pessoaEmail} selectable numberOfLines={1}>{email}</Text>
                  ))}
                </View>
              </View>
              <View style={styles.saldoCaixa}>
                <Text style={styles.saldoNumero}>{achada.balance.toLocaleString('pt-BR')}</Text>
                <Text style={styles.saldoRotulo}>fichas</Text>
              </View>
            </CasinoCard>

            <CasinoCard style={styles.cartao}>
              <Text style={styles.titulo}>Dar fichas</Text>
              <View style={styles.atalhos}>
                {ATALHOS.map((valor) => (
                  <Pressable
                    key={valor}
                    onPress={() => setFichas(String(valor))}
                    accessibilityRole="button"
                    accessibilityLabel={`${valor} fichas`}
                    style={[styles.atalho, Number(fichas) === valor && styles.atalhoEscolhido]}
                  >
                    <Text style={styles.atalhoTexto}>
                      {valor >= 1_000_000 ? `${valor / 1_000_000}M` : `${valor / 1_000}k`}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={fichas}
                onChangeText={(t) => setFichas(t.replace(/\D/g, ''))}
                placeholder="quantas fichas"
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
                style={styles.campo}
                editable={!ocupado}
              />
              <View style={styles.atalhos}>
                {MOTIVOS.map((item) => (
                  <Pressable
                    key={item}
                    onPress={() => setMotivo(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Motivo: ${item}`}
                    style={[styles.atalho, motivo === item && styles.atalhoEscolhido]}
                  >
                    <Text style={styles.atalhoTexto}>{item}</Text>
                  </Pressable>
                ))}
              </View>
              <GoldButton label={`Dar fichas pra ${achada.usuario.name}`} onPress={dar} style={{ marginTop: spacing.md }} />
              {recado && <Text style={styles.recado}>{recado}</Text>}
              <Text style={styles.ajuda}>
                Fica no extrato como lançamento de suporte, com o motivo. Nada aqui apaga nada — a carteira só
                recebe entradas novas.
              </Text>
            </CasinoCard>

            <CasinoCard style={styles.cartao}>
              <Pressable onPress={verExtrato} accessibilityRole="button" style={styles.linhaExtrato}>
                <Text style={styles.titulo}>Extrato</Text>
                <Ionicons name={extrato ? 'refresh' : 'chevron-down'} size={18} color={colors.textSecondary} />
              </Pressable>
              {extrato?.length === 0 && <Text style={styles.ajuda}>Nenhum lançamento ainda.</Text>}
              {extrato?.slice(0, 40).map((linha, indice) => (
                <View key={`${linha.createdAt}-${indice}`} style={styles.lancamento}>
                  <Text style={[styles.lancamentoValor, linha.amount >= 0 ? styles.entrou : styles.saiu]}>
                    {linha.amount >= 0 ? '+' : ''}{linha.amount.toLocaleString('pt-BR')}
                  </Text>
                  <Text style={styles.lancamentoMotivo} numberOfLines={1}>
                    {linha.reason}{linha.gameId ? ` · ${linha.gameId}` : ''}
                  </Text>
                  <Text style={styles.lancamentoData}>
                    {new Date(linha.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              ))}
            </CasinoCard>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Cabecalho({ aoVoltar }: { aoVoltar: () => void }) {
  return (
    <View style={styles.cabecalho}>
      <Pressable onPress={aoVoltar} accessibilityRole="button" accessibilityLabel="Voltar" hitSlop={12}>
        <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
      </Pressable>
      <Text style={styles.cabecalhoTitulo}>Painel</Text>
      <View style={{ width: 26 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  cabecalhoTitulo: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.lg, color: colors.textPrimary },
  rolagem: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl * 2, gap: spacing.md },
  cartao: { padding: spacing.lg, gap: spacing.sm },
  titulo: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.base, color: colors.textPrimary },
  ajuda: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },
  linhaDeBusca: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  campo: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
  },
  botaoBuscar: { paddingHorizontal: spacing.lg },
  erro: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.danger, paddingHorizontal: spacing.sm },
  recado: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, color: colors.success },

  pessoaLinha: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  retrato: { width: 56, height: 56, borderRadius: 28 },
  pessoaNome: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.lg, color: colors.textPrimary },
  pessoaDetalhe: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textSecondary },
  pessoaEmail: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },
  saldoCaixa: { alignItems: 'center', paddingTop: spacing.sm },
  saldoNumero: { fontFamily: fontFamily.displayBold, fontSize: 30, color: colors.goldBright },
  saldoRotulo: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },

  atalhos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  atalho: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(245,241,230,0.18)',
  },
  atalhoEscolhido: { borderColor: colors.goldBright, backgroundColor: 'rgba(212,175,55,0.12)' },
  atalhoTexto: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, color: colors.textPrimary },

  linhaExtrato: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lancamento: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  lancamentoValor: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, minWidth: 92 },
  entrou: { color: colors.success },
  saiu: { color: colors.danger },
  lancamentoMotivo: { flex: 1, fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textSecondary },
  lancamentoData: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },

  negado: { fontFamily: fontFamily.body, fontSize: fontSize.base, color: colors.textSecondary, padding: spacing.xl },
});
