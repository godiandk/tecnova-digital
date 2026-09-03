import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { TAMPOS_16X9 } from '../../data/tamposDaMesa';
import { MAPA_BANCA_FRANCESA } from '../../data/mapaDosTampos';
import { dadoNaTigela, fichaNoPano, fichaNoTrilho, telaBaixa } from '../../theme/medidasDaMesa';
import { TampoDaMesa, usePalco } from '../../components/TampoDaMesa';
import { useJanela } from '../../theme/useJanela';
import { CasaDeAposta, PilhaNaCasa } from '../../components/CasaDeAposta';
import { TrilhoDeFichas } from '../../components/TrilhoDeFichas';
import { PilhaDeFichas } from '../../components/Ficha';
import { Dado } from '../../components/Dado';
import { ChipStack } from '../../components/ChipStack';
import { QuadroDePagamentos, LinhaDePagamento } from '../../components/QuadroDePagamentos';
import { decomporEmFichas, pilhaEmPalavras } from '../../data/fichasDeValor';
import { PlayerColor } from '../../data/chipImages';
import { BancaFrancesaBet, BancaFrancesaBetType, BancaFrancesaConfig } from '../../api/bancaFrancesa';
import { TableView } from '../../api/bancaFrancesaMesa';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme';

/*
 * A ordem importa duas vezes.
 *
 * Na tela, as LINHAS são desenhadas por último porque a faixa de cada uma fica dentro
 * da faixa do centro do mesmo arco — é o círculo impresso, que na arte está em cima do
 * traço de baixo. Onde as duas se cruzam quem ganha o toque é a última desenhada, e ali
 * o lugar é da linha.
 *
 * Na leitura, esta é também a ordem em que as casas são anunciadas por leitor de tela.
 */
const CASAS = ['ases', 'grande', 'pequeno', 'linha-grande', 'linha-pequeno'] as const;

/** Só estas são divididas ao meio, e por isso só estas precisam de valor par. */
const LINHAS: BancaFrancesaBetType[] = ['linha-grande', 'linha-pequeno'];

