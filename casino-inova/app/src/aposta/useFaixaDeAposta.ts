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

import { fetchEscadaDeNiveis, type NivelDeMesa } from '../api/niveis';
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

export function useFaixaDeAposta(saldo: number): FaixaDeAposta | null {
  const [escada, setEscada] = useState<NivelDeMesa[] | null>(escadaEmCache);

  useEffect(() => {
    if (escada) return undefined;
    let vivo = true;
    pegarEscada()
      .then((e) => { if (vivo) setEscada(e); })
      .catch(() => { /* sem escada, o seletor não aparece; a tela segue mostrando o erro dela */ });
    return () => { vivo = false; };
  }, [escada]);

  return escada ? faixaPara(escada, saldo) : null;
}
