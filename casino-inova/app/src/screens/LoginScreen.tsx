import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ImageBackground,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { cadastrar, entrar } from '../api/auth';
import { ApiError } from '../api/client';
import { GoldButton } from '../components/GoldButton';
import { colors, fontFamily, fontSize, radius, spacing } from '../theme';

type Modo = 'entrar' | 'cadastrar';

export function LoginScreen({ aoEntrar }: { aoEntrar: () => void }) {
  const [modo, setModo] = useState<Modo>('entrar');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

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
    <ImageBackground
      source={require('../../assets/images/backgrounds/lobby-fundo.jpg')}
      style={styles.fundo}
      resizeMode="cover"
    >
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
            <Text style={styles.marca}>Casino Inova</Text>
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

            <Text style={styles.rodape}>
              Fichas do Casino Inova são só pra jogar aqui dentro. Não há saque, e nenhum jogo paga
              dinheiro de verdade.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
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
