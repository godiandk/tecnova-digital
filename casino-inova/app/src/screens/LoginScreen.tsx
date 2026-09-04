import { useEffect, useState } from 'react';
import {
  View, Text, Image, StyleSheet, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { cadastrar, entrar, provedoresDisponiveis } from '../api/auth';
import { DocumentoLegal, fetchDocumento } from '../api/legal';
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
  const [nomeCompleto, setNomeCompleto] = useState('');
  /** Guardada em três pedaços porque é assim que se digita — e assim não tem que acertar traço nenhum. */
  const [nascDia, setNascDia] = useState('');
  const [nascMes, setNascMes] = useState('');
  const [nascAno, setNascAno] = useState('');
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [documentoAberto, setDocumentoAberto] = useState<'termos' | 'privacidade' | null>(null);
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
        await cadastrar({
          nome,
          nomeCompleto,
          email,
          senha,
          nascimento: dataDeNascimento,
          aceitouTermos,
        });
      }
      aoEntrar();
    } catch (capturado) {
      setErro(capturado instanceof ApiError ? capturado.message : 'Não deu pra falar com o servidor.');
    } finally {
      setOcupado(false);
    }
  };

  /**
   * A data em AAAA-MM-DD, que é o formato que o servidor aceita.
   *
   * Só este formato lá porque "10/03/1990" é ambíguo — 10 de março ou 3 de outubro? — e
   * a resposta errada muda a idade de alguém em meses. Aqui a pessoa digita em três
   * caixas rotuladas, e a montagem acontece uma vez, neste ponto.
   */
  const dataDeNascimento = `${nascAno.padStart(4, '0')}-${nascMes.padStart(2, '0')}-${nascDia.padStart(2, '0')}`;
  const dataCompleta = nascDia.length >= 1 && nascMes.length >= 1 && nascAno.length === 4;

  const podeEnviar =
    email.trim().length > 0 &&
    senha.length > 0 &&
    (modo === 'entrar' ||
      (nome.trim().length > 0 && nomeCompleto.trim().length >= 3 && dataCompleta && aceitouTermos));

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
              <>
                <Campo rotulo="Seu nome completo" valor={nomeCompleto} aoMudar={setNomeCompleto} autoCapitalize="words" />
                <Campo rotulo="Apelido no jogo" valor={nome} aoMudar={setNome} maxLength={20} />
                <Text style={styles.dica}>É o nome que aparece na mesa, no chat e no ranking.</Text>

                {/*
                  A DATA EM TRÊS CAMPOS, e não num campo só com máscara.
                  Máscara de data no celular é o campo que mais dá erro: o teclado troca,
                  o traço some, e "10/03" fica ambíguo entre março e outubro. Três caixas
                  de número não têm nenhum desses problemas — e o rótulo diz a ordem.
                */}
                <Text style={styles.rotuloDoGrupo}>Data de nascimento</Text>
                <View style={styles.linhaDaData}>
                  <CampoCurto rotulo="Dia" valor={nascDia} aoMudar={setNascDia} tamanho={2} />
                  <CampoCurto rotulo="Mês" valor={nascMes} aoMudar={setNascMes} tamanho={2} />
                  <CampoCurto rotulo="Ano" valor={nascAno} aoMudar={setNascAno} tamanho={4} largo />
                </View>
                <Text style={styles.dica}>É preciso ter 18 anos ou mais pra jogar aqui.</Text>
              </>
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

            {modo === 'cadastrar' && (
              <Pressable
                onPress={() => setAceitouTermos((v) => !v)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: aceitouTermos }}
                accessibilityLabel="Li e aceito os termos de uso e a política de privacidade"
                style={styles.linhaDoAceite}
              >
                <View style={[styles.caixaDeAceite, aceitouTermos && styles.caixaMarcada]}>
                  {aceitouTermos && <Ionicons name="checkmark" size={16} color={colors.background} />}
                </View>
                <Text style={styles.textoDoAceite}>
                  Li e aceito os{' '}
                  <Text style={styles.linkLegal} onPress={() => setDocumentoAberto('termos')}>
                    termos de uso
                  </Text>{' '}
                  e a{' '}
                  <Text style={styles.linkLegal} onPress={() => setDocumentoAberto('privacidade')}>
                    política de privacidade
                  </Text>
                  .
                </Text>
              </Pressable>
            )}

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

      {/*
        Os documentos abrem POR CIMA da tela de cadastro, sem sair dela: ler os termos
        não pode custar o que já foi digitado. É por isso que é uma folha e não uma tela.
      */}
      <FolhaDoDocumento qual={documentoAberto} aoFechar={() => setDocumentoAberto(null)} />
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

/**
 * Uma caixinha de número, pra um pedaço da data.
 *
 * Só aceita dígito: filtrar aqui é o que impede uma letra colada de virar uma data que
 * o servidor recusa depois de a pessoa ter preenchido o resto. E `maxLength` faz o
 * teclado do celular não deixar passar do tamanho.
 */
