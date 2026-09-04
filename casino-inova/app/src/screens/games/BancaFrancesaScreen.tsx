import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../../navigation/types';
import { ApiError, novaAcao } from '../../api/client';
import {
  confirmarApostas,
  fetchBancaFrancesaConfig,
  fetchRodadaDaBanca,
  lancarDados,
  retirarApostas,
  BancaFrancesaBet,
  BancaFrancesaConfig,
  LancamentoDaBanca,
  RodadaDaBanca,
} from '../../api/bancaFrancesa';
import { LancamentoView, TableView } from '../../api/bancaFrancesaMesa';
import { usePlayer, saldoChegouDeFora } from '../../data/usePlayer';
import { corDoJogador } from '../../data/fichasDeValor';
import { usuarioLogadoId } from '../../api/session';
import { PanoDaBancaFrancesa, PAUSA_DO_NULO } from './PanoDaBancaFrancesa';

type Props = NativeStackScreenProps<RootStackParamList, 'BancaFrancesa'>;

/**
 * Banca Francesa CONTRA A CASA — a mesa de um jogador só.
 *
 * O LANÇAMENTO NULO VOLTOU A SER DO JOGADOR, e é a mudança que reorganiza esta tela
 * inteira. Antes o servidor resolvia tudo numa chamada: debitava, relançava sozinho até
 * sair um resultado decisivo e pagava. A tela recebia o fim pronto e ENCENAVA os nulos
 * depois, como quem conta uma história que já acabou — a pessoa via os dados caírem num
 * 8, mas não havia decisão nenhuma pra tomar ali, porque o próximo lance já tinha
 * acontecido no servidor.
 *
 * Agora cada lance é uma ação:
 *
 *   1. A pessoa encosta as fichas e confirma. NADA é cobrado.
 *   2. Ela toca em Lançar. Um lançamento, um só.
 *   3. Se a soma não decidir, a rodada PARA. Os dados ficam na mesa, as fichas ficam na
 *      mesa, e ninguém foi cobrado. Dá pra manter, aumentar, mudar de casa ou tirar.
 *   4. Ela decide quando lançar de novo. Não existe relógio: não há mais ninguém
 *      esperando numa mesa de um.
 *   5. Só o lançamento que decide mexe no saldo.
 *
 * O ESTADO É DO SERVIDOR. Esta tela não guarda "em que pé está a rodada": ela pergunta
 * (`/rodada`) e desenha a resposta. É o que faz recarregar a página no meio de uma
 * sequência de nulos devolver a mesa exatamente como estava.
 */