type Apostas = Record<BancaFrancesaBetType, number[]>;
const MESA_LIMPA: Apostas = { ases: [], grande: [], pequeno: [], 'linha-grande': [], 'linha-pequeno': [] };
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
  /** A configuração do motor — é dela que sai o quadro de pagamentos. */
  config: BancaFrancesaConfig | null;
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
  config,
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
  const [quadroAberto, setQuadroAberto] = useState(false);
  /* A mesa se encaixa no que sobra depois dos controles, e eles se medem sozinhos. */
  const [alturaDoAvental, setAlturaDoAvental] = useState(0);
  const [alturaDaBarra, setAlturaDaBarra] = useState(0);
  const janela = useJanela();
  /* Tela baixa não comporta avental de duas linhas: tudo numa só. */
  const apertado = telaBaixa(janela);

  useEffect(() => setFicha(minimo), [minimo]);

  const total = useMemo(() => CASAS.reduce((t, c) => t + soma(apostas[c]), 0), [apostas]);
  const abaixoDoMinimo = useMemo(
    () => CASAS.filter((c) => apostas[c].length > 0 && soma(apostas[c]) < minimo),
    [apostas, minimo],
  );
  /*
   * A aposta na linha é dividida ao meio e ficha não se parte — o saldo é inteiro. Um
   * valor ímpar seria recusado pelo servidor, então a mesa avisa antes, aqui, em vez
   * de deixar a pessoa confirmar e levar erro.
   */
  const linhaImpar = useMemo(
    () => LINHAS.filter((c) => soma(apostas[c]) % 2 !== 0),
    [apostas],
  );

  /* --- o lançamento: chacoalho fantasma, depois os dados de verdade --- */
  const rodada = mesa.lastRound;
  const { dados, lance, girando, duracaoDoVoo } = useLancamento(rodada);

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
    if (travado || total === 0 || abaixoDoMinimo.length > 0 || linhaImpar.length > 0) return;
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
    if (linhaImpar.length > 0) return 'Na linha, valor par';
    return `Confirmar ${total.toLocaleString('pt-BR')}`;
  };
  const podeApostar = total > 0 && abaixoDoMinimo.length === 0 && linhaImpar.length === 0 && !travado;

  return (
    <TampoDaMesa
      computador={TAMPOS_16X9['banca-francesa'].computador}
      tablet={TAMPOS_16X9['banca-francesa'].tablet}
      reserva={{ topo: alturaDaBarra, base: alturaDoAvental }}
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
      {dados.length > 0 &&
        MAPA_BANCA_FRANCESA.dados.map((ponto, indice) => (
          <DadoNaTigela
            key={indice}
            ponto={ponto}
            face={dados[indice] ?? null}
            indice={indice}
            lance={lance}
            duracaoDoVoo={duracaoDoVoo}
          />
        ))}

      <SafeAreaView style={styles.frente} edges={['top', 'bottom']} pointerEvents="box-none">
        <View
          style={styles.barraDeCima}
          pointerEvents="box-none"
          onLayout={(e) => setAlturaDaBarra(e.nativeEvent.layout.height)}
        >
          <BotaoRedondo icone="chevron-back" rotulo="Sair da mesa" onPress={onSair} />
          <ChipStack amount={saldo} />
          <View style={styles.botoesDaDireita}>
            <BotaoRedondo icone="help-circle" rotulo="O que cada aposta paga" onPress={() => setQuadroAberto(true)} />
            <BotaoRedondo
              icone="people"
              rotulo={`Quem está na mesa, ${mesa.seats.length} ${mesa.seats.length === 1 ? 'pessoa' : 'pessoas'}`}
              onPress={onAbrirPainel}
            />
          </View>
        </View>

        <Avental aoMedir={setAlturaDoAvental}>
          {erro && <Text style={styles.erro}>{erro}</Text>}
          {(recado || aviso) && <Text style={styles.aviso}>{recado ?? aviso}</Text>}

          {rodada && !girando && (
            <Text style={styles.placar}>
              {rodada.dice.join(' · ')} = {rodada.sum} → {NOME_DO_RESULTADO[rodada.outcome]}
              {rodada.rerolls > 0 &&
                ` · os dados voltaram pro copo ${rodada.rerolls}${rodada.rerolls === 1 ? ' vez' : ' vezes'} antes de decidir`}
            </Text>
          )}

          <View style={[styles.linhaDoTrilho, apertado && styles.linhaApertada]}>
            <View style={styles.ladoDoTrilho}>
              <BotaoRedondo icone="arrow-undo" rotulo="Desfazer a última ficha" onPress={desfazer} inativo={travado || ordem.length === 0} />
              <BotaoRedondo icone="trash-outline" rotulo="Limpar a mesa" onPress={limpar} inativo={travado || total === 0} />
            </View>
            <Trilho
              apertado={apertado}
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

          <View style={[styles.linhaDeBotoes, apertado && styles.linhaApertada]}>
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

      <QuadroDePagamentos
        visivel={quadroAberto}
        aoFechar={() => setQuadroAberto(false)}
        titulo="Banca Francesa — o que cada aposta paga"
        linhas={pagamentos(config)}
        observacao={
          'Nem toda jogada decide alguma coisa. Das 216 combinações de três dados, só 63 resolvem: ' +
          'a soma 3 (Ases), as somas 5, 6 e 7 (Pequeno) e as somas 14, 15 e 16 (Grande). Saindo qualquer ' +
          'outra soma, os dados voltam pro copo e as apostas continuam de pé — ninguém ganha nem perde. ' +
          'Isso é regra do jogo, não travamento: é o que faz as contas acima serem o que são.\n\n' +
          'A aposta na linha precisa ser um valor par, porque ela é dividida ao meio e ficha não se parte.'
        }
      />
    </TampoDaMesa>
  );
}