function CampoCurto({
  rotulo,
  valor,
  aoMudar,
  tamanho,
  largo,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  tamanho: number;
  largo?: boolean;
}) {
  return (
    <View style={[styles.campo, largo ? styles.campoCurtoLargo : styles.campoCurto]}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <TextInput
        value={valor}
        onChangeText={(t) => aoMudar(t.replace(/\D/g, '').slice(0, tamanho))}
        style={styles.input}
        keyboardType="number-pad"
        maxLength={tamanho}
        placeholder={'0'.repeat(tamanho)}
        placeholderTextColor={colors.textFaint}
        autoCorrect={false}
      />
    </View>
  );
}

/**
 * Os termos de uso ou a política de privacidade, abertos por cima da tela de cadastro.
 *
 * O texto vem do SERVIDOR, e não está escrito dentro do aplicativo: corrigir uma frase
 * passaria a exigir versão nova do app, e quem não atualizasse continuaria concordando
 * com o texto velho sem saber.
 */
function FolhaDoDocumento({
  qual,
  aoFechar,
}: {
  qual: 'termos' | 'privacidade' | null;
  aoFechar: () => void;
}) {
  const [documento, setDocumento] = useState<DocumentoLegal | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!qual) return;
    setDocumento(null);
    setErro(null);
    fetchDocumento(qual)
      .then(setDocumento)
      .catch(() => setErro('Não deu pra carregar o documento agora. Tente de novo.'));
  }, [qual]);

  return (
    <Modal visible={qual !== null} animationType="slide" transparent onRequestClose={aoFechar}>
      <View style={styles.folhaFundo}>
        <SafeAreaView style={styles.folha} edges={['bottom']}>
          <View style={styles.folhaTopo}>
            <Text style={styles.folhaTitulo}>{documento?.titulo ?? 'Carregando...'}</Text>
            <Pressable onPress={aoFechar} accessibilityRole="button" accessibilityLabel="Fechar" hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.folhaTexto} showsVerticalScrollIndicator>
            {erro && <Text style={styles.erro}>{erro}</Text>}
            {!documento && !erro && <ActivityIndicator color={colors.goldBright} />}
            {documento && <Markdown texto={documento.texto} />}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

/**
 * O markdown do documento, desenhado sem biblioteca.
 *
 * São só quatro formas: título, item de lista, linha em branco e parágrafo. Trazer um
 * interpretador de markdown inteiro pra isso somaria peso ao aplicativo e uma
 * dependência nova pra manter — e os documentos são escritos por nós, então o que eles
 * usam é o que está aqui.
 */
function Markdown({ texto }: { texto: string }) {
  const linhas = texto.split('\n');
  return (
    <>
      {linhas.map((linha, i) => {
        const limpa = linha.trim();
        if (!limpa) return <View key={i} style={{ height: spacing.sm }} />;
        // A régua "---" vira um respiro maior, não um traço: traço em texto corrido polui.
        if (/^-{3,}$/.test(limpa)) return <View key={i} style={{ height: spacing.lg }} />;

        const nivel = /^(#{1,3})\s/.exec(limpa)?.[1].length ?? 0;
        if (nivel > 0) {
          return (
            <Text key={i} style={[styles.docTitulo, nivel === 1 && styles.docTituloGrande]}>
              {semMarcas(limpa.replace(/^#+\s*/, ''))}
            </Text>
          );
        }
        if (/^[-*]\s/.test(limpa)) {
          return (
            <Text key={i} style={styles.docItem}>
              {'\u2022  '}
              {semMarcas(limpa.replace(/^[-*]\s*/, ''))}
            </Text>
          );
        }
        // Linha de tabela: mostrada como texto simples, sem as barras.
        if (limpa.startsWith('|')) {
          if (/^\|[\s|:-]+\|$/.test(limpa)) return null;
          return (
            <Text key={i} style={styles.docItem}>
              {semMarcas(limpa.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()).join(' — '))}
            </Text>
          );
        }
        return (
          <Text key={i} style={styles.docParagrafo}>
            {semMarcas(limpa)}
          </Text>
        );
      })}
    </>
  );
}

/** Tira os asteriscos e as crases do markdown — o negrito vira texto normal. */
function semMarcas(linha: string): string {
  return linha.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/`(.+?)`/g, '$1');
}

const styles = StyleSheet.create({
  /* --- a folha do documento --- */
  folhaFundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  folha: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    height: '88%',
  },
  folhaTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  folhaTitulo: { flex: 1, fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.lg, color: colors.textPrimary },
  folhaTexto: { paddingBottom: spacing.xl * 2 },
  docTitulo: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
    color: colors.goldBright,
    marginTop: spacing.md,
    marginBottom: 2,
  },
  docTituloGrande: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.lg, color: colors.textPrimary },
  docParagrafo: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 21 },
  docItem: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 21,
    paddingLeft: spacing.sm,
  },

  /* --- data de nascimento em três caixas --- */
  rotuloDoGrupo: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  linhaDaData: { flexDirection: 'row', gap: spacing.sm },
  campoCurto: { flex: 1 },
  campoCurtoLargo: { flex: 1.6 },

  /* --- a caixinha dos termos --- */
  linhaDoAceite: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  caixaDeAceite: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  caixaMarcada: { backgroundColor: colors.goldBright, borderColor: colors.goldBright },
  textoDoAceite: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  linkLegal: { color: colors.goldBright, textDecorationLine: 'underline' },
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
