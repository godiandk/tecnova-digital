import { useEffect, useState } from 'react';
import { Easing } from 'react-native-reanimated';

/**
 * Faz um número subir (ou descer) até o valor novo em vez de trocar de uma vez.
 *
 * Por que importa num jogo de fichas: quando o saldo pula de 12.400 pra 12.900 num
 * quadro só, a pessoa não vê que ganhou — ela vê um número diferente. Contando, o
 * ganho vira um acontecimento, e dá pra perceber o tamanho dele pela velocidade.
 *
 * Não usa Reanimated de propósito: o valor precisa existir em JavaScript pra ser
 * formatado com separador de milhar a cada quadro, e Reanimated roda na thread de UI,
 * onde `toLocaleString` não existe.
 */
export function useContagem(alvo: number, duracao = 900): number {
  const [valor, setValor] = useState(alvo);

  useEffect(() => {
    const inicio = valor;
    const distancia = alvo - inicio;
    if (distancia === 0) return;

    // Salto muito grande (primeiro carregamento, troca de conta): não conta, só assume.
    if (Math.abs(distancia) > 5_000_000) {
      setValor(alvo);
      return;
    }

    const comeco = Date.now();
    const curva = Easing.out(Easing.cubic);
    let vivo = true;

    const passo = () => {
      if (!vivo) return;
      const t = Math.min(1, (Date.now() - comeco) / duracao);
      setValor(Math.round(inicio + distancia * curva(t)));
      if (t < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);

    return () => {
      vivo = false;
    };
    // `valor` de propósito fora: incluir ele reiniciaria a contagem a cada quadro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alvo, duracao]);

  return valor;
}
