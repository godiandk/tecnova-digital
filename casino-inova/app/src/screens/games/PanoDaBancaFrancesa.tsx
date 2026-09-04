import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { TAMPOS_16X9 } from '../../data/tamposDaMesa';
import { MAPA_BANCA_FRANCESA, TIGELA_DA_BANCA } from '../../data/mapaDosTampos';
import { dadoNaTigela, fichaNoPano, fichaNoTrilho, telaBaixa } from '../../theme/medidasDaMesa';
import { TampoDaMesa, usePalco } from '../../components/TampoDaMesa';
import { useJanela } from '../../theme/useJanela';
import { CasaDeAposta, PilhaNaCasa } from '../../components/CasaDeAposta';
import { TrilhoDeFichas } from '../../components/TrilhoDeFichas';
import { PilhaDeFichas } from '../../components/Ficha';
import { DadoFisico } from '../../components/DadoFisico';
import { Arena, lancarDados } from '../../fisica/motorDeDados';
import { DIE_FACE_IMAGES } from '../../data/gameAssets';
import { ChipStack } from '../../components/ChipStack';
import { QuadroDePagamentos, LinhaDePagamento } from '../../components/QuadroDePagamentos';
import { decomporEmFichas, pilhaEmPalavras } from '../../data/fichasDeValor';
import { PlayerColor } from '../../data/chipImages';
import { BancaFrancesaBet, BancaFrancesaBetType, BancaFrancesaConfig } from '../../api/bancaFrancesa';
import { TableView } from '../../api/bancaFrancesaMesa';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme';
import { estouOcupado } from '../../api/versao';

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

/** Cada linha acompanha um arco: é a mesma soma, com metade do risco e metade do prêmio. */
const ARCO_DA_CASA: Record<string, 'pequeno' | 'grande'> = {
  'linha-pequeno': 'pequeno',
  'linha-grande': 'grande',
};

type Apostas = Record<BancaFrancesaBetType, number[]>;
const MESA_LIMPA: Apostas = { ases: [], grande: [], pequeno: [], 'linha-grande': [], 'linha-pequeno': [] };
const soma = (fichas: number[]) => fichas.reduce((t, f) => t + f, 0);

const NOME_DO_RESULTADO: Record<string, string> = { ases: 'Ases', pequeno: 'Pequeno', grande: 'Grande' };

/** As seis faces em ordem, montadas uma vez: o dado troca de face 60 vezes por segundo. */
const FACES_DO_DADO = [1, 2, 3, 4, 5, 6].map((n) => DIE_FACE_IMAGES[n]);

