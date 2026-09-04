import { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, TextInput, ActivityIndicator, Dimensions, Pressable, ScrollView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import { usePlayer, perfilMudou } from '../data/usePlayer';
import { useJanela } from '../theme/useJanela';
import { atualizarPerfil, fetchAvatares, formatarCodigo } from '../api/perfil';
import { AVATARES_PADRAO, avatarEscolhido } from '../data/artePorTela';
import { fetchFriends } from '../api/friends';
import { sair } from '../api/auth';
import { ApiError } from '../api/client';
import { redeemCoupon } from '../api/coupons';
import { MOLDURAS_DE_AVATAR, SELO_VIP } from '../data/artePorTela';
import { colors, fontFamily, fontSize, radius, spacing } from '../theme';
import { CasinoCard } from '../components/CasinoCard';
import { LevelBar } from '../components/LevelBar';
import { GoldButton } from '../components/GoldButton';

const VIP_LABEL: Record<'bronze' | 'prata' | 'ouro' | 'diamante', string> = {
  bronze: 'Bronze',
  prata: 'Prata',
  ouro: 'Ouro',
  diamante: 'Diamante',
};

/**
 * Largura útil do cartão de nível: a tela menos a margem e o respiro do cartão.
 *
 * É uma função e não uma constante porque `Dimensions.get('window')` no topo do arquivo
 * mede A JANELA DA HORA EM QUE O ARQUIVO CARREGOU, e nunca mais. No celular isso quase
 * passa (a tela só muda ao girar); no navegador é errado desde o começo — redimensionar
 * a janela, girar o telefone ou a barra de endereço se recolher deixam a barra de nível
 * com a largura de outro tamanho de tela.
 */
const larguraDaBarra = (larguraDaJanela: number) =>
  Math.max(120, larguraDaJanela - spacing.xl * 2 - spacing.lg * 2);

/**
 * O perfil mora numa ABA, e o painel mora na pilha de cima.
 *
 * Por isso a navegação vem do `useNavigation` tipado com a pilha, e não da prop da tela:
 * a prop que esta tela recebe é a do navegador de abas, que não conhece a rota do
 * painel. O React Navigation resolve subindo pro navegador pai — o tipo aqui é só pra
 * dizer a verdade sobre pra onde se está indo.
 */
export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { jogador, recarregar } = usePlayer();
  const janela = useJanela();
  const [totalAmigos, setTotalAmigos] = useState(0);
  const [editando, setEditando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const [balance, setBalance] = useState(jogador?.chipBalance ?? 0);
  const [couponCode, setCouponCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [couponMessage, setCouponMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    fetchFriends()
      .then((amigos) => setTotalAmigos(amigos.length))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (jogador) setBalance(jogador.chipBalance);
  }, [jogador]);

  /*
   * Copiar sem dependência nova.
   *
   * `expo-clipboard` resolveria em uma linha, mas instalar um pacote nativo pra um botão
   * de copiar significa arriscar a construção que já está no ar. Na web o navegador já
   * sabe copiar; no celular o número fica selecionável (`selectable`), que é o gesto que
   * a pessoa já usa pra copiar qualquer texto do telefone.
   */
  const copiarCodigo = async () => {
    if (!jogador?.publicCode) return;
    const texto = formatarCodigo(jogador.publicCode);
    try {
      await (globalThis as { navigator?: { clipboard?: { writeText(t: string): Promise<void> } } })
        .navigator?.clipboard?.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sem área de transferência: o número continua selecionável na tela.
    }
  };

  const handleRedeem = async () => {
    if (!couponCode.trim() || redeeming) return;
    setRedeeming(true);
    setCouponMessage(null);
    try {
      const result = await redeemCoupon(couponCode.trim());
      setBalance(result.newBalance);
      setCouponMessage({ text: `Cupom resgatado — +${result.chips.toLocaleString('pt-BR')} fichas!`, ok: true });
      setCouponCode('');
    } catch (error) {
      setCouponMessage({ text: error instanceof ApiError ? error.message : 'Não foi possível resgatar agora.', ok: false });
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/*
        * O perfil ROLA. Sem isto, o que passa da altura da tela some — e passa: retrato,
        * nome, código, barra de nível, dois cartões, cupom, a porta do painel e o sair.
        * Num iPhone menor, "Sair da conta" ficava embaixo da barra de abas, existindo
        * mas sem jeito de alcançar.
        */}
      <ScrollView
        contentContainerStyle={styles.rolagem}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
      <View style={styles.headerBlock}>
        <Pressable onPress={() => setEditando(true)} accessibilityRole="button" accessibilityLabel="Trocar retrato e apelido">
          <Retrato id={jogador?.id} avatar={jogador?.avatar} nivel={jogador?.vipTier ?? 'bronze'} />
        </Pressable>

        <Pressable onPress={() => setEditando(true)} style={styles.linhaDoNome} accessibilityRole="button" accessibilityLabel="Trocar apelido">
          <Text style={styles.name}>{jogador?.name ?? ''}</Text>
          <Ionicons name="pencil" size={16} color={colors.textSecondary} />
        </Pressable>

        <View style={styles.vipPill}>
          <Text style={styles.vipLabel}>Clube {VIP_LABEL[jogador?.vipTier ?? 'bronze']}</Text>
        </View>

        {/*
          * O número que a pessoa diz pro suporte.
          *
          * Fica logo abaixo do nome porque é a segunda coisa que identifica alguém aqui —
          * dois jogadores podem escolher o mesmo apelido, mas o código é único. Vai
          * `selectable` pra dar pra copiar segurando o dedo, que é o gesto do celular.
          */}
        <Pressable onPress={copiarCodigo} style={styles.codigoCaixa} accessibilityRole="button" accessibilityLabel="Copiar meu código">
          <Text style={styles.codigoRotulo}>MEU CÓDIGO</Text>
          <Text style={styles.codigoNumero} selectable>{formatarCodigo(jogador?.publicCode)}</Text>
          <Ionicons name={copiado ? 'checkmark' : 'copy-outline'} size={16} color={copiado ? colors.goldBright : colors.textSecondary} />
        </Pressable>
      </View>

      <CasinoCard style={styles.levelCard}>
        <LevelBar
          level={jogador?.level ?? 1}
          xp={jogador?.xp ?? 0}
          xpToNextLevel={jogador?.xpToNextLevel ?? 500}
          width={larguraDaBarra(janela.width)}
        />
        <Text style={styles.levelLabel}>
          {jogador?.xp ?? 0} de {jogador?.xpToNextLevel ?? 500} XP pro nível {(jogador?.level ?? 1) + 1}
        </Text>
      </CasinoCard>

      <View style={styles.statsRow}>
        <CasinoCard style={styles.statCard}>
          <Text style={styles.statValue}>{balance.toLocaleString('pt-BR')}</Text>
          <Text style={styles.statLabel}>Fichas</Text>
        </CasinoCard>
        <CasinoCard style={styles.statCard}>
          <Text style={styles.statValue}>{totalAmigos}</Text>
          <Text style={styles.statLabel}>Amigos</Text>
        </CasinoCard>
      </View>

      <CasinoCard style={styles.couponCard}>
        <Text style={styles.couponTitle}>Resgatar cupom</Text>
        <Text style={styles.couponSubtitle}>Tem um código de promoção? Cole aqui pra receber as fichas.</Text>
        <View style={styles.couponRow}>
          <TextInput
            value={couponCode}
            onChangeText={setCouponCode}
            placeholder="CÓDIGO DO CUPOM"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="characters"
            autoCorrect={false}
            style={styles.couponInput}
            editable={!redeeming}
          />
          <GoldButton
            label={redeeming ? '...' : 'Resgatar'}
            onPress={handleRedeem}
            style={styles.couponButton}
          />
        </View>
        {redeeming && <ActivityIndicator color={colors.goldBright} style={{ marginTop: spacing.sm }} />}
        {couponMessage && (
          <Text style={[styles.couponMessage, couponMessage.ok ? styles.couponMessageOk : styles.couponMessageError]}>
            {couponMessage.text}
          </Text>
        )}
      </CasinoCard>

      {/*
        * A entrada do painel só existe pra quem pode entrar.
        *
        * Esconder não é a segurança — quem manda é a permissão conferida no servidor, e
        * um jogador comum que descubra a rota leva 403. Isto aqui é só não mostrar uma
        * porta que não abre.
        */}
      {(jogador?.role === 'admin' || jogador?.role === 'moderador') && (
        <Pressable
          onPress={() => navigation.navigate('Painel')}
          style={styles.painelBotao}
          accessibilityRole="button"
          accessibilityLabel="Abrir o painel de administração"
        >
          <Ionicons name="shield-checkmark" size={20} color={colors.goldBright} />
          <View style={{ flex: 1 }}>
            <Text style={styles.painelTitulo}>Painel de administração</Text>
            <Text style={styles.painelSubtitulo}>
              {jogador.role === 'admin' ? 'Procurar jogador, dar fichas, ver extrato' : 'Ferramentas de moderação'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>
      )}

      <Pressable onPress={sair} style={styles.sairBotao}>
        <Text style={styles.sairTexto}>Sair da conta</Text>
      </Pressable>
      </ScrollView>

      {/* A folha fica FORA da rolagem: modal dentro de ScrollView herda a rolagem dela. */}
      <FolhaDeEdicao
        visivel={editando}
        nomeAtual={jogador?.name ?? ''}
        avatarAtual={jogador?.avatar ?? null}
        idDoJogador={jogador?.id}
        aoFechar={() => setEditando(false)}
        aoSalvar={async (nome, avatar) => {
          const novo = await atualizarPerfil({ name: nome, avatar });
          perfilMudou({ name: novo.name, avatar: novo.avatar });
          setEditando(false);
        }}
      />
    </SafeAreaView>
  );
}

/**
 * Trocar apelido e retrato.
 *
 * Os retratos são os que já vêm no aplicativo, e a lista de quais existem vem do
 * SERVIDOR — não daqui. Se cada versão do aplicativo tivesse a sua lista, uma versão
 * antiga poderia gravar um nome que a nova não desenha, e a pessoa ficaria com um perfil
 * sem rosto sem ter feito nada.
 */
function FolhaDeEdicao({
  visivel,
  nomeAtual,
  avatarAtual,
  idDoJogador,
  aoFechar,
  aoSalvar,
}: {
  visivel: boolean;
  nomeAtual: string;
  avatarAtual: string | null;
  idDoJogador?: string;
  aoFechar: () => void;
  aoSalvar: (nome: string, avatar: string) => Promise<void>;
}) {
  const [nome, setNome] = useState(nomeAtual);
  const [avatar, setAvatar] = useState<string | null>(avatarAtual);
  const [avatares, setAvatares] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!visivel) return;
    setNome(nomeAtual);
    setAvatar(avatarAtual);
    setErro(null);
    fetchAvatares().then(setAvatares).catch(() => setAvatares([]));
  }, [visivel, nomeAtual, avatarAtual]);

  const salvar = async () => {
    if (salvando) return;
    const limpo = nome.trim();
    if (limpo.length < 2) return setErro('O apelido precisa ter pelo menos 2 letras.');
    setSalvando(true);
    setErro(null);
    try {
      await aoSalvar(limpo, avatar ?? avatares[0] ?? 'avatar-1');
    } catch (caught) {
      setErro(caught instanceof ApiError ? caught.message : 'Não deu pra salvar agora.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal visible={visivel} animationType="slide" transparent onRequestClose={aoFechar}>
      <View style={styles.folhaFundo}>
        <SafeAreaView style={styles.folha} edges={['bottom']}>
          <View style={styles.folhaTopo}>
            <Text style={styles.folhaTitulo}>Seu perfil</Text>
            <Pressable onPress={aoFechar} accessibilityRole="button" accessibilityLabel="Fechar" hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }} showsVerticalScrollIndicator={false}>
            <Text style={styles.campoRotulo}>Apelido no jogo</Text>
            <TextInput
              value={nome}
              onChangeText={setNome}
              maxLength={20}
              placeholder="Como querem te chamar"
              placeholderTextColor={colors.textFaint}
              style={styles.campo}
              editable={!salvando}
            />
            <Text style={styles.campoAjuda}>Até 20 letras. É o nome que aparece na mesa, no chat e no ranking.</Text>

            <Text style={[styles.campoRotulo, { marginTop: spacing.lg }]}>Retrato</Text>
            <View style={styles.gradeDeRetratos}>
              {(avatares.length > 0 ? avatares : AVATARES_PADRAO.map((_, i) => `avatar-${i + 1}`)).map((nomeDoRetrato) => {
                const escolhido = (avatar ?? avatarAtual) === nomeDoRetrato;
                return (
                  <Pressable
                    key={nomeDoRetrato}
                    onPress={() => setAvatar(nomeDoRetrato)}
                    accessibilityRole="button"
                    accessibilityLabel={`Escolher o retrato ${nomeDoRetrato.replace('avatar-', '')}`}
                    accessibilityState={{ selected: escolhido }}
                    style={[styles.opcaoDeRetrato, escolhido && styles.opcaoEscolhida]}
                  >
                    <Image
                      source={avatarEscolhido(nomeDoRetrato, idDoJogador)}
                      style={styles.retratoPequeno}
                      resizeMode="cover"
                    />
                  </Pressable>
                );
              })}
            </View>

            {erro && <Text style={styles.folhaErro}>{erro}</Text>}

            <GoldButton label={salvando ? 'Salvando...' : 'Salvar'} onPress={salvar} style={{ marginTop: spacing.lg }} />
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

/**
 * O retrato da pessoa, dentro da moldura do clube dela.
 *
 * Antes daqui existia uma caixa cinza vazia com uma borda dourada — e, parada na pasta,
 * uma folha com seis retratos e outra com quatro molduras, uma por nível do clube. A
 * moldura não é enfeite: ela é o nível. Quem sobe de bronze pra prata VÊ a diferença no
 * próprio rosto, que é pra isso que quatro anéis diferentes foram desenhados.
 */
function Retrato({
  id,
  avatar,
  nivel,
}: {
  id?: string;
  avatar?: string | null;
  nivel: 'bronze' | 'prata' | 'ouro' | 'diamante';
}) {
  return (
    <View
      style={styles.retrato}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Foto do perfil, com a moldura do clube ${VIP_LABEL[nivel]}`}
    >
      <Image source={avatarEscolhido(avatar, id)} style={styles.rosto} resizeMode="cover" />
      <Image source={MOLDURAS_DE_AVATAR[nivel]} style={styles.moldura} resizeMode="contain" />
      <Image source={SELO_VIP} style={styles.selo} resizeMode="contain" />
    </View>
  );
}

/** O rosto ocupa 74% do anel: é o vão que a moldura desenhada deixa livre no meio. */
const LADO_DO_RETRATO = 112;
const VAO_DA_MOLDURA = 0.74;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  /* O respiro embaixo é pra o último item não nascer colado na barra de abas. */
  rolagem: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl * 2 },

  /* --- identidade: apelido editável e o código público --- */
  linhaDoNome: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  codigoCaixa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(245,241,230,0.14)',
  },
  codigoRotulo: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint, letterSpacing: 1 },
  codigoNumero: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.base, color: colors.textPrimary, letterSpacing: 1 },

  /* --- a porta do painel, que só aparece pra quem pode entrar --- */
  painelBotao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: 'rgba(212,175,55,0.08)',
  },
  painelTitulo: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.base, color: colors.goldBright },
  painelSubtitulo: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textSecondary },

  /* --- a folha de editar perfil --- */
  folhaFundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
  folha: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    maxHeight: '86%',
  },
  folhaTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  folhaTitulo: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.lg, color: colors.textPrimary },
  campoRotulo: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.xs },
  campo: {
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
  },
  campoAjuda: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint, marginTop: spacing.xs },
  gradeDeRetratos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  opcaoDeRetrato: { borderRadius: 999, borderWidth: 2, borderColor: 'transparent', padding: 2 },
  opcaoEscolhida: { borderColor: colors.goldBright },
  retratoPequeno: { width: 64, height: 64, borderRadius: 32 },
  folhaErro: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.danger, marginTop: spacing.md },
  headerBlock: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  retrato: { width: LADO_DO_RETRATO, height: LADO_DO_RETRATO, alignItems: 'center', justifyContent: 'center' },
  rosto: {
    width: LADO_DO_RETRATO * VAO_DA_MOLDURA,
    height: LADO_DO_RETRATO * VAO_DA_MOLDURA,
    borderRadius: (LADO_DO_RETRATO * VAO_DA_MOLDURA) / 2,
  },
  moldura: { position: 'absolute', width: LADO_DO_RETRATO, height: LADO_DO_RETRATO },
  /* O selo POUSA na moldura, encostado nela — broche preso no anel, não medalha
     pendurada ao lado. Por isso ele entra um pouco pra dentro do círculo. */
  selo: { position: 'absolute', right: 2, bottom: 8, width: 30, height: 30 },
  name: { fontFamily: fontFamily.displayBold, fontSize: fontSize.xl, color: colors.textPrimary },
  vipPill: { backgroundColor: colors.backgroundElevated, borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: spacing.md },
  vipLabel: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.xs, color: colors.goldBright },
  levelCard: { marginBottom: spacing.lg, gap: spacing.sm, alignItems: 'center' },
  sairBotao: { marginTop: spacing.xl, alignSelf: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.xl },
  sairTexto: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, color: colors.danger },
  levelLabel: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.xs, color: colors.textFaint },
  statsRow: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.lg },
  statCard: { flex: 1, alignItems: 'center', gap: spacing.xs },
  statValue: { fontFamily: fontFamily.displayBold, fontSize: fontSize.lg, color: colors.textPrimary },
  statLabel: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },
  couponCard: { gap: spacing.xs },
  couponTitle: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.md, color: colors.textPrimary },
  couponSubtitle: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint, marginBottom: spacing.sm },
  couponRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  couponInput: {
    flex: 1,
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.feltLine,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  couponButton: { paddingHorizontal: spacing.lg },
  couponMessage: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.xs, marginTop: spacing.sm },
  couponMessageOk: { color: colors.success },
  couponMessageError: { color: colors.danger },
});
