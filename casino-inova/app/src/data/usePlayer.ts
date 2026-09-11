import { useCallback, useEffect, useReducer } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { apiRequest } from '../api/client';
import { usuarioLogado, definirUsuario, aoMudarSessao } from '../api/session';

export interface Jogador {
  id: string;
  /** Oito dígitos, o número que a pessoa vê e diz pro suporte. */
  publicCode: string;
  /** Qual retrato ela escolheu, ou null enquanto não escolheu nenhum. */
  avatar: string | null;
  /** É o que faz a entrada do painel aparecer — ou não — no perfil. */
  role: 'jogador' | 'moderador' | 'admin';
  name: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  chipBalance: number;
  vipTier: 'bronze' | 'prata' | 'ouro' | 'diamante';
}

interface UsuarioDto {
  id: string;
  publicCode?: string;
  avatar?: string | null;
  role?: Jogador['role'];
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
 *
 * Ele acompanha a curva do servidor (`197 × raiz(N)`, em `progressao/niveis.ts`) porque um
 * chute com a curva ANTIGA — que era `500 + (N−1) × 250` — fazia a barra nascer num lugar e
 * pular pra outro quando a resposta chegava. No nível 100 a diferença era de 25.250 pra
 * 1.970: a barra aparecia praticamente vazia e saltava pra quase cheia.
 */
export function xpDoNivelProvisorio(nivel: number): number {
  return Math.round(197 * Math.sqrt(Math.max(1, nivel)));
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

/**
 * QUANTAS VEZES O SALDO JÁ FOI ESCRITO POR UMA FONTE MAIS NOVA QUE UMA BUSCA EM VOO.
 *
 * Isto conserta uma CORRIDA que fazia o saldo ANDAR PARA TRÁS depois de uma vitória — o
 * defeito mais grave que um jogo de fichas pode ter, porque a pessoa vê o prêmio e vê o
 * número não mexer.
 *
 * A sequência, e ela acontece o tempo todo:
 *
 *   1. a tela ganha foco e dispara `buscarJogador()`, que lê o saldo de ANTES da aposta;
 *   2. a pessoa aposta; o servidor debita, credita e responde com o saldo NOVO, que entra
 *      aqui por `saldoChegouDeFora`;
 *   3. a busca do passo 1 — que saiu primeiro e chegou depois — grava o saldo VELHO por
 *      cima do novo.
 *
 * O contador resolve sem inventar relógio: a busca anota o valor dele quando SAI e, na
 * volta, só escreve o saldo se ninguém tiver escrito nesse meio-tempo. Chegou tarde,
 * perdeu — que é a única regra certa quando a resposta mais nova é a mais verdadeira.
 *
 * O resto do perfil (nome, nível, XP, retrato) continua sendo gravado sempre: só o SALDO
 * tem fonte concorrente.
 */
let escritasDeSaldo = 0;

function avisarInscritos() {
  for (const avisar of inscritos) avisar();
}

async function buscarJogador(): Promise<void> {
  if (buscaEmVoo) return buscaEmVoo;

  /* Anotado ANTES de sair: é com este número que a volta decide se ainda vale escrever. */
  const escritasQuandoSaiu = escritasDeSaldo;

  buscaEmVoo = (async () => {
    try {
      const [usuario, carteira] = await Promise.all([
        apiRequest<UsuarioDto>('/users/me'),
        apiRequest<{ balance: number }>('/wallet/saldo'),
      ]);
      definirUsuario({ id: usuario.id, name: usuario.name });
      /*
       * Alguém escreveu um saldo mais novo enquanto esta busca voltava (uma aposta que
       * liquidou). O perfil desta resposta continua valendo; o SALDO dela já nasceu velho.
       */
      const saldoAindaVale = escritasDeSaldo === escritasQuandoSaiu;
      jogadorAtual = {
        id: usuario.id,
        publicCode: usuario.publicCode ?? '',
        avatar: usuario.avatar ?? null,
        role: usuario.role ?? 'jogador',
        name: usuario.name,
        level: usuario.level,
        xp: usuario.xp,
        xpToNextLevel: usuario.xpToNextLevel ?? xpDoNivelProvisorio(usuario.level),
        chipBalance: saldoAindaVale ? carteira.balance : (jogadorAtual?.chipBalance ?? carteira.balance),
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
/** O perfil mudou (apelido, retrato): grava sem esperar uma nova ida ao servidor. */
export function perfilMudou(dados: Partial<Jogador>) {
  if (!jogadorAtual) return;
  jogadorAtual = { ...jogadorAtual, ...dados };
  avisarInscritos();
}

export function saldoChegouDeFora(saldo: number) {
  if (!Number.isFinite(saldo)) return;
  /*
   * O CONTADOR SOBE MESMO QUANDO O NÚMERO NÃO MUDA, e isso é de propósito: uma aposta que
   * empatou devolve o mesmo saldo, e ainda assim é uma resposta MAIS NOVA que qualquer
   * busca em voo. Subir só quando o valor muda deixaria a busca velha ganhar justamente no
   * caso em que ela tem mais chance de estar errada.
   */
  escritasDeSaldo += 1;
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
        ? {
            id: provisorio.id,
            publicCode: '',
            avatar: null,
            role: 'jogador' as const,
            name: provisorio.name,
            level: 1,
            xp: 0,
            xpToNextLevel: xpDoNivelProvisorio(1),
            chipBalance: 0,
            vipTier: 'bronze' as const,
          }
        : null),
    carregando: carregandoAgora,
    recarregar,
  };
}
