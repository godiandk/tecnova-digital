import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { type CalendarioDeRecompensa, coletarRecompensa, fetchCalendarioDeRecompensa } from '../api/recompensas';
import { ApiError } from '../api/client';
import { RECOMPENSA } from '../data/recompensaAssets';
import { chaveDeColeta } from '../data/chaveDeColeta';
import { usePlayer } from '../data/usePlayer';
import { useRootNavigation } from '../navigation/useRootNavigation';
import { colors, fontFamily, fontSize, radius, spacing } from '../theme';

/**
 * O AVISO DE RECOMPENSA QUE APARECE AO ENTRAR.
 *
 * ELE NÃO COLETA SOZINHO, e isso é decisão registrada: a pessoa toca COLETAR. Um prêmio
 * que cai sozinho na tela de abertura vira ruído — ninguém lê, ninguém lembra do que
 * recebeu, e a sequência deixa de ser uma escolha de voltar pra virar um efeito colateral
 * de abrir o aplicativo. Tocar o botão é o que faz a recompensa significar alguma coisa.
 *
 * E DÁ PRA FECHAR SEM COLETAR. O prêmio continua lá o dia inteiro; quem abriu o jogo com
 * pressa coleta depois, pelo calendário. Modal que só fecha depois de aceitar é propaganda,
 * não recompensa.
 *
 * APARECE UMA VEZ POR DIA. Depois de coletado — ou de dispensado — ele não volta na mesma
 * sessão, porque o que decide é o próprio servidor: `podeColetar` fica falso e o aviso não
 * tem mais motivo pra existir.
 */
export function ModalDeRecompensa() {
  const [calendario, setCalendario] = useState<CalendarioDeRecompensa | null>(null);
  const [aberto, setAberto] = useState(false);
  const [coletando, setColetando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ganho, setGanho] = useState<number | null>(null);
  const jaPerguntou = useRef(false);
  const { recarregar } = usePlayer();
  const navigation = useRootNavigation();

  useEffect(() => {
    /*
     * UMA PERGUNTA POR MONTAGEM. Sem esta trava, qualquer re-render dispararia outra
     * consulta — e o aviso reabriria depois de a pessoa ter fechado.
     */
    if (jaPerguntou.current) return;
    jaPerguntou.current = true;
    fetchCalendarioDeRecompensa()
      .then((c) => {
        setCalendario(c);
        if (c.podeColetar) setAberto(true);
      })
      .catch(() => {
        /*
         * Falhou a consulta: NÃO mostra nada. Um aviso de recompensa que aparece sem saber
         * se há recompensa é pior que nenhum aviso — e o calendário continua alcançável
         * pelo menu.
         */
      });
  }, []);

  const coletar = async () => {
    if (!calendario || coletando) return;
    setColetando(true);
    setErro(null);
    try {
      const feita = await coletarRecompensa(chaveDeColeta(calendario.hoje));
      setGanho(feita.premio);
      setCalendario(feita.calendario);
      recarregar();
    } catch (e: unknown) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível coletar agora.');
    } finally {
      setColetando(false);
    }
  };

  if (!calendario) return null;

  return (
    <Modal visible={aberto} transparent animationType="fade" onRequestClose={() => setAberto(false)}>
      <View style={estilos.fundo}>
        <View style={estilos.cartao}>
          {/*
            O BRILHO SÓ APARECE DEPOIS DE COLETAR, e é isso que o torna honesto: ele
            celebra uma coisa que ACONTECEU. Brilho antes do toque seria a tela encenando
            um prêmio que a pessoa ainda não tem.
          */}
          {ganho !== null && (
            <Image source={RECOMPENSA.brilho} style={estilos.brilho} resizeMode="contain" />
          )}
          <Image
            source={ganho !== null ? RECOMPENSA.seloColetado : RECOMPENSA.seloAberto}
            style={estilos.selo}
            resizeMode="contain"
          />

          <Text style={estilos.titulo}>
            {ganho !== null ? 'Recompensa coletada' : `Dia ${calendario.diaAtual} liberado`}
          </Text>
          <Text style={estilos.valor}>
            {(ganho ?? calendario.premioDeHoje).toLocaleString('pt-BR')} fichas
          </Text>
          <Text style={estilos.detalhe}>
            {ganho !== null
              ? `Sequência de ${calendario.diasSeguidos} ${calendario.diasSeguidos === 1 ? 'dia' : 'dias'}. Volte amanhã para o próximo.`
              : `Nível ${calendario.nivel} · ${calendario.bonusDeNivel.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}× no prêmio`}
          </Text>

          {erro && <Text style={estilos.erro}>{erro}</Text>}

          {ganho === null ? (
            <Pressable
              onPress={coletar}
              disabled={coletando}
              accessibilityRole="button"
              style={[estilos.botao, coletando && estilos.botaoDesligado]}
            >
              {coletando ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={estilos.botaoTexto}>COLETAR</Text>
              )}
            </Pressable>
          ) : (
            <Pressable onPress={() => setAberto(false)} accessibilityRole="button" style={estilos.botao}>
              <Text style={estilos.botaoTexto}>JOGAR</Text>
            </Pressable>
          )}

          <View style={estilos.rodape}>
            <Pressable
              onPress={() => {
                setAberto(false);
                navigation.navigate('RecompensaDiaria');
              }}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text style={estilos.link}>Ver o mês inteiro</Text>
            </Pressable>
            <Pressable onPress={() => setAberto(false)} accessibilityRole="button" hitSlop={8}>
              <Text style={estilos.link}>{ganho === null ? 'Agora não' : 'Fechar'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  cartao: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.goldDeep,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  brilho: { position: 'absolute', top: -30, width: 260, height: 260, opacity: 0.85 },
  selo: { width: 108, height: 108 },
  titulo: { fontFamily: fontFamily.displayBold, fontSize: fontSize.lg, color: colors.textPrimary, textAlign: 'center' },
  valor: { fontFamily: fontFamily.displayExtraBold, fontSize: fontSize.xl, color: colors.goldBright },
  detalhe: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  erro: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.danger, textAlign: 'center' },
  botao: {
    minHeight: 52,
    alignSelf: 'stretch',
    borderRadius: radius.md,
    backgroundColor: colors.goldBright,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  botaoDesligado: { opacity: 0.6 },
  botaoTexto: { fontFamily: fontFamily.displayBold, fontSize: fontSize.md, color: colors.background },
  rodape: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch', marginTop: spacing.xs },
  link: { fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textFaint },
});