interface PanoProps {
  mesa: TableView;
  meuId: string | null;
  ehAnfitriao: boolean;
  ocupado: boolean;
  saldo: number;
  minimo: number;
  /**
   * O PISO E O TETO DE CADA CASA, em fichas, já calculados pelo SERVIDOR.
   *
   * Vêm prontos porque a regra é dele: Ases vai até 6× o mínimo, os arcos até 200×, e a
   * linha começa no DOBRO do mínimo porque a ficha vale metade lá. A tela não recalcula
   * nada disso — ela mostra o número e recusa antes de mandar, com a mesma conta que o
   * servidor vai fazer. Duas contas seriam duas chances de divergir, e já divergiram.
   */
  limites?: Record<string, { minimo: number; maximo: number }>;
  /** Como cada casa é chamada — vem do servidor pra a mensagem ser a mesma dos dois lados. */
  nomeDaCasa?: Record<string, string>;
  /** Quanto a aposta montada pode CUSTAR. Na linha é metade da ficha. */
  risco?: number;
  /** O maior retorno possível. Só um resultado sai, então não é a soma de todos. */
  retornoPossivel?: number;
  /** O saldo que sobra se tudo der errado. */
  saldoDepoisDaAposta?: number;
  /** O último lançamento foi nulo: o botão vira "Jogar novamente". */
  esperandoDepoisDoNulo?: boolean;
  /** O nome da mesa em que esta pessoa está jogando (Bronze, Ouro, Safira...). */
  nomeDoNivel?: string;
  /** As cinco fichas deste degrau, calculadas pelo servidor sobre o saldo. */
  fichasDaMesa?: number[];
  /** A configuração do motor — é dela que sai o quadro de pagamentos. */
  config: BancaFrancesaConfig | null;
  /** Devolve se a aposta foi aceita — é o que decide se a montagem some ou fica. */
  onApostar: (bets: BancaFrancesaBet[]) => Promise<boolean>;
  onGirar: () => Promise<unknown>;
  /** Tira as fichas da mesa na janela entre lançamentos. Não custa nada. */
  onRetirar: () => Promise<unknown>;
  onSair: () => void;
  onAbrirPainel: () => void;
  /**
   * O que o botão da direita faz, dito em palavras.
   *
   * A mesa online abre o painel de quem está sentado; a mesa de um jogador só não tem
   * painel — ali o mesmo botão leva pra mesa online. O rótulo tem que acompanhar: um
   * botão que anuncia "quem está na mesa, 1 pessoa" e leva pra outro lugar mente pra
   * quem usa leitor de tela, que é justamente quem não pode conferir olhando.
   */
  rotuloDoPainel?: string;
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
  limites,
  nomeDaCasa,
  risco,
  retornoPossivel,
  saldoDepoisDaAposta,
  esperandoDepoisDoNulo,
  nomeDoNivel,
  fichasDaMesa,
  config,
  onApostar,
  onGirar,
  onRetirar,
  onSair,
  onAbrirPainel,
  rotuloDoPainel,
  erro,
  aviso,
}: PanoProps) {
  const meuLugar = mesa.seats.find((s) => s.userId === meuId);
  const minhaCor = meuLugar?.color;

  const [ficha, setFicha] = useState(minimo);
  /*
   * A FICHA ESCOLHIDA ACOMPANHA O MÍNIMO DA MESA.
   *
   * `useState(minimo)` guarda o valor da PRIMEIRA renderização, e nessa altura o
   * mínimo ainda é o padrão de 50 — o degrau só chega quando o servidor responde. O
   * resultado aparecia na tela: numa conta de cento e sete bilhões (mesa de mínimo
   * 500 milhões), o trilho ficava com a ficha de 50 selecionada, a pessoa montava a
   * aposta e o servidor recusava por estar abaixo do mínimo.
   *
   * Subir a ficha quando ela está abaixo do mínimo não atropela escolha nenhuma: uma
   * ficha abaixo do mínimo não serve pra nada nesta mesa.
   */
  useEffect(() => {
    setFicha((atual) => (atual < minimo ? minimo : atual));
  }, [minimo]);
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
  /*
   * O PISO É POR CASA, e não um mínimo só pra mesa inteira.
   *
   * A linha começa no DOBRO do mínimo, porque a ficha vale metade lá: com mínimo 50, a
   * menor ficha que pode ir na linha é 100 — arriscando os 50 exigidos. Comparar tudo
   * com o mesmo `minimo` deixaria passar uma ficha de 50 na linha, que arrisca 25 numa
   * mesa de mínimo 50: aposta abaixo do mínimo entrando pela porta dos fundos.
   */
  const abaixoDoMinimo = useMemo(
    () =>
      CASAS.filter((c) => {
        const posto = soma(apostas[c]);
        if (posto === 0) return false;
        return posto < (limites?.[c]?.minimo ?? minimo);
      }),
    [apostas, minimo, limites],
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

  /*
   * AS CONTAS DA APOSTA, somando o que JÁ FOI CONFIRMADO com o que ainda está sendo
   * montado.
   *
   * O servidor manda `risco` e `retornoPossivel` do que ele guardou — mas ele não
   * conhece as fichas que a pessoa acabou de encostar e ainda não confirmou. Mostrar só
   * o número dele deixava a linha dizer "risco 0" com fichas no pano; mostrar só o
   * local ignoraria uma aposta já de pé numa rodada com nulo. São os dois somados.
   *
   * O RISCO DA LINHA É METADE. É essa a diferença entre o que está na mesa e o que a
   * rodada pode custar, e é a informação que a pessoa precisa antes de decidir.
   */
  const totalNaMesa = total + (mesa.seats.find((s) => s.userId === meuId)?.pendingBets ?? [])
    .reduce((t, b) => t + b.amount, 0);
  const riscoDaMontagem = CASAS.reduce(
    (t, c) => t + (LINHAS.includes(c) ? soma(apostas[c]) / 2 : soma(apostas[c])),
    0,
  );
  const riscoNaMesa = riscoDaMontagem + (risco ?? 0);
  /*
   * O retorno da montagem é o do MELHOR resultado: só um sai por lançamento, então
   * somar Ases com Grande anunciaria um prêmio que não existe em cenário nenhum.
   */
  const retornoDaMontagem = Math.max(
    0,
    ...(['ases', 'pequeno', 'grande'] as const).map((o) =>
      CASAS.reduce((t, c) => {
        const posto = soma(apostas[c]);
        if (posto === 0) return t;
        const arco = LINHAS.includes(c) ? ARCO_DA_CASA[c] : c;
        const ganhou = arco === o;
        if (LINHAS.includes(c)) return t + (ganhou ? posto * 1.5 : posto * 0.5);
        return t + (ganhou ? posto * (c === 'ases' ? 62 : 2) : 0);
      }, 0),
    ),
  );
  const retornoNaMesa = Math.round(retornoDaMontagem + (retornoPossivel ?? 0));

  /* --- o lançamento: cada lance vira uma jogada na tigela, na hora em que acontece --- */
  const rodada = mesa.lastRound;
  const { dados, lance, girando, rapido: rapidoNaTela, saldoNaTela } = useLancamento(mesa, saldo);

  /*
   * A janela entre lançamentos: o dado saiu, não decidiu, e a mesa espera antes de
   * lançar de novo. É a hora de aumentar, mudar de lugar ou desistir — e desistir aqui
   * não custa nada, porque nesta mesa a ficha só sai do saldo quando o dado decide.
   *
   * O prazo vem do servidor como um INSTANTE, não como uma contagem que chega de
   * segundo em segundo: a tela conta sozinha a partir dele e continua certa mesmo
   * perdendo mensagem. E chegar a zero aqui não lança nada — quem lança é o servidor.
   */
  const janelaAberta = Boolean(mesa.rodada?.esperandoDepoisDeNulo) && !girando;
  const prazoDaJanela = janelaAberta ? mesa.fase?.terminaEm ?? null : null;
  const nulosAteAgora = mesa.rodada?.lancamentos.length ?? 0;
  const minhasApostasNaMesa = meuLugar?.pendingBets ?? [];
  const tenhoFichaNaMesa = minhasApostasNaMesa.length > 0;

  /* Rodada nova chegou: o que estava só encostado já foi pro servidor, a mesa limpa. */
  const marcaDaRodada = rodada?.at;
  useEffect(() => {
    if (!marcaDaRodada) return;
    setApostas(MESA_LIMPA);
    setOrdem([]);
  }, [marcaDaRodada]);

  const travado = ocupado || girando;

  /*
   * Tem ficha de alguém na mesa? Conta as apostas JÁ CONFIRMADAS no servidor
   * (`pendingBets`) mais as que esta pessoa montou e ainda não confirmou — as duas
   * valem, porque confirmar a montagem é um toque e o botão de lançar não deve ficar
   * apagado enquanto a pessoa está com a ficha na mão.
   */
  const temApostaNaMesa = mesa.seats.some((assento) => assento.pendingBets.length > 0) || total > 0;

  /*
   * Enquanto os dados estão no ar, o app não se atualiza sozinho.
   *
   * A atualização automática recarrega a página, e recarregar no meio de um lançamento
   * faria a mesa sumir com os dados rolando. Nada de dinheiro se perde — a rodada está
   * no servidor — mas some justamente a parte que a pessoa está olhando. A atualização
   * espera os dados assentarem.
   */
  useEffect(() => {
    if (!girando) return undefined;
    estouOcupado(true);
    return () => estouOcupado(false);
  }, [girando]);

  const encostar = (casa: BancaFrancesaBetType) => {
    if (travado) return;

    /*
     * A CONFERÊNCIA AQUI É A MESMA DO SERVIDOR, com os números que ELE mandou.
     *
     * Não é a tela decidindo a regra — é a tela evitando que a pessoa monte uma aposta
     * inteira pra ouvir "não" depois. O servidor confere de novo de qualquer jeito, e é
     * ele quem manda; se um dia os dois discordarem, quem vale é o de lá.
     */
    const limite = limites?.[casa];
    if (limite) {
      const depois = soma(apostas[casa]) + ficha;
      if (depois > limite.maximo) {
        return setRecado(
          `O máximo em ${nomeDaCasa?.[casa] ?? casa} é ${limite.maximo.toLocaleString('pt-BR')}.`,
        );
      }
    }

    /*
     * O saldo é conferido contra o RISCO, não contra o valor cheio das fichas: uma
     * ficha de 100 na linha só pode custar 50.
     */
    const riscoAtual = CASAS.reduce(
      (t, c) => t + (LINHAS.includes(c) ? soma(apostas[c]) / 2 : soma(apostas[c])),
      0,
    );
    const riscoDaNova = LINHAS.includes(casa) ? ficha / 2 : ficha;
    if (riscoAtual + riscoDaNova > saldo) return setRecado('Você não tem fichas suficientes pra essa.');
    /*
     * NÃO EXISTE MÁXIMO POR CASA. A única trava é o saldo, conferida na linha acima —
     * é a mesma regra que o servidor aplica (`problemaComAAposta`), e as duas
     * precisam dizer a mesma coisa: uma trava só na tela seria uma regra invisível,
     * que recusa a aposta sem que exista motivo do outro lado.
     */
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
    if (abaixoDoMinimo.length > 0) {
      const casa = abaixoDoMinimo[0];
      const piso = limites?.[casa]?.minimo ?? minimo;
      return `Mínimo ${piso.toLocaleString('pt-BR')} em ${nomeDaCasa?.[casa] ?? casa}`;
    }
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
      {dados.length > 0 && <DadosNaTigela faces={dados} lance={lance} rapido={rapidoNaTela} />}

      <SafeAreaView style={styles.frente} edges={['top', 'bottom']} pointerEvents="box-none">
        <View
          style={styles.barraDeCima}
          pointerEvents="box-none"
          onLayout={(e) => setAlturaDaBarra(e.nativeEvent.layout.height)}
        >
          <BotaoRedondo icone="chevron-back" rotulo="Sair da mesa" onPress={onSair} />
          <ChipStack amount={saldoNaTela} />
          <View style={styles.botoesDaDireita}>
            <BotaoRedondo icone="help-circle" rotulo="O que cada aposta paga" onPress={() => setQuadroAberto(true)} />
            <BotaoRedondo
              icone="people"
              rotulo={
                rotuloDoPainel ??
                `Quem está na mesa, ${mesa.seats.length} ${mesa.seats.length === 1 ? 'pessoa' : 'pessoas'}`
              }
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

          {/*
            * O TRILHO TEM A LINHA INTEIRA, e os botões redondos foram pra linha de baixo.
            *
            * Espremido entre os dois blocos de botões, ele ficava com 95 pixels de 320 —
            * uma ficha e meia visível, com o resto atrás de uma seta. As fichas são o
            * controle mais usado da mesa (cada aposta é um toque numa delas) e estavam
            * com a menor parte da linha; desfazer, limpar e repetir são de vez em quando.
            */}
          <View style={styles.linhaDoTrilho}>
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
              minimo={minimo}
              fichas={fichasDaMesa}
            />
          </View>

          <View style={styles.linhaDosBotoesRedondos}>
            <BotaoRedondo icone="arrow-undo" rotulo="Desfazer a última ficha" onPress={desfazer} inativo={travado || ordem.length === 0} />
            <BotaoRedondo icone="trash-outline" rotulo="Limpar a mesa" onPress={limpar} inativo={travado || total === 0} />
            <BotaoRedondo icone="repeat" rotulo="Repetir a aposta anterior" onPress={repetir} inativo={travado || !anterior} />
          </View>

          {/*
            * Em que mesa se está jogando, e o que ela aceita.
            *
            * A placa na porta, como em cassino de verdade: o preço da rodada está
            * escrito ANTES de sentar, e não descoberto no erro depois de montar a
            * aposta. Some numa tela baixa, onde cada linha disputa espaço com o pano.
            */}
          {/*
            "SEM TETO" SAIU DA PLACA, e não foi enfeite: existe teto, e ele é por casa.
            Ases vai até seis mínimos, os arcos até duzentos, e a linha começa no dobro
            do mínimo porque a ficha vale metade lá. Anunciar "sem teto" com um limite
            no servidor é a mesa mentindo na porta — o jogador monta a aposta e só
            descobre no erro.

            Os números vêm PRONTOS do servidor (`limites`). A tela não os recalcula.
          */}
          {!apertado && (
            <Text style={styles.placaDaMesa} numberOfLines={2}>
              {nomeDoNivel ? `Mesa ${nomeDoNivel} · ` : ''}
              {limites
                ? `Ases ${limites.ases.minimo.toLocaleString('pt-BR')}–${limites.ases.maximo.toLocaleString('pt-BR')} · ` +
                  `Grande e Pequeno ${limites.grande.minimo.toLocaleString('pt-BR')}–${limites.grande.maximo.toLocaleString('pt-BR')} · ` +
                  `linha a partir de ${limites['linha-grande'].minimo.toLocaleString('pt-BR')} (vale metade)`
                : `mínimo ${minimo.toLocaleString('pt-BR')} por casa`}
            </Text>
          )}

          {/*
            AS QUATRO CONTAS QUE A PESSOA PRECISA ANTES DE DECIDIR, e não depois.
            Aposta total é o que está na mesa; RISCO é o que pode custar de verdade (na
            linha, metade); retorno possível é o do MELHOR resultado (só um sai por
            lançamento, então somar todos anunciaria um prêmio que não existe); e o
            saldo restante é o que sobra se tudo der errado. Os quatro vêm do servidor.
          */}
          {totalNaMesa > 0 && (
            <Text style={styles.contasDaAposta} numberOfLines={2}>
              Aposta {totalNaMesa.toLocaleString('pt-BR')} · risco{' '}
              {riscoNaMesa.toLocaleString('pt-BR')} · pode devolver até{' '}
              {retornoNaMesa.toLocaleString('pt-BR')} · sobram{' '}
              {Math.max(0, saldo - riscoNaMesa).toLocaleString('pt-BR')}
            </Text>
          )}

          {/*
            * A faixa da janela fica no AVENTAL, junto das mãos, e não em cima do pano.
            * Em cima do pano ela taparia a mesa justamente no momento em que a pessoa
            * precisa olhar pra ela pra decidir onde pôr a ficha.
            */}
          {/*
            A faixa aparece sempre que a janela está aberta — com ou sem prazo. Antes
            ela exigia `prazoDaJanela !== null`, e por isso a mesa de um jogador só
            (que não tem relógio) ficava sem o aviso de LANÇAMENTO NULO: os dados
            paravam num 8, nada acontecia, e a tela não dizia por quê.
          */}
          {janelaAberta && (
            <FaixaDaJanela
              prazo={prazoDaJanela}
              lancesNulos={nulosAteAgora}
              podeRetirar={tenhoFichaNaMesa && !travado}
              onRetirar={onRetirar}
            />
          )}

          <View style={[styles.linhaDeBotoes, apertado && styles.linhaApertada]}>
            {/*
              O BOTÃO DE CONFIRMAR SÓ EXISTE QUANDO HÁ O QUE CONFIRMAR.
              *
              * Com a aposta já confirmada e nenhuma ficha nova encostada, ele ficava na
              * tela dizendo "Encoste uma ficha no pano" — visível, aparentando ser a
              * ação principal, e sem fazer nada. Depois de confirmar, a única ação
              * válida é lançar; é essa que fica.
              */}
            {(total > 0 || !tenhoFichaNaMesa) && (
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
            )}

            {/*
              * Só o anfitrião lança — é ele quem faz o papel do dealer nesta mesa.
              *
              * E só com aposta na mesa. O servidor recusa lançar numa mesa vazia (uma
              * rodada inteira sem uma ficha em jogo suja o placar com um resultado que
              * ninguém apostou), então o botão diz isso antes em vez de deixar tocar e
              * devolver erro.
              */}
            {ehAnfitriao && (
              <Pressable
                onPress={onGirar}
                disabled={travado || !temApostaNaMesa}
                accessibilityRole="button"
                accessibilityLabel={
                  !temApostaNaMesa
                    ? 'Ninguém apostou ainda'
                    : esperandoDepoisDoNulo
                      ? 'Jogar novamente, com a mesma aposta'
                      : 'Lançar os dados'
                }
                accessibilityState={{ disabled: travado || !temApostaNaMesa }}
                style={[styles.botaoLancar, (travado || !temApostaNaMesa) && styles.desabilitado]}
              >
                <Ionicons name={esperandoDepoisDoNulo ? 'refresh' : 'dice'} size={22} color={colors.goldBright} />
                {/*
                  Depois de um nulo o botão vira "Jogar novamente" — porque é isso que
                  ele faz. "Lançar" ali sugeriria uma rodada nova, e a rodada é a mesma:
                  as mesmas fichas, na mesma mesa, sem nada ter sido cobrado.
                */}
                <Text style={styles.botaoLancarTexto}>
                  {esperandoDepoisDoNulo ? 'Jogar novamente' : 'Lançar'}
                </Text>
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
function useLancamento(mesa: TableView, saldo: number) {
  const [dados, setDados] = useState<number[]>([]);
  const [lance, setLance] = useState(0);
  const [rapido, setRapido] = useState(false);
  /** Um lance está sendo encenado agora: a mesa fica travada enquanto os dados voam. */
  const [girando, setGirando] = useState(false);
  /*
   * O MESMO "está no ar", mas em ref.
   *
   * `girando` é estado: quem lê num efeito lê o valor do desenho ANTERIOR. E o resultado
   * chega no mesmo desenho em que a encenação começa — então um efeito que perguntasse
   * "está girando?" ouviria "não" justamente no instante em que os dados saem da mão.
   * A ref muda na hora, dentro do mesmo efeito que dispara a encenação, e é ela que o
   * saldo consulta.
   */
  const noAr = useRef(false);

  /** Que rodada está em cena e quantos lances dela já foram pra tela. */
  const emCena = useRef({ rodadaId: '', mostrados: 0 });
  /** A última apuração encenada, pra o decisivo não ser jogado duas vezes. */
  const ultimaApuracao = useRef<string | undefined>(undefined);

  const rodada = mesa.rodada;
  const resultado = mesa.lastRound;
  const rodadaId = rodada?.rodadaId ?? '';
  const lancesFeitos = rodada?.lancamentos.length ?? 0;
  const marcaDaApuracao = resultado?.at;

  useEffect(() => {
    /** Joga estes lances na tigela, um depois do outro, e devolve como cancelar. */
    const encenar = (lances: { dice: number[] }[], rapidos: boolean) => {
      let vivo = true;
      const relogios: ReturnType<typeof setTimeout>[] = [];
      const espera = (ms: number) => new Promise<void>((ok) => relogios.push(setTimeout(ok, ms)));

      (async () => {
        noAr.current = true;
        setGirando(true);
        for (const item of lances) {
          if (!vivo) return;
          setRapido(rapidos);
          setDados(item.dice);
          setLance((n) => n + 1);
          await espera(rapidos ? ATE_ASSENTAR_RAPIDO + OLHADA_NO_NULO : ATE_ASSENTAR);
        }
        if (vivo) {
          noAr.current = false;
          setGirando(false);
        }
      })();

      return () => {
        vivo = false;
        noAr.current = false;
        relogios.forEach(clearTimeout);
      };
    };

    // A rodada virou: o que falta encenar é o lance que DECIDIU. Os nulos dela já
    // foram jogados um a um, no momento em que aconteceram — repetir aqui seria
    // mostrar duas vezes o mesmo dado.
    if (rodadaId && rodadaId !== emCena.current.rodadaId) {
      emCena.current = { rodadaId, mostrados: 0 };
      if (resultado && marcaDaApuracao !== ultimaApuracao.current) {
        ultimaApuracao.current = marcaDaApuracao;
        return encenar([{ dice: resultado.dice }], false);
      }
      // Sentei agora numa mesa que já estava aberta: não há o que encenar.
      return;
    }

    // Lances novos da rodada em andamento. São nulos por definição: o que decide
    // encerra a rodada, e aí ele chega pelo caminho de cima.
    if (rodada && lancesFeitos > emCena.current.mostrados) {
      const novos = rodada.lancamentos.slice(emCena.current.mostrados);
      emCena.current = { rodadaId, mostrados: lancesFeitos };
      return encenar(novos, true);
    }

    return undefined;
    // `rodada` e `resultado` entram pelos campos que mudam: o objeto é novo a cada
    // mensagem do servidor e reencenaria tudo a cada respiro da mesa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rodadaId, lancesFeitos, marcaDaApuracao]);

  /*
   * O SALDO NÃO SE MEXE ENQUANTO OS DADOS ESTÃO NO AR.
   *
   * O servidor apura ANTES de a tela desenhar — é assim que tem que ser, e é o que
   * garante que a animação conta o que já aconteceu em vez de decidir. Só que o saldo
   * chegava junto com a apuração e subia na barra de cima com os dados ainda rolando:
   * dava pra saber que tinha ganhado dois segundos antes de o dado parar. A rolagem
   * virava enfeite de um resultado que a tela já tinha contado.
   *
   * Então a barra segura o número que estava antes e só troca quando os dados assentam.
   * Isto NÃO é esconder saldo: o valor certo já chegou, está aqui, e espera o dado parar
   * — nunca mais que uma jogada. É o oposto daquele defeito em que a tela mostrava
   * 10.000 pra quem já tinha perdido tudo: ali o número estava errado; aqui ele está
   * certo e aparece no tempo do jogo.
   *
   * Este efeito fica DEPOIS do de cima de propósito. Efeitos rodam na ordem em que são
   * declarados, então quando este roda a `noAr` já foi virada pela encenação que acabou
   * de começar — que é exatamente o instante que o `girando` ainda não enxerga.
   */
  const [saldoNaTela, setSaldoNaTela] = useState(saldo);
  useEffect(() => {
    if (!noAr.current) setSaldoNaTela(saldo);
  }, [saldo, girando]);

  return { dados, lance, girando, rapido, saldoNaTela };
}

/**
 * A faixa da janela entre lançamentos: quanto falta, e o botão de desistir.
 *
 * O relógio conta a partir de um INSTANTE que o servidor mandou, e não de mensagens
 * chegando de segundo em segundo — assim ele continua certo mesmo se a rede engasgar, e
 * adiantar o celular não muda nada, porque quem lança o dado é o servidor.
 *
 * O texto diz o que aconteceu sem enfeitar: o dado saiu, não decidiu, sua aposta
 * continua de pé. Nada de "quase!" — não houve quase nenhum. Uma soma nula não chegou
 * perto de decidir; ela simplesmente não decide.
 */
/**
 * A faixa do LANÇAMENTO NULO.
 *
 * `prazo` é NULO na mesa de um jogador só, e é assim de propósito: ali não existe
 * relógio. O lançamento nulo para a rodada e ela fica parada até a pessoa decidir — não
 * há mais ninguém esperando, então não há por que apressar. Desenhar um contador onde
 * não existe prazo seria inventar pressa, que é exatamente o que este jogo não faz.
 *
 * Na mesa com gente o prazo existe e é do SERVIDOR: os outros jogadores estão
 * esperando, e o relógio é a única coisa justa entre eles.
 */
function FaixaDaJanela({
  prazo,
  lancesNulos,
  podeRetirar,
  onRetirar,
}: {
  prazo: number | null;
  lancesNulos: number;
  podeRetirar: boolean;
  onRetirar: () => Promise<unknown>;
}) {
  const [restante, setRestante] = useState(() => (prazo === null ? 0 : Math.max(0, prazo - Date.now())));

  useEffect(() => {
    if (prazo === null) return undefined;
    setRestante(Math.max(0, prazo - Date.now()));
    const relogio = setInterval(() => setRestante(Math.max(0, prazo - Date.now())), 250);
    return () => clearInterval(relogio);
  }, [prazo]);

  const segundos = Math.ceil(restante / 1000);

  return (
    <View style={styles.faixaDaJanela}>
      <View style={styles.contagem}>
        <Ionicons
          name={prazo === null ? 'dice-outline' : 'time-outline'}
          size={16}
          color={colors.goldBright}
        />
        {prazo !== null && <Text style={styles.contagemNumero}>{segundos}s</Text>}
      </View>

      <Text style={styles.faixaTexto} numberOfLines={3}>
        {prazo === null
          ? `LANÇAMENTO NULO${lancesNulos > 1 ? ` (${lancesNulos}º)` : ''} — nada foi cobrado. Sua aposta continua na mesa: dá pra manter, aumentar, mudar ou tirar.`
          : lancesNulos === 1
            ? 'Os dados não decidiram. Sua aposta continua de pé — dá pra aumentar, mudar ou tirar.'
            : `${lancesNulos} lançamentos sem decidir. Sua aposta continua de pé — dá pra aumentar, mudar ou tirar.`}
      </Text>

      {podeRetirar && (
        <Pressable
          onPress={onRetirar}
          accessibilityRole="button"
          accessibilityLabel="Tirar minhas fichas da mesa"
          style={styles.botaoRetirar}
        >
          <Ionicons name="hand-left-outline" size={16} color={colors.textPrimary} />
          <Text style={styles.botaoRetirarTexto}>Tirar minhas fichas</Text>
        </Pressable>
      )}
    </View>
  );
}

/*
 * Não existe mais um teto de nulos mostrados. Antes a rodada inteira chegava resolvida
 * e a tela encenava só os dois primeiros relançamentos pra não custar dez segundos —
 * agora cada lance CHEGA no momento em que acontece, e entre um e outro tem uma janela
 * de aposta de verdade. Mostrar todos deixou de ser um custo e passou a ser o jogo.
 */
/*
 * Quanto dura cada lançamento, em quadros de 60 por segundo.
 *
 * Os mesmos números vão pro motor de física e pro relógio da encenação — é o que
 * mantém a tela e os dados combinados. Com duas fontes, ou a rodada seguiria com os
 * dados ainda rolando, ou ficaria esperando dados já parados.
 *
 * O decisivo é mais longo porque tem que dar tempo de LER o que saiu; o nulo é curto
 * porque não decide nada e pode acontecer três ou quatro vezes seguidas.
 */
const QUADROS_DO_DECISIVO = 132; // 2,2s
const QUADROS_DO_NULO = 96; // 1,6s
const ATE_ASSENTAR = (QUADROS_DO_DECISIVO / 60) * 1000;
const ATE_ASSENTAR_RAPIDO = (QUADROS_DO_NULO / 60) * 1000;
/** Respiro entre um lançamento nulo e o seguinte, pra ler a soma antes de recolher. */
const OLHADA_NO_NULO = 380;
/**
 * Quanto o pano leva pra encenar UM lançamento nulo, do copo até a soma lida.
 *
 * Sai daqui porque quem precisa dele é a mesa de um jogador só. Lá o servidor resolve a
 * rodada inteira numa chamada — os nulos e o decisivo chegam juntos —, e a tela precisa
 * entregá-los ao pano no compasso em que ele os desenha. Com um número copiado, o
 * decisivo entraria por cima de um nulo ainda rolando, ou a mesa ficaria parada olhando
 * dados já assentados.
 */
export const PAUSA_DO_NULO = ATE_ASSENTAR_RAPIDO + OLHADA_NO_NULO;

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

/**
 * Os três dados sendo lançados DENTRO da tigela de couro.
 *
 * A arena da física sai da tigela desenhada na arte, medida em `TIGELA_DA_BANCA.chao` —
 * o couro útil, sem a moldura. Convertida pra a unidade do motor, que mede em meios
 * dados: o dado tem raio 1, então uma tigela de 280 pixels com dado de 37 tem raio 7,6.
 *
 * A tigela é bem mais larga do que alta, porque é vista de cima e de viés. Os dados
 * batem muito mais nas laterais do que em cima e embaixo — que é o que acontece numa
 * tigela de verdade nesse ângulo, e é por isso que a arena não é redonda.
 *
 * A SEMENTE vem do número do lançamento. Dois efeitos: o mesmo lançamento redesenhado
 * (uma remontagem da tela no meio da animação) continua idêntico em vez de saltar, e
 * lançamentos diferentes caem diferente sem ninguém sortear nada à mão.
 */
function DadosNaTigela({ faces, lance, rapido }: { faces: number[]; lance: number; rapido: boolean }) {
  const palco = usePalco();

  const preparado = useMemo(() => {
    if (!palco || faces.length === 0) return null;

    const tamanho = dadoNaTigela(palco.largura);
    // O motor mede em meios dados; o dado desenhado tem `tamanho` pixels de lado.
    const escalaDoMundo = tamanho / 2;

    const { esquerda, direita, topo, base } = TIGELA_DA_BANCA.chao;
    const larguraDoCouro = (direita - esquerda) * palco.largura;
    const alturaDoCouro = (base - topo) * palco.altura;

    const arena: Arena = {
      formato: 'elipse',
      raioX: larguraDoCouro / 2 / escalaDoMundo,
      raioY: alturaDoCouro / 2 / escalaDoMundo,
    };

    const centro = {
      x: palco.esquerda + ((esquerda + direita) / 2) * palco.largura,
      y: palco.topo + ((topo + base) / 2) * palco.altura,
    };

    const lancamento = lancarDados({
      faces,
      arena,
      semente: lance * 7919 + faces.reduce((soma, f, i) => soma + f * (i + 1) * 31, 0),
      // Entram por cima e pela esquerda, como quem despeja o copo na beirada.
      /*
       * A altura de entrada é 5, e não mais: cada unidade sobe pouco mais de meio dado
       * na tela, e com 8 os dados nasciam ACIMA DA BORDA DA MESA — os primeiros quadros
       * mostravam dado pela metade, cortado pelo tampo, antes de entrarem na tigela.
       * Cinco deixa a queda visível inteira, com a sombra já dentro da tigela.
       */
      entrada: { x: -arena.raioX * 0.6, y: -arena.raioY * 0.5, z: 5 },
      /*
       * O lançamento nulo é mais curto: ele não decide nada, e a rodada pode ter três ou
       * quatro deles seguidos. No tempo do decisivo, uma rodada azarada viraria dez
       * segundos de dado rolando antes de qualquer resultado.
       */
      quadrosFixos: rapido ? QUADROS_DO_NULO : QUADROS_DO_DECISIVO,
    });

    return { lancamento, tamanho, escalaDoMundo, centro };
  }, [palco, faces, lance]);

  if (!preparado) return null;

  return (
    <>
      {preparado.lancamento.caminhos.map((caminho, indice) => (
        <DadoFisico
          key={indice}
          caminho={caminho}
          faces={FACES_DO_DADO}
          tamanho={preparado.tamanho}
          escalaDoMundo={preparado.escalaDoMundo}
          centro={preparado.centro}
          chave={lance}
        />
      ))}
    </>
  );
}

function Trilho({ apertado, ...resto }: {
  apertado: boolean;
  selecionada: number;
  onSelecionar: (valor: number) => void;
  cor: PlayerColor | undefined;
  saldo: number;
  travado: boolean;
  /** O mínimo do nível, e as fichas que o servidor calculou pra ele. */
  minimo: number;
  fichas?: number[];
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
  linhaDeBotoes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  contasDaAposta: {
    color: colors.goldBright,
    fontFamily: fontFamily.displayBold,
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
  placaDaMesa: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: 2,
  },
  /* A faixa da janela entre lançamentos: contagem, o que houve, e como desistir. */
  faixaDaJanela: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: 'rgba(11,15,13,0.82)',
  },
  contagem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  contagemNumero: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
    color: colors.goldBright,
    // Largura fixa: sem isto o texto ao lado pula quando a contagem passa de 10 pra 9.
    minWidth: 34,
  },
  faixaTexto: { flex: 1, fontFamily: fontFamily.body, fontSize: fontSize.sm, color: colors.textSecondary },
  botaoRetirar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.textSecondary,
  },
  botaoRetirarTexto: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.sm, color: colors.textPrimary },
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
