import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { TAMPOS_16X9 } from '../../data/tamposDaMesa';
import {
  MAPA_BANCA_FRANCESA,
  TAMANHO_DA_FICHA_NO_PANO,
  TAMANHO_DA_FICHA_NO_TRILHO,
  FICHA_MINIMA_NO_PANO,
  FICHA_MINIMA_NO_TRILHO,
  FICHA_MAXIMA_NO_TRILHO,
} from '../../data/mapaDosTampos';
import { TampoDaMesa, usePalco } from '../../components/TampoDaMesa';
import { CasaDeAposta, PilhaNaCasa } from '../../components/CasaDeAposta';
import { TrilhoDeFichas } from '../../components/TrilhoDeFichas';
import { PilhaDeFichas } from '../../components/Ficha';
import { Dado } from '../../components/Dado';
import { ChipStack } from '../../components/ChipStack';
import { decomporEmFichas, pilhaEmPalavras } from '../../data/fichasDeValor';
import { PlayerColor } from '../../data/chipImages';
import { BancaFrancesaBet, BancaFrancesaBetType } from '../../api/bancaFrancesa';
import { TableView } from '../../api/bancaFrancesaMesa';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme';

/*
 * A ordem importa duas vezes.
 *
 * Na tela, a LINHA é desenhada por último porque a faixa dela cruza a de Pequeno: na
 * parte em que as duas se sobrepõem, quem ganha o toque é a última desenhada, e ali o
 * lugar é da Linha — é o traço entre os arcos, e é exatamente onde a ficha da Linha vai
 * numa mesa de verdade.
 *
 * Na leitura, esta é também a ordem em que as casas são anunciadas por leitor de tela.
 */
const CASAS = ['ases', 'grande', 'pequeno', 'linha'] as const;

type Apostas = Record<BancaFrancesaBetType, number[]>;
const MESA_LIMPA: Apostas = { ases: [], grande: [], pequeno: [], linha: [] };
const soma = (fichas: number[]) => fichas.reduce((t, f) => t + f, 0);

const NOME_DO_RESULTADO: Record<string, string> = { ases: 'Ases', pequeno: 'Pequeno', grande: 'Grande' };

interface PanoProps {
  mesa: TableView;
  meuId: string | null;
  ehAnfitriao: boolean;
  ocupado: boolean;
  saldo: number;
  minimo: number;
  maximo: number;
  /** Devolve se a aposta foi aceita — é o que decide se a montagem some ou fica. */
  onApostar: (bets: BancaFrancesaBet[]) => Promise<boolean>;
  onGirar: () => Promise<unknown>;
  onSair: () => void;
  onAbrirPainel: () => void;
  erro?: string | null;
  aviso?: string | null;
}

/**
 * Banca Francesa jogada NA MESA.
 *
 * A tela antiga usava a foto do pano como papel de parede e a jogada acontecia numa
 * lista de cartões rolável: quatro azulejos escritos "Pequeno / 5, 6 ou 7", um − e um +
 * pra escolher o valor, e os três dados como números dentro de quadradinhos. Aqui a
 * pessoa pega uma ficha do trilho e encosta no PANO, na casa que já está desenhada na
 * arte, e os dados são lançados dentro da tigela de couro onde eles são lançados.
 *
 * E numa mesa cheia dá pra ver de quem é cada pilha, que é o ponto de existir mesa
 * cheia: cada pessoa sentada recebeu do servidor uma cor que mais ninguém ali tem, e a
 * pilha dela sai naquela cor, no lugar dela dentro da casa.
 */
