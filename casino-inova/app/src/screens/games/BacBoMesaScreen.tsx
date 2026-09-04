import { ReactNode, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { TAMPOS_16X9 } from '../../data/tamposDaMesa';
import { TABLE_IMAGES } from '../../data/tableImages';
import {
  MAPA_BAC_BO,
  MAPA_BAC_BO_EM_PE,
  LARGURA_UTIL_EM_PE,
  ORDEM_DE_PARAR_BAC_BO,
} from '../../data/mapaDosTampos';
import { DadoFisico } from '../../components/DadoFisico';
import { MeuNivel, fetchMeuNivel } from '../../api/niveis';
import { Arena, lancarDados } from '../../fisica/motorDeDados';
import { BACBO_DIE_IMAGES } from '../../data/gameAssets';
import {
  dadoDentroDoVidro,
  fichaNoPano,
  fichaNoTrilho,
  larguraDoPlacar,
  telaBaixa,
} from '../../theme/medidasDaMesa';
import { TampoDaMesa, usePalco } from '../../components/TampoDaMesa';
import { useJanela } from '../../theme/useJanela';
import { CasaDeAposta } from '../../components/CasaDeAposta';
import { TrilhoDeFichas } from '../../components/TrilhoDeFichas';
import { PilhaDeFichas } from '../../components/Ficha';
import { DENOMINACOES, corDoJogador, pilhaEmPalavras } from '../../data/fichasDeValor';
import { Dado } from '../../components/Dado';
import { ChipStack } from '../../components/ChipStack';
import { RoadmapPanel, VocabularioDoPlacar } from '../../components/RoadmapPanel';
import { ApiError, novaAcao } from '../../api/client';
import { Roadmap } from '../../api/roadmap';
import {
  fetchBacBoConfig,
  fetchBacBoRoadmap,
  playBacBoRound,
  BacBoBet,
  BacBoBetType,
  BacBoConfig,
  BacBoRoundResponse,
} from '../../api/bacBo';
import { usePlayer } from '../../data/usePlayer';
import { PlayerColor } from '../../data/chipImages';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme';

const CASAS = ['jogador', 'empate', 'banca'] as const;

/** Uma casa vazia é um array vazio — nunca `undefined`, pra não ter que checar em toda linha. */
type ApostasNaMesa = Record<BacBoBetType, number[]>;
const MESA_LIMPA: ApostasNaMesa = { jogador: [], empate: [], banca: [] };

const soma = (fichas: number[]) => fichas.reduce((t, f) => t + f, 0);

/**
 * Bac Bo jogado NA MESA.
 *
 * A diferença pra tela antiga não é enfeite: lá a foto da mesa era papel de parede e a
 * aposta era um botão escrito "Player · paga 1 por 1" numa fileira embaixo. Aqui você
 * pega uma ficha do trilho e a encosta no PANO, na área que já está desenhada na arte,
 * e a ficha FICA onde você a pôs. Os dados assentam na boca dos agitadores, que é onde
 * eles estão desenhados.
 *
 * O nome e o pagamento de cada área já estão impressos no feltro, então a tela não os
 * repete — o que ela acrescenta é só o que muda: a pilha de fichas, a borda acesa, e o
 * brilho de quem ganhou.
 */
export function BacBoMesaScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const [config, setConfig] = useState<BacBoConfig | null>(null);
  const [erroDeConfig, setErroDeConfig] = useState<string | null>(null);
  const [placar, setPlacar] = useState<Roadmap | null>(null);
  const [placarAberto, setPlacarAberto] = useState(false);
  const [saldo, setSaldo] = useState(0);
  const { jogador } = usePlayer();
  /*
   * A SUA cor de ficha. Numa mesa compartilhada quem dá a cor é o servidor, que sabe
   * quem já sentou e não repete; aqui, jogando sozinho contra a casa, ela sai do seu
   * identificador, então é sempre a mesma pra você.
   */
  const minhaCor = corDoJogador(jogador?.id);

  useEffect(() => {
    if (jogador) setSaldo(jogador.chipBalance);
  }, [jogador]);

  const [ficha, setFicha] = useState(DENOMINACOES[1].valor);
  const [apostas, setApostas] = useState<ApostasNaMesa>(MESA_LIMPA);
  /** A ordem em que as fichas foram encostadas, pra desfazer uma de cada vez. */
  const [ordem, setOrdem] = useState<BacBoBetType[]>([]);
  /** A última rodada apostada, pra repetir sem remontar a pilha. */
  const [anterior, setAnterior] = useState<ApostasNaMesa | null>(null);
  const [rodada, setRodada] = useState<BacBoRoundResponse | null>(null);
  const [rolando, setRolando] = useState(false);
  /*
   * O nível DESTA pessoa: é dele que saem o mínimo, o máximo e as fichas do trilho.
   *
   * Sem isto o trilho mostrava as vinte e cinco denominações que existem, a maioria
   * apagada por saldo insuficiente — um trilho em que quase tudo é impossível é pior do
   * que um trilho curto. E o teto por casa vinha da configuração pública do jogo, igual
   * pra quem criou a conta agora e pra quem tem cem milhões.
   */
  const [meuNivel, setMeuNivel] = useState<MeuNivel | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  /*
   * A mesa é encaixada no que sobra depois dos controles, e os controles se medem
   * sozinhos: chutar a altura deles daria certo num tamanho de tela e errado nos
   * outros, que é exatamente o problema que estamos consertando.
   */
  const [alturaDoAvental, setAlturaDoAvental] = useState(0);
  const [alturaDaBarra, setAlturaDaBarra] = useState(0);
  const janela = useJanela();
  /*
   * Tela baixa — celular deitado — não comporta avental de duas linhas. Reservar
   * espaço pra ele espremia a mesa a menos da metade da tela: sem cobrir o feltro,
   * mas desperdiçando a tela toda em tarja preta. Numa linha só, tudo cabe e a mesa
   * fica grande.
   */
  const apertado = telaBaixa(janela);

  useEffect(() => {
    // O placar da mesa já existe no servidor desde antes desta tela; o que faltava era
    // alguém desenhar. Toda mesa de cassino tem o histórico ligado ao lado, o tempo
    // todo — não é algo que se pede pra ver.
    fetchBacBoRoadmap().then(setPlacar).catch(() => undefined);
    fetchBacBoConfig()
      .then(setConfig)
      .catch((e: unknown) =>
        setErroDeConfig(e instanceof ApiError ? e.message : 'Não foi possível falar com o servidor.'),
      );
  }, []);

  /*
   * O nível é buscado de novo sempre que o saldo muda: ganhar uma rodada grande, ou
   * receber fichas, pode subir a pessoa de mesa. Sem isto o trilho ficaria no nível de
   * quando a tela abriu.
   */
  useEffect(() => {
    fetchMeuNivel().then(setMeuNivel).catch(() => undefined);
  }, [saldo]);

  /** Os limites desta pessoa nesta mesa. Enquanto o nível não chega, os do nível de entrada. */
  const minimoDaMesa = meuNivel?.nivel.minimo ?? config?.minBet ?? 0;
  const maximoDaMesa = meuNivel?.nivel.maximo ?? config?.maxBet ?? 0;

  const total = useMemo(() => CASAS.reduce((t, c) => t + soma(apostas[c]), 0), [apostas]);

  /** Casas montadas abaixo do mínimo da mesa: o servidor recusaria, então avisamos antes. */
  const abaixoDoMinimo = useMemo(
    () => CASAS.filter((c) => apostas[c].length > 0 && soma(apostas[c]) < minimoDaMesa),
    [apostas, minimoDaMesa],
  );

  /** Encostar a ficha escolhida numa casa. Tocar de novo empilha outra. */
  const encostar = (casa: BacBoBetType) => {
    if (rolando || !config) return;
    setRodada(null);
    setErro(null);

    if (total + ficha > saldo) {
      setAviso('Você não tem fichas suficientes pra essa.');
      return;
    }
    if (maximoDaMesa > 0 && soma(apostas[casa]) + ficha > maximoDaMesa) {
      setAviso(`O máximo por casa é ${maximoDaMesa.toLocaleString('pt-BR')}.`);
      return;
    }

    setAviso(null);
    setApostas((atual) => ({ ...atual, [casa]: [...atual[casa], ficha] }));
    setOrdem((atual) => [...atual, casa]);
  };

  /** Tirar a última ficha encostada, seja em que casa for. */
  const desfazer = () => {
    if (rolando || ordem.length === 0) return;
    const ultima = ordem[ordem.length - 1];
    setApostas((atual) => ({ ...atual, [ultima]: atual[ultima].slice(0, -1) }));
    setOrdem((atual) => atual.slice(0, -1));
    setAviso(null);
    setRodada(null);
  };

  const limpar = () => {
    if (rolando) return;
    setApostas(MESA_LIMPA);
    setOrdem([]);
    setAviso(null);
    setRodada(null);
  };

  /** Remontar a mesa exatamente como estava na rodada passada. */
  const repetir = () => {
    if (rolando || !anterior) return;
    const custo = CASAS.reduce((t, c) => t + soma(anterior[c]), 0);
    if (custo > saldo) {
      setAviso('Você não tem fichas suficientes pra repetir.');
      return;
    }
    setApostas(anterior);
    setOrdem(CASAS.flatMap((c) => anterior[c].map(() => c)));
    setAviso(null);
    setRodada(null);
  };

  const jogar = async () => {
    if (!config || rolando || total === 0 || abaixoDoMinimo.length > 0) return;
    setRolando(true);
    setErro(null);
    setAviso(null);
    setRodada(null);
    const montagem = apostas;
    try {
      const lista: BacBoBet[] = CASAS.filter((c) => montagem[c].length > 0).map((type) => ({
        type,
        amount: soma(montagem[type]),
      }));
      const resultado = await playBacBoRound(lista, novaAcao());
      /*
       * O resultado inteiro já chegou. A espera abaixo é só o tempo dos dados
       * assentarem — a animação mostra o que já aconteceu, não decide nada.
       */
      setTimeout(() => {
        setRodada(resultado);
        setPlacar(resultado.roadmap);
        setSaldo(resultado.newBalance);
        setAnterior(montagem);
        setRolando(false);
      }, TEMPO_DOS_DADOS);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível apostar agora.');
      setRolando(false);
    }
  };

  const dados = rodada ? [...rodada.playerDice, ...rodada.bankerDice] : [null, null, null, null];
  const podeJogar = total > 0 && abaixoDoMinimo.length === 0 && !rolando;

  /*
   * "Confirmar", não "Apostar": as três casas do pano já se chamam "Apostar no
   * Jogador", "Apostar no Empate" e "Apostar na Banca". Um quarto botão chamado
   * "Apostar 250" deixava quatro alvos com nome quase igual, e quem navega de ouvido
   * não tinha como saber qual fecha a rodada.
   */
  const BotaoJogar = () => (
    <Pressable
      onPress={jogar}
      disabled={!podeJogar}
      accessibilityRole="button"
      accessibilityLabel={rotuloDoBotao()}
      accessibilityState={{ disabled: !podeJogar }}
      style={[styles.botaoJogar, apertado && styles.botaoJogarApertado, !podeJogar && styles.desabilitado]}
    >
      {rolando ? (
        <ActivityIndicator color={colors.background} />
      ) : (
        <Text style={styles.botaoJogarTexto}>{rotuloDoBotao()}</Text>
      )}
    </Pressable>
  );

  const rotuloDoBotao = () => {
    if (total === 0) return 'Encoste uma ficha no pano';
    if (abaixoDoMinimo.length > 0) return `Mínimo ${minimoDaMesa.toLocaleString('pt-BR')} por casa`;
    return `Confirmar ${total.toLocaleString('pt-BR')}`;
  };

  return (
    <TampoDaMesa
      computador={TAMPOS_16X9['bac-bo'].computador}
      tablet={TAMPOS_16X9['bac-bo'].tablet}
      celular={TABLE_IMAGES['bac-bo']}
      reserva={{ topo: alturaDaBarra, base: alturaDoAvental }}
    >
      <MesaDoBacBo
        apostas={apostas}
        cor={minhaCor}
        rolando={rolando}
        rodada={rodada}
        dados={dados}
        onEncostar={encostar}
      />
      {/* --- Os controles, fora do pano --- */}
      <SafeAreaView style={styles.frente} edges={['top', 'bottom']} pointerEvents="box-none">
        <View
          style={styles.barraDeCima}
          pointerEvents="box-none"
          onLayout={(e) => setAlturaDaBarra(e.nativeEvent.layout.height)}
        >
          <Pressable
            onPress={navigation.goBack}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            style={styles.botaoRedondo}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <ChipStack amount={saldo} />
          {/*
            O placar mora atrás deste botão, não em cima da mesa.
            Numa casa de verdade o histórico fica num monitor AO LADO da mesa — não
            flutuando sobre o feltro. Aqui a tela é a mesa inteira, então o lugar
            equivalente é um botão na borda: quem quer ver, abre.
          */}
          <Pressable
            onPress={() => setPlacarAberto(true)}
            accessibilityRole="button"
            accessibilityLabel="Histórico da mesa"
            style={styles.botaoRedondo}
            hitSlop={12}
          >
            <Ionicons name="stats-chart" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>

        <Apron aoMedir={setAlturaDoAvental}>
          {erroDeConfig && <Text style={styles.erro}>{erroDeConfig}</Text>}
          {erro && <Text style={styles.erro}>{erro}</Text>}
          {aviso && <Text style={styles.aviso}>{aviso}</Text>}

          {rodada && (
            <Text style={styles.placar}>
              Jogador {rodada.playerTotal} × {rodada.bankerTotal} Banca ·{' '}
              {rodada.totalReturn > rodada.totalStake
                ? `você recebeu ${rodada.totalReturn.toLocaleString('pt-BR')}`
                : rodada.totalReturn > 0
                  ? `voltou ${rodada.totalReturn.toLocaleString('pt-BR')}`
                  : 'não foi dessa vez'}
            </Text>
          )}

          {/*
            * O TRILHO TEM A LINHA INTEIRA, igual à Banca Francesa — o mesmo controle nas
            * duas mesas tem que se comportar do mesmo jeito.
            *
            * Espremido entre os dois blocos de botões, ele ficava com uma ficha e meia
            * visível e o resto atrás de uma seta. As fichas são o controle mais usado da
            * mesa; desfazer, limpar e repetir são de vez em quando.
            */}
          <View style={styles.linhaDoTrilho}>
            <Trilho
              apertado={apertado}
              cor={minhaCor}
              selecionada={ficha}
              onSelecionar={(v) => {
                setFicha(v);
                setAviso(null);
              }}
              saldo={saldo - total}
              travado={rolando}
              minimo={minimoDaMesa}
              maximo={maximoDaMesa || undefined}
            />
          </View>

          <View style={styles.linhaDosBotoesRedondos}>
            <BotaoDeMesa
              icone="arrow-undo"
              rotulo="Desfazer a última ficha"
              onPress={desfazer}
              inativo={rolando || ordem.length === 0}
            />
            <BotaoDeMesa
              icone="trash-outline"
              rotulo="Limpar a mesa"
              onPress={limpar}
              inativo={rolando || total === 0}
            />
            <BotaoDeMesa
              icone="repeat"
              rotulo="Repetir a aposta anterior"
              onPress={repetir}
              inativo={rolando || !anterior}
            />
            {/* Tela baixa: o botão de jogar entra nesta linha, em vez de abrir uma segunda. */}
            {apertado && <BotaoJogar />}
          </View>

          {!apertado && <BotaoJogar />}
        </Apron>
      </SafeAreaView>

      <Modal visible={placarAberto} animationType="slide" transparent onRequestClose={() => setPlacarAberto(false)}>
        <View style={styles.fundoDoPlacar}>
          <SafeAreaView style={styles.folhaDoPlacar} edges={['bottom']}>
            <View style={styles.topoDoPlacar}>
              <Text style={styles.tituloDoPlacar}>Histórico da mesa</Text>
              <Pressable onPress={() => setPlacarAberto(false)} accessibilityRole="button" accessibilityLabel="Fechar" hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {placar && (
                <RoadmapPanel
                  roadmap={placar}
                  vocabulario={VOCABULARIO_DO_BAC_BO}
                  /* O placar ocupa a folha, com uma margem — painel de mesa é largo. */
                  largura={larguraDoPlacar(janela.width, spacing.lg)}
                />
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </TampoDaMesa>
  );
}

/** As marcas são as mesmas de toda mesa; as palavras são as do Bac Bo. */
const VOCABULARIO_DO_BAC_BO: VocabularioDoPlacar = { banca: 'Banca', jogador: 'Jogador', empate: 'Empate' };

/**
 * O pano do Bac Bo — as casas e os dados, no mapa do tampo que está na tela.
 *
 * Isto é um componente separado por um motivo de verdade, não por organização: quem
 * escolhe o mapa precisa saber qual tampo o `TampoDaMesa` acabou usando, e isso só se
 * sabe DE DENTRO dele, pelo `usePalco`. A tela que monta o tampo está por fora e não
 * enxerga essa decisão.
 */
function MesaDoBacBo({
  apostas,
  cor,
  rolando,
  rodada,
  dados,
  onEncostar,
}: {
  apostas: ApostasNaMesa;
  cor: PlayerColor | undefined;
  rolando: boolean;
  rodada: BacBoRoundResponse | null;
  dados: (number | null)[];
  onEncostar: (casa: BacBoBetType) => void;
}) {
  const palco = usePalco();
  const mapa = palco?.emPe ? MAPA_BAC_BO_EM_PE : MAPA_BAC_BO;
  const larguras = palco?.emPe ? LARGURA_UTIL_EM_PE : undefined;

  /*
   * O número do lançamento. Serve de semente pra física: o mesmo lançamento redesenhado
   * (uma remontagem da tela no meio da animação) sai idêntico em vez de saltar, e
   * lançamentos diferentes chacoalham diferente sem ninguém sortear nada à mão.
   */
  const lance = useMemo(() => contarLance(rodada), [rodada]);

  return (
    <>
      {/* --- As três casas do pano, com as fichas encostadas em cima --- */}
      {CASAS.map((casa) => (
        <CasaDeAposta
          key={casa}
          nome={casa}
          larguraUtil={larguras?.[casa]}
          area={mapa.apostas[casa]}
          valor={soma(apostas[casa])}
          descricao={pilhaEmPalavras(apostas[casa])}
          travada={rolando}
          vencedora={rodada?.outcome === casa}
          onPress={() => onEncostar(casa)}
        >
          <PilhaNoPano fichas={apostas[casa]} cor={cor} />
        </CasaDeAposta>
      ))}

      {/*
        --- Os quatro dados, cada um dentro do seu agitador ---
        Antes da primeira rodada os copos ficam VAZIOS, que é como a máquina de verdade
        fica enquanto a mesa aceita aposta. Dado parado no vidro sem rodada nenhuma é
        cenário; dado que aparece quando a rodada começa é o jogo.
      */}
      {(rolando || rodada) && <DadosNosAgitadores mapa={mapa} faces={dados} rolando={rolando} lance={lance} />}
    </>
  );
}

/** As seis faces do dado do Bac Bo, em ordem, montadas uma vez só. */
const FACES_DO_BAC_BO = [1, 2, 3, 4, 5, 6].map((n) => BACBO_DIE_IMAGES[n]);

/**
 * Um número que muda a cada rodada nova. Sai do próprio resultado, e não de um contador
 * guardado: assim ele sobrevive a a tela ser remontada no meio da animação.
 */
function contarLance(rodada: BacBoRoundResponse | null): number {
  if (!rodada) return 0;
  const dados = [...rodada.playerDice, ...rodada.bankerDice];
  return dados.reduce((soma, d, i) => soma * 7 + d * (i + 1), 1);
}

/** Quanto tempo os dados chacoalham antes de mostrar a face. */
const TEMPO_DOS_DADOS = 1400;

/**
 * O AVENTAL — a faixa escura entre a beirada da mesa e a borda de baixo da tela.
 *
 * Numa mesa de verdade existe esse pedaço: o couro do parapeito onde o jogador apoia o
 * braço e deixa as fichas. Sem ele os controles ficavam metade em cima do feltro e
 * metade no preto do salão, cortados pela beirada da arte no meio de uma ficha. Aqui o
 * avental começa exatamente onde o tampo termina, então a divisão é a da própria mesa.
 */
function Apron({ children, aoMedir }: { children: ReactNode; aoMedir: (altura: number) => void }) {
  return (
    <View
      style={styles.avental}
      pointerEvents="box-none"
      onLayout={(e) => aoMedir(e.nativeEvent.layout.height)}
    >
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

/** O trilho de fichas no tamanho medido pela mesa. */
function Trilho({ apertado, ...resto }: {
  apertado: boolean;
  selecionada: number;
  onSelecionar: (valor: number) => void;
  cor: PlayerColor | undefined;
  saldo: number;
  travado: boolean;
  /** Os limites do NÍVEL de quem está jogando: é o que decide quais fichas aparecem. */
  minimo?: number;
  maximo?: number;
}) {
  const palco = usePalco();
  return <TrilhoDeFichas {...resto} tamanho={fichaNoTrilho(palco?.largura ?? 700, apertado)} />;
}

/** A pilha dentro da casa, no tamanho medido na arte (ver TAMANHO_DA_FICHA_NO_PANO). */
function PilhaNoPano({ fichas, cor }: { fichas: number[]; cor: PlayerColor | undefined }) {
  const palco = usePalco();
  if (!palco || fichas.length === 0) return null;
  return <PilhaDeFichas fichas={fichas} cor={cor} tamanho={fichaNoPano(palco.largura)} />;
}



/** Um dado assentado na boca do agitador onde ele está desenhado. */
/**
 * Os quatro dados chacoalhando nos agitadores, e parando UM DE CADA VEZ.
 *
 * Cada dado vive dentro do próprio tubo de vidro, e o tubo é apertado: o dado mal cabe,
 * bate nos dois lados e sobe — o movimento da bola na máquina de bingo, que é o que se
 * queria. A física é a mesma da tigela da banca francesa; muda só a arena (uma caixa
 * estreita em vez de uma elipse) e o fato de o agitador continuar soprando até desligar.
 *
 * A ORDEM É VERMELHO, AZUL, VERMELHO, AZUL. Parar os dois do jogador e depois os dois da
 * banca entregaria metade da conta cedo demais: com os dois azuis parados, quem sabe
 * somar já espera sem suspense nenhum. Alternando, nenhum lado fecha a soma antes do
 * último dado — e o suspense vem de a informação chegar dividida, não de alguém segurar
 * o resultado. O resultado já estava decidido no servidor antes do primeiro chacoalho.
 */
function DadosNosAgitadores({
  mapa,
  faces,
  rolando,
  lance,
}: {
  mapa: typeof MAPA_BAC_BO;
  faces: Array<number | null>;
  rolando: boolean;
  lance: number;
}) {
  const palco = usePalco();

  const preparado = useMemo(() => {
    if (!palco) return null;
    const conhecidas = faces.map((f) => f ?? 1);
    if (conhecidas.length === 0) return null;

    const vidro = mapa.vidroDoAgitador;
    /*
     * O TAMANHO DO DADO SAI DA CÁPSULA, e não de um número próprio. Antes ele era 5% da
     * largura do tampo, escolhido sem olhar o vidro — e o vidro tem 5,2%. O dado
     * preenchia o tubo inteiro e saía pra fora dele na tela.
     */
    const tamanho = dadoDentroDoVidro(palco.largura, vidro.largura);
    const escalaDoMundo = tamanho / 2;

    /*
     * A cápsula em unidades do motor. O dado tem raio 1, então uma cápsula de raio 1,2
     * deixa ele andar 0,2 pra cada lado — apertado de propósito: é o que faz ele
     * chacoalhar em vez de rolar.
     */
    const arena: Arena = {
      formato: 'caixa',
      /*
       * O tubo está EM PÉ na tela. Sem isto a gravidade puxaria pra fora do plano, como
       * na tigela vista de cima, e os quatro dados parariam boiando cada um numa altura
       * do vidro em vez de assentados no fundo.
       */
      emPe: true,
      raioX: Math.max(1.05, (vidro.largura * palco.largura) / 2 / escalaDoMundo),
      raioY: Math.max(1.05, ((vidro.base - vidro.topo) * palco.altura) / 2 / escalaDoMundo),
    };

    /*
     * O CENTRO DA ARENA É O MEIO DO VIDRO, e não o ponto onde o dado assenta.
     *
     * O mapa guarda onde o dado PARA (no fundo do tubo). Se a física usasse esse ponto
     * como centro, metade da cápsula ficaria abaixo da base do pote — o dado quicaria
     * pra dentro do latão. O meio do vidro é (topo + base) / 2.
     */
    const centroDoVidro = (vidro.topo + vidro.base) / 2;

    // Quando cada agitador desliga, em quadros de 60 por segundo.
    const desligaEm: number[] = [];
    ORDEM_DE_PARAR_BAC_BO.forEach((indiceDoDado, posicao) => {
      desligaEm[indiceDoDado] = PRIMEIRO_A_PARAR + posicao * INTERVALO_ENTRE_PARADAS;
    });
    const total = Math.max(...desligaEm) + QUADROS_PRA_ASSENTAR;

    /*
     * UM LANÇAMENTO POR DADO, e não os quatro juntos.
     *
     * Cada dado está no PRÓPRIO tubo de vidro: eles não se veem e não podem se encostar.
     * Simulados na mesma arena, o motor tratava os quatro como estando na mesma caixa e
     * os separava quando se sobrepunham — e essa separação empurrava um pra FORA da
     * parede. Era o dado que aparecia do lado de fora do pote na tela.
     */
    const caminhos = conhecidas.map((face, i) =>
      lancarDados({
        faces: [face],
        arena,
        semente: lance * 6151 + face * (i + 1) * 17 + i,
        entrada: { x: 0, y: 0, z: 1 },
        agitarAte: [desligaEm[i]],
        quadrosFixos: total,
      }).caminhos[0],
    );

    return { caminhos, tamanho, escalaDoMundo, centroDoVidro };
  }, [palco, faces, lance, mapa]);

  if (!palco || !preparado) return null;

  return (
    <>
      {preparado.caminhos.map((caminho, indice) => {
        const ponto = mapa.dados[indice];
        if (!ponto) return null;
        return (
          <DadoFisico
            key={indice}
            caminho={caminho}
            faces={FACES_DO_BAC_BO}
            tamanho={preparado.tamanho}
            escalaDoMundo={preparado.escalaDoMundo}
            centro={{
              x: palco.esquerda + ponto.x * palco.largura,
              y: palco.topo + preparado.centroDoVidro * palco.altura,
            }}
            chave={lance}
          />
        );
      })}
    </>
  );
}

/** Quando o primeiro agitador desliga, e de quanto em quanto os outros seguem. */
const PRIMEIRO_A_PARAR = 54; // 0,9s
const INTERVALO_ENTRE_PARADAS = 33; // 0,55s entre um e o próximo
/*
 * 48 quadros (0,8s) pro último dado cair e assentar depois de o agitador dele desligar.
 *
 * O número saiu da medição, não do olho: com 18 o último dado ficava congelado no meio
 * do tubo em 15% dos lançamentos, e com 45 ainda sobrava um em duzentos e quarenta.
 * `verifica-agitador.ts` mede isso em onze tamanhos de tela nas duas artes.
 */
const QUADROS_PRA_ASSENTAR = 48;


function BotaoDeMesa({
  icone,
  rotulo,
  onPress,
  inativo,
}: {
  icone: keyof typeof Ionicons.glyphMap;
  rotulo: string;
  onPress: () => void;
  inativo: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={inativo}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ disabled: inativo }}
      hitSlop={8}
      style={[styles.botaoRedondo, inativo && styles.desabilitado]}
    >
      <Ionicons name={icone} size={24} color={colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /* `box-none` deixa o toque atravessar pro pano onde não há controle. */
  frente: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  fundoDoPlacar: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(4,6,5,0.72)' },
  folhaDoPlacar: {
    maxHeight: '82%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  topoDoPlacar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  tituloDoPlacar: { fontFamily: fontFamily.displayBold, fontSize: fontSize.lg, color: colors.textPrimary },
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
  /*
   * O trilho fica no CENTRO da tela, não no centro do que sobrou depois dos botões:
   * os dois lados têm a mesma largura mínima, então desfazer/limpar de um lado e
   * repetir do outro não empurram as fichas pro canto.
   */
  /*
   * `width: '100%'` e `minWidth: 0` nos lados: sem os dois, esta linha ficava mais larga
   * que a tela e o trilho transbordava em vez de rolar.
   *
   * A linha era dimensionada pelos filhos (dois blocos de botões com largura mínima de
   * 104 mais a fileira de fichas inteira), e não pela tela. Medido num celular de 320px:
   * a linha tinha 656 de largura, as fichas das pontas saíam metade fora, e a rolagem
   * nunca era acionada porque, do ponto de vista da caixa, tudo cabia dentro dela.
   */
  linhaDoTrilho: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  linhaDosBotoesRedondos: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
  /*
   * Sem largura mínima: ela existia pra manter o trilho centrado, e quem centra agora é
   * o próprio trilho (com respiro nas laterais quando sobra espaço). Mantida, ela
   * roubava 208 dos 320 pixels de um celular pequeno e não sobrava trilho.
   */
  /*
   * Os botões laterais CEDEM espaço pro trilho, e não o contrário.
   *
   * Com largura mínima de 104 de cada lado, num celular de 320 sobravam 46 pixels pro
   * trilho — menos de uma ficha. As fichas eram a coisa mais importante da linha e
   * ficavam com a menor parte dela.
   *
   * Agora os três blocos repartem por peso: o trilho leva 3 partes e cada lado leva 1.
   * Em 320px isso dá cerca de 170 pro trilho e 57 pra cada lado, que é o bastante pros
   * botões redondos; e o trilho, quando ainda não couber, rola com as setas.
   */
  ladoDoTrilho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  botaoJogar: {
    minWidth: 210,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.goldBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoJogarTexto: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.base, color: colors.background },
  botaoJogarApertado: { minWidth: 150, paddingVertical: 8 },
  linhaApertada: { gap: spacing.sm, flexWrap: 'nowrap' },
  desabilitado: { opacity: 0.45 },
  placar: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
    textAlign: 'center',
    backgroundColor: 'rgba(11,15,13,0.72)',
    borderRadius: radius.md,
    paddingVertical: 6,
  },
  erro: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.danger, textAlign: 'center' },
  aviso: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: colors.gold, textAlign: 'center' },
});