/**
 * As linhas do quadro, montadas a partir da configuração do motor.
 *
 * O pagamento e o RTP vêm do servidor, não daqui: é o mesmo número que paga a aposta de
 * verdade. Uma tabela digitada à mão poderia divergir do código numa mudança e virar
 * propaganda enganosa sem ninguém perceber. O que este arquivo escreve é só a frase em
 * português de QUANDO cada aposta ganha.
 */
function pagamentos(config: BancaFrancesaConfig | null): LinhaDePagamento[] {
  if (!config) return [];
  const lista = (tipo: 'pequeno' | 'grande') => config.winningSums[tipo].join(', ').replace(/, (\d+)$/, ' ou $1');
  const porUm = (tipo: 'ases' | 'pequeno' | 'grande') => `Paga ${config.totalReturnMultiplier[tipo] - 1} por 1`;
  const naLinha = (arco: 'pequeno' | 'grande') =>
    `A ficha fica em cima do traço do arco, meio dentro e meio fora — e é isso que a divide: metade dela ` +
    `está apostada, metade não. Saindo ${arco === 'grande' ? 'Grande' : 'Pequeno'} você ganha metade do que ` +
    `pôs; saindo qualquer outra coisa, perde só metade. Menos risco e menos prêmio, sem truque no meio.`;

  return [
    {
      aposta: 'Centro do Pequeno',
      quando: `Os três dados somam ${lista('pequeno')}`,
      paga: porUm('pequeno'),
      rtp: config.theoreticalRtpByType.pequeno,
    },
    {
      aposta: 'Centro do Grande',
      quando: `Os três dados somam ${lista('grande')}`,
      paga: porUm('grande'),
      rtp: config.theoreticalRtpByType.grande,
    },
    {
      aposta: 'Ases',
      quando: 'Os três dados caem no 1 — soma 3',
      paga: porUm('ases'),
      regra: 'Ases não tem linha: uma aposta que paga 61 por 1 não precisa de versão de risco reduzido.',
      rtp: config.theoreticalRtpByType.ases,
    },
    {
      aposta: 'Linha do Pequeno',
      quando: `Os três dados somam ${lista('pequeno')}`,
      paga: 'Ganha metade',
      regra: naLinha('pequeno'),
      rtp: config.theoreticalRtpByType['linha-pequeno'],
    },
    {
      aposta: 'Linha do Grande',
      quando: `Os três dados somam ${lista('grande')}`,
      paga: 'Ganha metade',
      regra: naLinha('grande'),
      rtp: config.theoreticalRtpByType['linha-grande'],
    },
  ];
}

/** A casa que ganhou. A linha de um arco ganha quando aquele arco ganha. */
function venceu(casa: BancaFrancesaBetType, resultado: string | undefined, mostrar: boolean) {
  if (!mostrar || !resultado) return false;
  if (casa === 'linha-grande') return resultado === 'grande';
  if (casa === 'linha-pequeno') return resultado === 'pequeno';
  return casa === resultado;
}

/**
 * O tempo do lançamento.
 *
 * O servidor já decidiu tudo antes de a animação começar — os dados de cada tentativa,
 * a soma, quem ganhou. O que acontece aqui é a encenação do que já aconteceu, e ela é
 * fiel: cada lançamento que o servidor fez é UM LANÇAMENTO NA TELA, com os dados
 * entrando na tigela, quicando e parando na face que saiu de verdade.
 *
 * ISTO ESTAVA QUEBRADO, e de um jeito que só aparece olhando. O estado `rolando`
 * ficava ligado do começo ao fim, e o <Dado> só dispara o voo quando `rolando` DESLIGA
 * com uma face na mão. Resultado: os três dados ficavam parados no ponto de
 * lançamento — que é fora do quadro, no alto — pendurados em cima do saldo, e depois
 * apareciam já assentados. A animação existia e nunca rodava.
 *
 * Os lançamentos nulos vão mais rápido (700ms contra 1150ms) e ficam menos tempo na
 * tela: eles não decidem nada, e a média real é de 3,4 tentativas até decidir. Mostrar
 * cada uma no tempo do decisivo faria uma rodada azarada custar dez segundos.
 */