export function PanoDaBancaFrancesa({
  mesa,
  meuId,
  ehAnfitriao,
  ocupado,
  saldo,
  minimo,
  maximo,
  onApostar,
  onGirar,
  onSair,
  onAbrirPainel,
  erro,
  aviso,
}: PanoProps) {
  const meuLugar = mesa.seats.find((s) => s.userId === meuId);
  const minhaCor = meuLugar?.color;

  const [ficha, setFicha] = useState(minimo);
  const [apostas, setApostas] = useState<Apostas>(MESA_LIMPA);
  const [ordem, setOrdem] = useState<BancaFrancesaBetType[]>([]);
  const [anterior, setAnterior] = useState<Apostas | null>(null);
  const [recado, setRecado] = useState<string | null>(null);

  useEffect(() => setFicha(minimo), [minimo]);

  const total = useMemo(() => CASAS.reduce((t, c) => t + soma(apostas[c]), 0), [apostas]);
  const abaixoDoMinimo = useMemo(
    () => CASAS.filter((c) => apostas[c].length > 0 && soma(apostas[c]) < minimo),
    [apostas, minimo],
  );

  /* --- o lançamento: chacoalho fantasma, depois os dados de verdade --- */
  const rodada = mesa.lastRound;
  const { dados, girando, hesitando } = useLancamento(rodada);

  /* Rodada nova chegou: o que estava só encostado já foi pro servidor, a mesa limpa. */
  const marcaDaRodada = rodada?.at;
  useEffect(() => {
    if (!marcaDaRodada) return;
    setApostas(MESA_LIMPA);
    setOrdem([]);
  }, [marcaDaRodada]);

  const travado = ocupado || girando;

  const encostar = (casa: BancaFrancesaBetType) => {
    if (travado) return;
    if (total + ficha > saldo) return setRecado('Você não tem fichas suficientes pra essa.');
    if (soma(apostas[casa]) + ficha > maximo) {
      return setRecado(`O máximo por casa é ${maximo.toLocaleString('pt-BR')}.`);
    }
    setRecado(null);
    setApostas((atual) => ({ ...atual, [casa]: [...atual[casa], ficha] }));
    setOrdem((atual) => [...atual, casa]);
  };

  const desfazer = () => {
    if (travado || ordem.length === 0) return;
    const ultima = ordem[ordem.length - 1];
    setApostas((atual) => ({ ...atual, [ultima]: atual[ultima].slice(0, -1) }));
    setOrdem((atual) => atual.slice(0, -1));
    setRecado(null);
  };

  const limpar = () => {
    if (travado) return;
    setApostas(MESA_LIMPA);
    setOrdem([]);
    setRecado(null);
  };

  const repetir = () => {
    if (travado || !anterior) return;
    const custo = CASAS.reduce((t, c) => t + soma(anterior[c]), 0);
    if (custo > saldo) return setRecado('Você não tem fichas suficientes pra repetir.');
    setApostas(anterior);
    setOrdem(CASAS.flatMap((c) => anterior[c].map(() => c)));
    setRecado(null);
  };

  const apostar = async () => {
    if (travado || total === 0 || abaixoDoMinimo.length > 0) return;
    const montagem = apostas;
    const aceita = await onApostar(
      CASAS.filter((c) => montagem[c].length > 0).map((type) => ({ type, amount: soma(montagem[type]) })),
    );
    /*
     * Só desfaz a montagem se ela foi aceita. Aceita, quem manda a partir daqui é o
     * servidor: as fichas voltam pra tela dentro de `pendingBets` do meu lugar, e
     * manter a montagem local por cima faria a mesma aposta aparecer DUAS vezes na
     * casa. Recusada, a montagem fica onde está — a pessoa vê o erro e tenta de novo
     * sem ter que empilhar tudo outra vez.
     */
    if (!aceita) return;
    setApostas(MESA_LIMPA);
    setOrdem([]);
    setAnterior(montagem);
  };

  /**
   * As pilhas de uma casa, uma por pessoa.
   *
   * As dos outros vêm do servidor como um número só, então são reconstruídas em fichas.
   * As minhas ainda não confirmadas saem por cima das que já foram: a gente viu essas
   * serem montadas, e elas aparecem mais apagadas justamente porque ainda não estão
   * valendo — ficha encostada não é ficha apostada até o servidor dizer que é.
   */
  const pilhasDe = (casa: BancaFrancesaBetType): PilhaNaCasa[] => {
    const doServidor = mesa.seats
      .map((assento) => {
        const posto = assento.pendingBets.find((b) => b.type === casa);
        if (!posto || posto.amount <= 0) return null;
        return {
          chave: assento.userId,
          cor: assento.color,
          fichas: decomporEmFichas(posto.amount),
          confirmada: true,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);

    const minhas = apostas[casa].length > 0
      ? [{ chave: 'em-curso', cor: minhaCor, fichas: apostas[casa], confirmada: false }]
      : [];

    return [...doServidor, ...minhas].map((p) => ({
      chave: p.chave,
      desenhar: () => <PilhaNoPano fichas={p.fichas} cor={p.cor} confirmada={p.confirmada} />,
    }));
  };

  const rotuloDoBotao = () => {
    if (total === 0) return 'Encoste uma ficha no pano';
    if (abaixoDoMinimo.length > 0) return `Mínimo ${minimo.toLocaleString('pt-BR')} por casa`;
    return `Confirmar ${total.toLocaleString('pt-BR')}`;
  };
  const podeApostar = total > 0 && abaixoDoMinimo.length === 0 && !travado;

  return (
    <TampoDaMesa
      computador={TAMPOS_16X9['banca-francesa'].computador}
      tablet={TAMPOS_16X9['banca-francesa'].tablet}
    >
      {CASAS.map((casa) => (
        <CasaDeAposta
          key={casa}
          nome={casa}
          area={MAPA_BANCA_FRANCESA.apostas[casa]}
          valor={soma(apostas[casa])}
          descricao={pilhaEmPalavras(apostas[casa])}
          pilhas={pilhasDe(casa)}
          travada={travado}
          vencedora={venceu(casa, rodada?.outcome, Boolean(rodada) && !girando)}
          onPress={() => encostar(casa)}
        />
      ))}

      {/* Os três dados dentro da tigela de couro, onde eles são lançados. */}
      {(girando || rodada) &&
        MAPA_BANCA_FRANCESA.dados.map((ponto, indice) => (
          <DadoNaTigela
            key={indice}
            ponto={ponto}
            face={dados[indice] ?? null}
            rolando={girando || hesitando}
            indice={indice}
          />
        ))}

      <SafeAreaView style={styles.frente} edges={['top', 'bottom']} pointerEvents="box-none">
        <View style={styles.barraDeCima} pointerEvents="box-none">
          <BotaoRedondo icone="chevron-back" rotulo="Sair da mesa" onPress={onSair} />
          <ChipStack amount={saldo} />
          <BotaoRedondo
            icone="people"
            rotulo={`Quem está na mesa, ${mesa.seats.length} ${mesa.seats.length === 1 ? 'pessoa' : 'pessoas'}`}
            onPress={onAbrirPainel}
          />
        </View>

        <Avental>
          {erro && <Text style={styles.erro}>{erro}</Text>}
          {(recado || aviso) && <Text style={styles.aviso}>{recado ?? aviso}</Text>}

          {rodada && !girando && (
            <Text style={styles.placar}>
              {rodada.dice.join(' · ')} = {rodada.sum} → {NOME_DO_RESULTADO[rodada.outcome]}
              {rodada.rerolls > 0 &&
                ` · os dados voltaram pro copo ${rodada.rerolls}${rodada.rerolls === 1 ? ' vez' : ' vezes'} antes de decidir`}
            </Text>
          )}

          <View style={styles.linhaDoTrilho}>
            <View style={styles.ladoDoTrilho}>
              <BotaoRedondo icone="arrow-undo" rotulo="Desfazer a última ficha" onPress={desfazer} inativo={travado || ordem.length === 0} />
              <BotaoRedondo icone="trash-outline" rotulo="Limpar a mesa" onPress={limpar} inativo={travado || total === 0} />
            </View>
            <Trilho
              cor={minhaCor}
              selecionada={ficha}
              onSelecionar={(v) => {
                setFicha(v);
                setRecado(null);
              }}
              saldo={saldo - total}
              travado={travado}
              maximo={maximo}
            />
            <View style={styles.ladoDoTrilho}>
              <BotaoRedondo icone="repeat" rotulo="Repetir a aposta anterior" onPress={repetir} inativo={travado || !anterior} />
            </View>
          </View>

          <View style={styles.linhaDeBotoes}>
            <Pressable
              onPress={apostar}
              disabled={!podeApostar}
              accessibilityRole="button"
              accessibilityLabel={rotuloDoBotao()}
              accessibilityState={{ disabled: !podeApostar }}
              style={[styles.botaoPrincipal, !podeApostar && styles.desabilitado]}
            >
              {ocupado ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.botaoPrincipalTexto}>{rotuloDoBotao()}</Text>
              )}
            </Pressable>

            {/* Só o anfitrião lança — é ele quem faz o papel do dealer nesta mesa. */}
            {ehAnfitriao && (
              <Pressable
                onPress={onGirar}
                disabled={travado}
                accessibilityRole="button"
                accessibilityLabel="Lançar os dados"
                accessibilityState={{ disabled: travado }}
                style={[styles.botaoLancar, travado && styles.desabilitado]}
              >
                <Ionicons name="dice" size={22} color={colors.goldBright} />
                <Text style={styles.botaoLancarTexto}>Lançar</Text>
              </Pressable>
            )}
          </View>
        </Avental>
      </SafeAreaView>
    </TampoDaMesa>
  );
}

