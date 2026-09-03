import { useEffect, useState } from 'react';
import {
  View, Text, Image, StyleSheet, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { cadastrar, entrar, provedoresDisponiveis } from '../api/auth';
import { googleEstaConfigurado } from '../firebase/config';
import { useLoginGoogle } from '../firebase/loginSocial';
import { ApiError } from '../api/client';
import { GoldButton } from '../components/GoldButton';
import { FUNDOS, MARCA } from '../data/artePorTela';
import { colors, fontFamily, fontSize, radius, spacing } from '../theme';
import { Fundo } from '../components/Fundo';

type Modo = 'entrar' | 'cadastrar';

export function LoginScreen({ aoEntrar }: { aoEntrar: () => void }) {
  const [modo, setModo] = useState<Modo>('entrar');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  /*
   * O botão do Google só aparece quando as DUAS pontas estão prontas: o servidor com a
   * chave de serviço (senão ele recusa o token) e o app com os ids de cliente OAuth
   * (senão nem abre a tela do Google). Mostrar um botão que sempre dá erro é pior do
   * que não mostrar botão.
   */
  const [servidorAceitaGoogle, setServidorAceitaGoogle] = useState(false);
  const google = useLoginGoogle();
  const mostrarGoogle = servidorAceitaGoogle && googleEstaConfigurado();

  useEffect(() => {
    provedoresDisponiveis().then((lista) => setServidorAceitaGoogle(lista.includes('google')));
  }, []);

  // A resposta do Google chega depois que o navegador fecha, não no retorno da chamada.
  useEffect(() => {
    if (google.resposta?.type !== 'success') return;
    setOcupado(true);
    google
      .concluir()
      .then((usuario) => {
        if (usuario) aoEntrar();
      })
      .catch((capturado) => {
        setErro(capturado instanceof ApiError ? capturado.message : 'Não deu pra entrar com o Google.');
      })
      .finally(() => setOcupado(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [google.resposta]);

  const enviar = async () => {
    if (ocupado) return;
    setErro(null);
    setOcupado(true);
    try {
      if (modo === 'entrar') {
        await entrar(email, senha);
      } else {
        await cadastrar(nome, email, senha);
      }
      aoEntrar();
    } catch (capturado) {
      setErro(capturado instanceof ApiError ? capturado.message : 'Não deu pra falar com o servidor.');
    } finally {
      setOcupado(false);
    }
  };

  const podeEnviar =
    email.trim().length > 0 && senha.length > 0 && (modo === 'entrar' || nome.trim().length > 0);

  return (
    /* A entrada do cassino — tapete vermelho e lustres — é o fundo desta tela desde
       que a arte foi feita. Estava usando a foto do salão, que é a do lobby: duas telas
       diferentes com a mesma imagem, e uma foto parada na pasta. */
    <Fundo source={FUNDOS.entrada} style={styles.fundo} resizeMode="cover">
      <LinearGradient
        colors={['rgba(11,15,13,0.75)', colors.background]}
        locations={[0, 0.8]}
        style={StyleSheet.absoluteFillObject}
      />
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {/* A marca é a logo desenhada, não o nome escrito com a fonte do sistema. */}
            <Image
              source={MARCA.logo}
              style={styles.logo}
              resizeMode="contain"
              accessible
              accessibilityRole="image"
              accessibilityLabel="Casino Inova"
            />
            <Text style={styles.subtitulo}>
              {modo === 'entrar' ? 'Entre pra continuar de onde parou.' : 'Crie sua conta e comece a jogar.'}
            </Text>

            <View style={styles.abas}>
              {(['entrar', 'cadastrar'] as Modo[]).map((item) => (
                <Pressable
                  key={item}
                  onPress={() => { setModo(item); setErro(null); }}
                  style={[styles.aba, modo === item && styles.abaAtiva]}
                >
                  <Text style={[styles.abaTexto, modo === item && styles.abaTextoAtivo]}>
                    {item === 'entrar' ? 'Entrar' : 'Criar conta'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {modo === 'cadastrar' && (
              <Campo rotulo="Como quer ser chamado" valor={nome} aoMudar={setNome} autoCapitalize="words" />
            )}
            <Campo
              rotulo="E-mail"
              valor={email}
              aoMudar={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Campo rotulo="Senha" valor={senha} aoMudar={setSenha} secureTextEntry />
            {modo === 'cadastrar' && <Text style={styles.dica}>Pelo menos 8 caracteres.</Text>}

            {erro && <Text style={styles.erro}>{erro}</Text>}

            <GoldButton
              label={modo === 'entrar' ? 'Entrar' : 'Criar conta'}
              onPress={enviar}
              disabled={!podeEnviar || ocupado}
            />
            {ocupado && <ActivityIndicator color={colors.goldBright} style={styles.carregando} />}

            {mostrarGoogle && (
              <>
                <View style={styles.separador}>
                  <View style={styles.linha} />
                  <Text style={styles.separadorTexto}>ou</Text>
                  <View style={styles.linha} />
                </View>
                <Pressable
                  onPress={() => google.pedirLogin()}
                  disabled={ocupado}
                  style={[styles.botaoGoogle, ocupado && { opacity: 0.5 }]}
                >
                  <Text style={styles.botaoGoogleTexto}>Entrar com Google</Text>
                </Pressable>
              </>
            )}

            <Text style={styles.rodape}>
              Fichas do Casino Inova são só pra jogar aqui dentro. Não há saque, e nenhum jogo paga
              dinheiro de verdade.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Fundo>
  );
}

function Campo({
  rotulo, valor, aoMudar, ...resto
}: {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.campo}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <TextInput
        value={valor}
        onChangeText={aoMudar}
        style={styles.input}
        placeholderTextColor={colors.textFaint}
        autoCorrect={false}
        {...resto}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { padding: spacing.xl, gap: spacing.md, justifyContent: 'center', flexGrow: 1 },
  logo: { width: 200, height: 200, alignSelf: 'center', marginBottom: -18 },
  marca: { fontFamily: fontFamily.displayBold, fontSize: fontSize.xxl, color: colors.goldBright, textAlign: 'center' },
  subtitulo: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  abas: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: spacing.sm,
  },
  aba: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.pill, alignItems: 'center' },
  abaAtiva: { backgroundColor: colors.felt },
  abaTexto: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.textFaint },
  abaTextoAtivo: { color: colors.textPrimary },
  campo: { gap: 4 },
  rotulo: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
    color: colors.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  input: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.feltLine,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  dica: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },
  erro: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.danger },
  separador: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.sm },
  linha: { flex: 1, height: 1, backgroundColor: colors.feltLine },
  separadorTexto: { fontFamily: fontFamily.body, fontSize: fontSize.xs, color: colors.textFaint },
  botaoGoogle: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.feltLine,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  botaoGoogleTexto: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.base, color: colors.textPrimary },
  carregando: { marginTop: spacing.sm },
  rodape: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: spacing.xl,
    lineHeight: 16,
  },
});