function useLancamento(rodada: TableView['lastRound']) {
  const [dados, setDados] = useState<number[]>([]);
  const [lance, setLance] = useState(0);
  const [rapido, setRapido] = useState(false);
  /** A rodada ainda está rolando: a mesa fica travada e o resultado não aparece. */
  const [girando, setGirando] = useState(false);
  const ultima = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!rodada || rodada.at === ultima.current) return;
    ultima.current = rodada.at;

    let vivo = true;
    const relogios: ReturnType<typeof setTimeout>[] = [];
    const espera = (ms: number) => new Promise<void>((ok) => relogios.push(setTimeout(ok, ms)));

    (async () => {
      setGirando(true);
      let n = 0;

      // Os lançamentos que não decidiram nada: dados de verdade, do servidor.
      for (const nulo of (rodada.lancamentosNulos ?? []).slice(0, NULOS_MOSTRADOS)) {
        if (!vivo) return;
        setRapido(true);
        setDados(nulo);
        n += 1;
        setLance(n);
        await espera(ATE_ASSENTAR_RAPIDO + OLHADA_NO_NULO);
      }

      if (!vivo) return;
      // O decisivo, no tempo cheio.
      setRapido(false);
      setDados(rodada.dice);
      n += 1;
      setLance(n);
      await espera(ATE_ASSENTAR);
      if (vivo) setGirando(false);
    })();

    return () => {
      vivo = false;
      relogios.forEach(clearTimeout);
    };
  }, [rodada]);

  return { dados, lance, girando, duracaoDoVoo: rapido ? VOO_RAPIDO : VOO_CHEIO };
}

/** Quantos lançamentos nulos aparecem na tela. O texto diz quantos foram de verdade. */
const NULOS_MOSTRADOS = 2;
const VOO_CHEIO = 1150;
const VOO_RAPIDO = 700;
/** 2 × 150ms de atraso entre dados + o voo — quando o terceiro dado para. */
const ATE_ASSENTAR = 300 + VOO_CHEIO;
const ATE_ASSENTAR_RAPIDO = 300 + VOO_RAPIDO;
/** Tempo pra ler o que saiu antes de os dados serem recolhidos. */
const OLHADA_NO_NULO = 420;

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
  indice,
  lance,
  duracaoDoVoo,
}: {
  ponto: { x: number; y: number };
  face: number | null;
  indice: number;
  lance: number;
  duracaoDoVoo: number;
}) {
  const palco = usePalco();
  if (!palco) return null;
  const tamanho = dadoNaTigela(palco.largura);
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: palco.esquerda + ponto.x * palco.largura - tamanho / 2,
        top: palco.topo + ponto.y * palco.altura - tamanho / 2,
      }}
    >
      <Dado face={face} rolando={false} indice={indice} tamanho={tamanho} lance={lance} duracaoDoVoo={duracaoDoVoo} />
    </View>
  );
}

function Trilho({ apertado, ...resto }: {
  apertado: boolean;
  selecionada: number;
  onSelecionar: (valor: number) => void;
  cor: PlayerColor | undefined;
  saldo: number;
  travado: boolean;
  maximo: number;
}) {
  const palco = usePalco();
  return <TrilhoDeFichas {...resto} tamanho={fichaNoTrilho(palco?.largura ?? 700, apertado)} />;
}

function Avental({ children, aoMedir }: { children: ReactNode; aoMedir: (a: number) => void }) {
  return (
    <View style={styles.avental} pointerEvents="box-none" onLayout={(e) => aoMedir(e.nativeEvent.layout.height)}>
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
  botoesDaDireita: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  linhaDoTrilho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  ladoDoTrilho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, minWidth: 104 },
  linhaDeBotoes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  linhaApertada: { gap: spacing.sm, flexWrap: 'nowrap' },
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