/** A casa que ganhou. A Linha ganha em tudo que não é Ases — metade em cada arco. */
function venceu(casa: BancaFrancesaBetType, resultado: string | undefined, mostrar: boolean) {
  if (!mostrar || !resultado) return false;
  return casa === 'linha' ? resultado !== 'ases' : casa === resultado;
}

/**
 * O tempo do lançamento.
 *
 * O servidor já decidiu tudo antes de a animação começar — os dados, a soma, quem
 * ganhou e quantas vezes eles voltaram pro copo. O que acontece aqui é só a encenação
 * do que já aconteceu, e ela é fiel: se o servidor relançou, os dados HESITAM antes de
 * assentar, porque relançar é regra do jogo e aconteceu de verdade.
 *
 * A hesitação é mostrada no máximo duas vezes mesmo quando o servidor relançou mais.
 * A média real é 216/63 ≈ 3,4 lançamentos até decidir, e a cauda não tem teto: mostrar
 * literalmente cada tentativa faria uma rodada azarada travar o jogo por segundos. Duas
 * já dizem "os dados custaram a decidir" — que é a informação — sem cobrar a paciência
 * de quem está na mesa.
 */
function useLancamento(rodada: TableView['lastRound']) {
  const [dados, setDados] = useState<number[]>([]);
  const [girando, setGirando] = useState(false);
  const [hesitando, setHesitando] = useState(false);
  const ultima = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!rodada || rodada.at === ultima.current) return;
    ultima.current = rodada.at;

    let vivo = true;
    const relogios: ReturnType<typeof setTimeout>[] = [];
    const espera = (ms: number) => new Promise<void>((ok) => relogios.push(setTimeout(ok, ms)));

    (async () => {
      setGirando(true);
      setDados([]);
      for (let i = 0; i < Math.min(rodada.rerolls, 2) && vivo; i += 1) {
        setHesitando(true);
        await espera(260);
        if (!vivo) return;
        setHesitando(false);
        await espera(120);
      }
      if (!vivo) return;
      // Só agora os dados sabem a face: o caminho é desenho, o resultado é sorteio.
      setDados(rodada.dice);
      await espera(TEMPO_ATE_ASSENTAR);
      if (vivo) setGirando(false);
    })();

    return () => {
      vivo = false;
      relogios.forEach(clearTimeout);
    };
  }, [rodada]);

  return { dados, girando, hesitando };
}

