import { useCallback, useEffect, useReducer } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { apiRequest } from '../api/client';
import { usuarioLogado, definirUsuario, aoMudarSessao } from '../api/session';

export interface Jogador {
  id: string;
  name: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  chipBalance: number;
  vipTier: 'bronze' | 'prata' | 'ouro' | 'diamante';
}

interface UsuarioDto {
  id: string;
  name: string;
  level: number;
  xp: number;
  /** Quanto o nível atual exige. Vem do servidor — a curva é dele. */
  xpToNextLevel?: number;
  vipTier: Jogador['vipTier'];
}

/**
 * Quanto XP o nível exige, PRA ENQUANTO A RESPOSTA NÃO CHEGA.
 *
 * A curva de verdade é do servidor e vem em `xpToNextLevel` — nível é decisão dele, e
 * enquanto essa conta morava aqui duas versões do aplicativo desenhavam barras
 * diferentes pro mesmo XP, sem nenhuma das duas ser a verdade. Isto aqui sobrou só pro
 * chute do primeiro instante, antes de o `/users/me` responder, pra a barra não nascer
 * com denominador zero e aparecer cheia.
 */
function xpDoNivelProvisorio(nivel: number): number {
  return 500 + (nivel - 1) * 250;
}

/*
 * O SALDO É UM SÓ PRO APP INTEIRO, e mora aqui fora do React.
 *
 * ISTO ERA UM BUG DE VERDADE, e dos piores possíveis num jogo de fichas: cada tela
 * chamava `usePlayer()` e ganhava a SUA cópia do saldo, carregada uma vez quando a tela
 * montou. O salão fica montado embaixo enquanto você joga (é uma pilha de telas, não
 * uma troca), então o `useEffect` de carregar não rodava de novo na volta — a pessoa
 * perdia fichas na mesa, voltava pro salão e continuava lendo 10.000 no topo. O número
 * não estava "atrasado": era de outra cópia, que ninguém mais ia atualizar.
 *
 * Saldo que mente é o pior defeito que este app pode ter. Ele é a única coisa que
 * alguém confere de olho, e é a base de decidir quanto apostar.
 *
 * Duas correções, e as duas são necessárias:
 *
 * 1. Um estado só, aqui no módulo, com quem estiver na tela inscrito nele. Quando
 *    qualquer tela recarrega depois de uma aposta, TODAS veem o número novo — inclusive
 *    o salão montado embaixo.
 * 2. Recarregar quando a tela ganha foco. É o cinto de segurança da primeira: mesmo que
 *    uma tela de jogo esqueça de chamar `recarregar`, voltar pro salão busca o saldo.
 */
let jogadorAtual: Jogador | null = null;
let carregandoAgora = true;
const inscritos = new Set<() => void>();
/** Busca em voo, pra dez telas subindo juntas não virarem dez chamadas iguais. */
let buscaEmVoo: Promise<void> | null = null;

function avisarInscritos() {
  for (const avisar of inscritos) avisar();
}

async function buscarJogador(): Promise<void> {
  if (buscaEmVoo) return buscaEmVoo;

  buscaEmVoo = (async () => {
    try {
      const [usuario, carteira] = await Promise.all([
        apiRequest<UsuarioDto>('/users/me'),
        apiRequest<{ balance: number }>('/wallet/saldo'),
      ]);
      definirUsuario({ id: usuario.id, name: usuario.name });
      jogadorAtual = {
        id: usuario.id,
        name: usuario.name,
        level: usuario.level,
        xp: usuario.xp,
        xpToNextLevel: usuario.xpToNextLevel ?? xpDoNivelProvisorio(usuario.level),
        chipBalance: carteira.balance,
        vipTier: usuario.vipTier,
      };
    } catch {
      // Sem servidor, a tela mostra o que já tinha em vez de quebrar.
    } finally {
      carregandoAgora = false;
      buscaEmVoo = null;
      avisarInscritos();
    }
  })();

  return buscaEmVoo;
}

/**
 * Grava um saldo que já chegou de outro jeito, sem pedir de novo ao servidor.
 *
 * A mesa online é o caso que obriga isto a existir. Lá o saldo chega junto do estado da
 * mesa, a cada rodada, pelo socket — e mesmo assim o número no topo ficava parado em
 * 10.000 rodada após rodada, porque a tela lia o `usePlayer`, e o `usePlayer` só busca
 * quando a tela monta ou ganha foco. A tela nunca perdeu o foco: a pessoa ficou ali
 * jogando, perdendo ficha, olhando um número que não mexia.
 *
 * O dado certo já estava chegando. O que faltava era um caminho pra ele entrar.
 */
export function saldoChegouDeFora(saldo: number) {
  if (!jogadorAtual || jogadorAtual.chipBalance === saldo) return;
  jogadorAtual = { ...jogadorAtual, chipBalance: saldo };
  avisarInscritos();
}

/*
 * Trocou de conta: o saldo guardado é de outra pessoa. Sem isto, quem entrasse depois
 * veria por um instante as fichas de quem saiu — e num jogo de fichas esse instante é
 * exatamente o que não pode acontecer.
 */
aoMudarSessao((logado) => {
  jogadorAtual = null;
  carregandoAgora = logado;
  avisarInscritos();
  if (logado) void buscarJogador();
});

/**
 * O jogador logado, com o saldo vindo da carteira de verdade.
 *
 * `recarregar` existe porque toda tela de jogo mexe no saldo — depois de apostar, a
 * tela chama pra o número no topo não ficar velho. Agora esse chamado atualiza todas as
 * telas de uma vez, e não só a que chamou.
 */
export function usePlayer() {
  const [, redesenhar] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    inscritos.add(redesenhar);
    return () => {
      inscritos.delete(redesenhar);
    };
  }, []);

  useEffect(() => {
    if (jogadorAtual === null) void buscarJogador();
  }, []);

  /*
   * Voltar pra uma tela busca o saldo de novo. É o que conserta o caso que originou
   * tudo isto: sair do salão, perder fichas na mesa e voltar.
   */
  useFocusEffect(
    useCallback(() => {
      void buscarJogador();
    }, []),
  );

  const recarregar = useCallback(async () => {
    await buscarJogador();
  }, []);

  // Enquanto não carregou, devolve o nome que já veio do login — evita a tela piscar.
  const provisorio = usuarioLogado();
  return {
    jogador:
      jogadorAtual ??
      (provisorio
        ? { id: provisorio.id, name: provisorio.name, level: 1, xp: 0, xpToNextLevel: xpDoNivelProvisorio(1), chipBalance: 0, vipTier: 'bronze' as const }
        : null),
    carregando: carregandoAgora,
    recarregar,
  };
}
