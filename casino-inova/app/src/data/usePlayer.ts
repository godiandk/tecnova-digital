import { useCallback, useEffect, useState } from 'react';

import { apiRequest } from '../api/client';
import { usuarioLogado, definirUsuario } from '../api/session';

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
  vipTier: Jogador['vipTier'];
}

/**
 * Quanto XP falta pro próximo nível.
 *
 * A curva é do app por enquanto: o servidor guarda o XP acumulado, mas a tabela de
 * quanto vale cada nível ainda é decisão de economia, não de código (está na lista do
 * que falta, como "planilha de economia"). Fica isolado aqui pra virar um campo vindo
 * do servidor sem mexer em tela nenhuma.
 */
function xpDoNivel(nivel: number): number {
  return 500 + (nivel - 1) * 250;
}

/**
 * O jogador logado, com o saldo vindo da carteira de verdade.
 *
 * Substitui o `mockPlayer`, que era um objeto fixo no código. `recarregar` existe
 * porque toda tela de jogo mexe no saldo — depois de apostar, a tela chama pra o
 * número no topo não ficar velho.
 */
export function usePlayer() {
  const [jogador, setJogador] = useState<Jogador | null>(null);
  const [carregando, setCarregando] = useState(true);

  const recarregar = useCallback(async () => {
    try {
      const [usuario, carteira] = await Promise.all([
        apiRequest<UsuarioDto>('/users/me'),
        apiRequest<{ balance: number }>('/wallet/saldo'),
      ]);
      definirUsuario({ id: usuario.id, name: usuario.name });
      setJogador({
        id: usuario.id,
        name: usuario.name,
        level: usuario.level,
        xp: usuario.xp,
        xpToNextLevel: xpDoNivel(usuario.level),
        chipBalance: carteira.balance,
        vipTier: usuario.vipTier,
      });
    } catch {
      // Sem servidor, a tela mostra o que já tinha em vez de quebrar.
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  // Enquanto não carregou, devolve o nome que já veio do login — evita a tela piscar.
  const provisorio = usuarioLogado();
  return {
    jogador:
      jogador ??
      (provisorio
        ? { id: provisorio.id, name: provisorio.name, level: 1, xp: 0, xpToNextLevel: xpDoNivel(1), chipBalance: 0, vipTier: 'bronze' as const }
        : null),
    carregando,
    recarregar,
  };
}