export function BancaFrancesaScreen({ navigation }: Props) {
  const { jogador } = usePlayer();
  const meuId = usuarioLogadoId();

  const [config, setConfig] = useState<BancaFrancesaConfig | null>(null);
  const [rodada, setRodada] = useState<RodadaDaBanca | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  /**
   * Os lançamentos que o PANO já mostrou, e o que falta mostrar.
   *
   * O pano anima cada lance novo que aparece na lista. Como agora chega um lance por
   * ação, a lista cresce de um em um e a animação sai naturalmente no compasso do jogo
   * — não é mais uma encenação de coisas que já tinham acontecido.
   */
  const [nulosNaTela, setNulosNaTela] = useState<LancamentoView[]>([]);
  const [ultimoDecisivo, setUltimoDecisivo] = useState<TableView['lastRound']>(undefined);
  const [rodadaNaTela, setRodadaNaTela] = useState('inicio');

  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const recarregarRodada = useCallback(async () => {
    try {
      const r = await fetchRodadaDaBanca();
      if (!vivo.current) return;
      setRodada(r);
      /* Reconexão: os nulos que já aconteceram voltam pra tela sem serem reanimados. */
      setNulosNaTela(r.nulos.map(paraLancamentoDoPano));
      setRodadaNaTela(r.rodadaId);
    } catch {
      /* Sem rodada não dá pra jogar, mas o erro de config já cobre a mesa fora do ar. */
    }
  }, []);

  useEffect(() => {
    fetchBancaFrancesaConfig()
      .then(setConfig)
      .catch((e: unknown) => setErro(e instanceof ApiError ? e.message : 'Não foi possível falar com o servidor.'));
    void recarregarRodada();
  }, [recarregarRodada]);

  const saldo = rodada?.saldo ?? jogador?.chipBalance ?? 0;

  /**
   * A mesa, no formato que o pano lê.
   *
   * O pano é o MESMO da mesa com gente — é o que garante que as duas jogam igual. O que
   * muda é de onde vem o estado, e é isto que traduz.
   */
  const mesa: TableView = useMemo(
    () => ({
      id: 'sozinho',
      code: '',
      visibility: 'privada',
      hostUserId: meuId ?? 'eu',
      seats: [
        {
          userId: meuId ?? 'eu',
          name: jogador?.name ?? 'Você',
          isBot: false,
          color: corDoJogador(meuId ?? undefined) ?? 'branco',
          pendingBets: rodada?.apostas ?? [],
          balance: saldo,
        },
      ],
      lastRound: ultimoDecisivo,
      rodada: {
        rodadaId: rodadaNaTela,
        lancamentos: nulosNaTela,
        /*
         * A janela abre depois de um nulo — e aqui ela NÃO TEM PRAZO, porque não há
         * relógio numa mesa de um. `fase` fica de fora de propósito: sem ela o pano
         * desenha a faixa de LANÇAMENTO NULO sem contador.
         */
        esperandoDepoisDeNulo: Boolean(rodada?.esperandoDepoisDoNulo),
      },
    }),
    [meuId, jogador?.name, rodada, saldo, ultimoDecisivo, rodadaNaTela, nulosNaTela],
  );

  /** Confirma a montagem no servidor. Ele confere limites e saldo e devolve a rodada. */
  const handleApostar = async (bets: BancaFrancesaBet[]) => {
    if (ocupado) return false;
    setOcupado(true);
    try {
      /*
       * O pano manda a montagem NOVA; o servidor guarda a lista inteira da rodada.
       * Somar aqui com o que já estava seria a tela decidindo quanto está apostado — e
       * é o servidor que decide, porque é ele que confere o limite de cada casa.
       */
      const somado = new Map((rodada?.apostas ?? []).map((b) => [b.type, b.amount]));
      for (const b of bets) somado.set(b.type, (somado.get(b.type) ?? 0) + b.amount);

      const r = await confirmarApostas([...somado.entries()].map(([type, amount]) => ({ type, amount })));
      setRodada(r);
      setErro(null);
      setAviso(null);
      return true;
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível confirmar a aposta.');
      return false;
    } finally {
      if (vivo.current) setOcupado(false);
    }
  };

  const handleRetirar = async () => {
    if (ocupado) return;
    setOcupado(true);
    try {
      setRodada(await retirarApostas());
      setErro(null);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível tirar as fichas.');
    } finally {
      if (vivo.current) setOcupado(false);
    }
  };

  const espera = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));

  /**
   * UM lançamento.
   *
   * A ordem da revelação é a ordem do que aconteceu: o dado rola, e só quando ele
   * assenta é que o texto e o saldo entram. O servidor já decidiu antes da primeira
   * animação — é o que garante que o desenho conta o que houve em vez de escolher.
   */
  const handleLancar = async () => {
    if (ocupado || !rodada || rodada.apostas.length === 0) return;
    setOcupado(true);
    setErro(null);
    setAviso(null);
    try {
      const r = await lancarDados(novaAcao());

      if (!r.decidiu) {
        /* Nulo: um dado a mais na tigela, e a mesa volta pra quem apostou. */
        setNulosNaTela((atual) => [...atual, paraLancamentoDoPano(r.lancamento)]);
        await espera(PAUSA_DO_NULO);
        if (!vivo.current) return;
        setRodada(r.rodada);
        return;
      }

      /*
       * Decisivo: o pano encena quando a rodada VIRA — id novo mais um resultado novo.
       * Por isso os nulos saem da lista junto, e não antes: tirá-los antes faria o pano
       * ver a lista encolher e reencenar do zero.
       */
      setNulosNaTela([]);
      setUltimoDecisivo({
        dice: r.lancamento.dice,
        sum: r.lancamento.sum,
        outcome: r.lancamento.outcome as 'ases' | 'pequeno' | 'grande',
        rerolls: rodada.nulos.length,
        lancamentosNulos: rodada.nulos.map((n) => n.dice),
        bySeat: {
          [meuId ?? 'eu']: {
            results: r.results,
            totalStake: r.totalStake,
            totalReturn: r.totalReturn,
          },
        },
        at: r.lancamento.createdAt,
      });
      setRodadaNaTela(r.rodada.rodadaId);
      setRodada(r.rodada);
      setAviso(
        r.lucroLiquido >= 0
          ? `Retorno ${r.totalReturn.toLocaleString('pt-BR')} · lucro ${r.lucroLiquido.toLocaleString('pt-BR')}`
          : `Perdeu ${Math.abs(r.lucroLiquido).toLocaleString('pt-BR')}`,
      );
      /*
       * O saldo entra pelo caminho de fora, e o pano o segura até os dados assentarem —
       * é o que impede a barra de contar o resultado antes da animação terminar.
       */
      saldoChegouDeFora(r.newBalance);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível lançar agora.');
    } finally {
      if (vivo.current) setOcupado(false);
    }
  };

  return (
    <PanoDaBancaFrancesa
      mesa={mesa}
      meuId={meuId}
      /* Contra a casa quem lança é sempre quem está jogando: não há outro dealer aqui. */
      ehAnfitriao
      ocupado={ocupado}
      saldo={saldo}
      minimo={rodada?.minimoDaMesa ?? config?.minBet ?? 50}
      /* As fichas do degrau vêm com a rodada — uma fonte só, e ela é o servidor. */
      fichasDaMesa={rodada?.fichas}
      nomeDoNivel={rodada?.nomeDoNivel}
      limites={rodada?.limites}
      nomeDaCasa={config?.nomeDaCasa}
      risco={rodada?.risco ?? 0}
      retornoPossivel={rodada?.retornoPossivel ?? 0}
      saldoDepoisDaAposta={rodada?.saldoDepoisDaAposta ?? saldo}
      esperandoDepoisDoNulo={Boolean(rodada?.esperandoDepoisDoNulo)}
      config={config}
      onApostar={handleApostar}
      onGirar={handleLancar}
      onRetirar={handleRetirar}
      onSair={() => navigation.goBack()}
      onAbrirPainel={() => navigation.navigate('BancaFrancesaMesa')}
      rotuloDoPainel="Jogar numa mesa com outras pessoas"
      erro={erro}
      aviso={aviso}
    />
  );
}

/** O lançamento do servidor no formato que o pano usa pra animar. */
function paraLancamentoDoPano(l: LancamentoDaBanca): LancamentoView {
  return { dice: l.dice, sum: l.sum, outcome: null };
}
