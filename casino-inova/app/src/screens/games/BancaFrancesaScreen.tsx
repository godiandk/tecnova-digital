import { useEffect, useMemo, useRef, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../../navigation/types';
import { ApiError } from '../../api/client';
import {
  fetchBancaFrancesaConfig,
  playBancaFrancesaRound,
  BancaFrancesaBet,
  BancaFrancesaConfig,
} from '../../api/bancaFrancesa';
import { fetchMeuNivel, MeuNivel } from '../../api/niveis';
import { LancamentoView, TableView } from '../../api/bancaFrancesaMesa';
import { usePlayer, saldoChegouDeFora } from '../../data/usePlayer';
import { corDoJogador } from '../../data/fichasDeValor';
import { usuarioLogadoId } from '../../api/session';
import { PanoDaBancaFrancesa, PAUSA_DO_NULO } from './PanoDaBancaFrancesa';

type Props = NativeStackScreenProps<RootStackParamList, 'BancaFrancesa'>;

/**
 * Banca Francesa CONTRA A CASA — a mesa de um jogador só.
 *
 * Esta tela era outra coisa: uma lista rolável de cartões escritos ("Centro do Pequeno /
 * Soma 5, 6 ou 7"), um − e um + pra escolher o valor e três dados desenhados como
 * números dentro de quadradinhos. A mesa online já tinha virado mesa de verdade — pano,
 * fichas encostadas na casa, dados lançados na tigela de couro — e esta tinha ficado
 * pra trás. Duas telas para o mesmo jogo, com regras que pareciam diferentes só porque
 * eram desenhadas diferente.
 *
 * Agora as duas usam O MESMO PANO. O que muda entre elas é só quem está na mesa e por
 * onde a jogada trafega:
 *
 *   MESA ONLINE  — várias pessoas, cada uma com sua cor; as apostas ficam no servidor
 *                  (`pendingBets`) e os lances chegam pelo socket, um a um, com uma
 *                  janela de aposta de verdade entre eles.
 *
 *   AQUI         — uma pessoa só; as apostas ficam NA TELA até ela mandar lançar, e a
 *                  rodada inteira vem numa chamada só. Não há janela entre lances, e a
 *                  tela não finge que há: o pano recebe `esperandoDepoisDeNulo: false`.
 *
 * O QUE NÃO MUDA, e é o ponto: quem decide o resultado é o servidor, antes de qualquer
 * animação. Os dados que rolam na tigela são os dados que já saíram — inclusive os
 * lançamentos que não decidiram nada, que agora chegam junto (`lancamentosNulos`) e são
 * jogados um a um, no compasso do pano. A animação conta o que aconteceu; ela nunca
 * escolhe.
 */
export function BancaFrancesaScreen({ navigation }: Props) {
  const { jogador } = usePlayer();
  const meuId = usuarioLogadoId();

  const [config, setConfig] = useState<BancaFrancesaConfig | null>(null);
  const [meuNivel, setMeuNivel] = useState<MeuNivel | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  /*
   * A rodada, montada aqui do jeito que o pano sabe ler.
   *
   * `apostas` são as fichas já confirmadas e ainda não lançadas. Elas ficam NA TELA e
   * não custam nada até o lance: nesta mesa o servidor debita no mesmo pedido em que
   * sorteia, então tirar as fichas antes de lançar é de graça — a mesma promessa que a
   * mesa online faz, pelo mesmo motivo.
   */
  const [apostas, setApostas] = useState<BancaFrancesaBet[]>([]);
  const [rodadaId, setRodadaId] = useState('rodada-1');
  const [nulos, setNulos] = useState<LancamentoView[]>([]);
  const [ultima, setUltima] = useState<TableView['lastRound']>(undefined);

  /** Cancela a encenação em curso se a tela sair no meio dela. */
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  useEffect(() => {
    fetchBancaFrancesaConfig()
      .then(setConfig)
      .catch((e: unknown) => setErro(e instanceof ApiError ? e.message : 'Não foi possível falar com o servidor.'));
  }, []);

  /* O nível é relido a cada mudança de saldo: perder um degrau muda o mínimo e as fichas. */
  const saldo = jogador?.chipBalance ?? 0;
  useEffect(() => {
    fetchMeuNivel().then(setMeuNivel).catch(() => undefined);
  }, [saldo]);

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
          pendingBets: apostas,
          balance: saldo,
        },
      ],
      lastRound: ultima,
      /*
       * `esperandoDepoisDeNulo` é sempre falso: aqui não existe janela de aposta entre
       * lançamentos, porque a rodada inteira é resolvida numa chamada. Dizer que existe
       * abriria um relógio contando pra nada — um prazo que não é prazo de coisa
       * nenhuma.
       */
      rodada: { rodadaId, lancamentos: nulos, esperandoDepoisDeNulo: false },
    }),
    [meuId, jogador?.name, apostas, saldo, ultima, rodadaId, nulos],
  );

  /** Confirma a montagem. Não vai pro servidor: nesta mesa a ficha só sai no lance. */
  const handleApostar = async (bets: BancaFrancesaBet[]) => {
    const total = bets.reduce((t, b) => t + b.amount, 0);
    if (total > saldo) {
      setErro('Você não tem fichas suficientes pra essa aposta.');
      return false;
    }
    setErro(null);
    // Soma na montagem que já estava na mesa, casa por casa.
    setApostas((atual) => {
      const somado = new Map(atual.map((b) => [b.type, b.amount]));
      for (const b of bets) somado.set(b.type, (somado.get(b.type) ?? 0) + b.amount);
      return [...somado.entries()].map(([type, amount]) => ({ type, amount }));
    });
    return true;
  };

  const handleRetirar = async () => {
    if (ocupado) return;
    setApostas([]);
    setErro(null);
  };

  const espera = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));

  const handleGirar = async () => {
    if (ocupado || apostas.length === 0) return;
    setOcupado(true);
    setErro(null);
    setAviso(null);
    try {
      const r = await playBancaFrancesaRound(apostas);

      /*
       * A ORDEM DA ENCENAÇÃO É A ORDEM DO QUE ACONTECEU.
       *
       * Primeiro os lançamentos que não decidiram, um a um — o pano os desenha no ritmo
       * dele e a espera daqui é feita da mesma medida (`PAUSA_DO_NULO`), pra que o
       * decisivo não entre por cima de um dado ainda rolando. Depois a rodada vira, e é
       * a virada do `rodadaId` com um `lastRound` novo que faz o pano lançar o decisivo.
       *
       * Nada disto escolhe nada: quando esta função começa, o resultado já está no `r`.
       */
      const lancamentosNulos: number[][] = r.lancamentosNulos ?? [];
      if (lancamentosNulos.length > 0) {
        setNulos(lancamentosNulos.map((dice) => ({ dice, sum: dice.reduce((t, d) => t + d, 0), outcome: null })));
        await espera(lancamentosNulos.length * PAUSA_DO_NULO);
        if (!vivo.current) return;
      }

      setNulos([]);
      setRodadaId((n) => `rodada-${Number(n.split('-')[1]) + 1}`);
      setUltima({
        dice: r.dice,
        sum: r.sum,
        outcome: r.outcome,
        rerolls: r.rerolls,
        lancamentosNulos,
        bySeat: {
          [meuId ?? 'eu']: { results: r.results, totalStake: r.totalStake, totalReturn: r.totalReturn },
        },
        at: new Date().toISOString(),
      });
      setApostas([]);
      /*
       * O saldo chega do servidor junto com o resultado, e é ele que vale. A tela não
       * faz a conta sozinha: fazer a conta aqui é como o saldo passou a mentir uma vez,
       * mostrando 10.000 pra quem já tinha perdido tudo.
       */
      saldoChegouDeFora(r.newBalance);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível apostar agora.');
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
      minimo={meuNivel?.nivel.minimo ?? config?.minBet ?? 50}
      nomeDoNivel={meuNivel?.nivel.nome}
      fichasDaMesa={meuNivel?.nivel.fichas}
      config={config}
      onApostar={handleApostar}
      onGirar={handleGirar}
      onRetirar={handleRetirar}
      onSair={() => navigation.goBack()}
      /* O painel da mesa online (código, convites, bots) não existe numa mesa de um. */
      onAbrirPainel={() => navigation.navigate('BancaFrancesaMesa')}
      rotuloDoPainel="Jogar numa mesa com outras pessoas"
      erro={erro}
      aviso={aviso}
    />
  );
}