/** 2 × ATRASO_POR_DADO + VOO_EM_MS do <Dado> — quando o último dado para. */
const TEMPO_ATE_ASSENTAR = 1450;

function PilhaNoPano({
  fichas,
  cor,
  confirmada,
}: {
  fichas: number[];
  cor: PlayerColor | undefined;
  confirmada: boolean;
}) {
  const palco = usePalco();
  if (!palco) return null;
  return (
    <View style={confirmada ? undefined : styles.aindaNaoValendo}>
      <PilhaDeFichas fichas={fichas} cor={cor} tamanho={fichaNoPano(palco.largura)} />
    </View>
  );
}

function DadoNaTigela({
  ponto,
  face,
  rolando,
  indice,
}: {
  ponto: { x: number; y: number };
  face: number | null;
  rolando: boolean;
  indice: number;
}) {
  const palco = usePalco();
  if (!palco) return null;
  // A tigela tem 0.366 da largura do tampo; 5,5% deixa os três lado a lado com folga.
  const tamanho = Math.max(26, palco.largura * 0.055);
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: palco.esquerda + ponto.x * palco.largura - tamanho / 2,
        top: palco.topo + ponto.y * palco.altura - tamanho / 2,
      }}
    >
      <Dado face={face} rolando={rolando} indice={indice} tamanho={tamanho} />
    </View>
  );
}

