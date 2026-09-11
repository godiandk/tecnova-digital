/**
 * A faixa de aposta desta pessoa, sempre em dia com o saldo dela.
 *
 * A ESCADA VEM DO SERVIDOR UMA VEZ; o degrau é derivado do saldo a cada mudança. É a
 * combinação que resolve o problema prático: o saldo muda a cada rodada e o degrau muda
 * junto quando ela cruza uma entrada, mas consultar o servidor depois de todo giro seria
 * uma requisição a mais por rodada — e chegaria atrasada, porque o saldo novo já veio na
 * resposta do giro.
 *
 * A conta do degrau é a mesma do servidor, e há conferência comparando as duas em toda a
 * faixa de saldo (`verify:escada-de-aposta`). O servidor continua sendo quem valida a
 * aposta; isto é apresentação.
 */
import { useEffect, useState } from 'react';

import { fetchEscadaDeNiveis, fetchMeuNivel, type NivelDeMesa } from '../api/niveis';
import { faixaPara } from './degrau';
import type { FaixaDeAposta } from './escada';

/** A escada é a mesma pra todo mundo e não muda durante a sessão: busca uma vez só. */
let escadaEmCache: NivelDeMesa[] | null = null;
let buscando: Promise<NivelDeMesa[]> | null = null;

function pegarEscada(): Promise<NivelDeMesa[]> {
  if (escadaEmCache) return Promise.resolve(escadaEmCache);
  if (!buscando) {
    buscando = fetchEscadaDeNiveis()
      .then((escada) => { escadaEmCache = escada; return escada; })
      .catch((erro) => { buscando = null; throw erro; });
  }
  return buscando;
}

/**
 * O NÍVEL DO JOGADOR, buscado uma vez por sessão.
 *
 * Ele entra na conta porque o degrau é `min(o que o saldo banca, o que o nível liberou)`.
 * O saldo continua vindo de graça na resposta de cada rodada; o nível não, e pedi-lo a
 * cada giro seria uma requisição a mais por rodada — o mesmo custo que o cache da escada
 * existe pra evitar.
 *
 * O QUE ISSO CUSTA, dito na cara: quem SOBE DE NÍVEL no meio da sessão e com isso abre um
 * degrau novo só vê o degrau novo na próxima vez que entrar na mesa. É pouco — os degraus
 * abrem em 20, 50, 100, 200... e subir um desses no meio de uma sessão é raro — e o
 * caminho contrário, que seria pior, não acontece: o aplicativo nunca OFERECE uma mesa que
 * o servidor vai recusar, porque um nível velho é sempre menor ou igual ao de agora.
 *
 * `esquecerNivelEmCache` existe pra quem quiser forçar a releitura (a tela de perfil
 * depois de uma animação de subida de nível, por exemplo).
 */
let nivelEmCache: number | null = null;
let buscandoNivel: Promise<number> | null = null;

function pegarNivelDoJogador(): Promise<number> {
  if (nivelEmCache !== null) return Promise.resolve(nivelEmCache);
  if (!buscandoNivel) {
    buscandoNivel = fetchMeuNivel()
      .then((meu) => { nivelEmCache = meu.level; return meu.level; })
      .catch((erro) => { buscandoNivel = null; throw erro; });
  }
  return buscandoNivel;
}

export function esquecerNivelEmCache(): void {
  nivelEmCache = null;
  buscandoNivel = null;
}

/**
 * @param maiorMultiplicador o maior retorno que a mesa sabe pagar, em múltiplos da aposta.
 *   Vem no `/config` do jogo. Sem ele, o trilho é o do degrau puro — o que serve pra jogo
 *   que paga pouco e é errado pra caça-níqueis no topo da escada.
 */
export function useFaixaDeAposta(saldo: number, maiorMultiplicador?: number): FaixaDeAposta | null {
  const [escada, setEscada] = useState<NivelDeMesa[] | null>(escadaEmCache);
  const [level, setLevel] = useState<number | null>(nivelEmCache);

  useEffect(() => {
    let vivo = true;
    if (!escada) {
      pegarEscada()
        .then((e) => { if (vivo) setEscada(e); })
        .catch(() => { /* sem escada, o seletor não aparece; a tela segue mostrando o erro dela */ });
    }
    if (level === null) {
      pegarNivelDoJogador()
        .then((n) => { if (vivo) setLevel(n); })
        .catch(() => { /* idem: sem nível não dá pra saber o degrau, e chutar seria pior */ });
    }
    return () => { vivo = false; };
  }, [escada, level]);

  /*
   * OS DOIS PRECISAM TER CHEGADO. Faltando qualquer um, o seletor não aparece — que é o
   * comportamento que já existia pra escada, e pelo mesmo motivo: oferecer fichas de uma
   * mesa adivinhada é oferecer uma aposta que o servidor vai recusar.
   */
  return escada && level !== null ? faixaPara(escada, saldo, level, maiorMultiplicador) : null;
}