function Trilho(props: {
  selecionada: number;
  onSelecionar: (valor: number) => void;
  cor: PlayerColor | undefined;
  saldo: number;
  travado: boolean;
  maximo: number;
}) {
  const palco = usePalco();
  return <TrilhoDeFichas {...props} tamanho={fichaNoTrilho(palco?.largura ?? 700)} />;
}

function Avental({ children }: { children: ReactNode }) {
  return (
    <View style={styles.avental} pointerEvents="box-none">
      <LinearGradient
        colors={['rgba(6,9,8,0)', 'rgba(6,9,8,0.86)', 'rgba(6,9,8,0.97)']}
        locations={[0, 0.35, 1]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

function BotaoRedondo({
  icone,
  rotulo,
  onPress,
  inativo,
}: {
  icone: keyof typeof Ionicons.glyphMap;
  rotulo: string;
  onPress: () => void;
  inativo?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={inativo}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ disabled: Boolean(inativo) }}
      hitSlop={8}
      style={[styles.botaoRedondo, inativo && styles.desabilitado]}
    >
      <Ionicons name={icone} size={24} color={colors.textPrimary} />
    </Pressable>
  );
}

function fichaNoPano(larguraDoTampo: number) {
  return Math.round(Math.max(FICHA_MINIMA_NO_PANO, larguraDoTampo * TAMANHO_DA_FICHA_NO_PANO));
}

function fichaNoTrilho(larguraDoTampo: number) {
  const bruto = larguraDoTampo * TAMANHO_DA_FICHA_NO_TRILHO;
  return Math.round(Math.min(FICHA_MAXIMA_NO_TRILHO, Math.max(FICHA_MINIMA_NO_TRILHO, bruto)));
}

const styles = StyleSheet.create({
  frente: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  barraDeCima: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  avental: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    alignItems: 'center',
  },
  botaoRedondo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,15,13,0.62)',
  },
  linhaDoTrilho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  ladoDoTrilho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minWidth: 104 },
  linhaDeBotoes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  botaoPrincipal: {
    minWidth: 210,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.goldBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoPrincipalTexto: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.base, color: colors.background },
  botaoLancar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: 'rgba(11,15,13,0.72)',
  },
  botaoLancarTexto: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.base, color: colors.goldBright },
  desabilitado: { opacity: 0.45 },
  /* Ficha encostada mas ainda não confirmada pelo servidor: está ali, não está valendo. */
  aindaNaoValendo: { opacity: 0.6 },
  placar: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    textAlign: 'center',
    backgroundColor: 'rgba(11,15,13,0.72)',
    borderRadius: radius.md,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
  },
  erro: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.danger, textAlign: 'center' },
  aviso: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.gold, textAlign: 'center' },
});
