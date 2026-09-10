/**
 * Liga o medidor num laço de quadro e devolve a medida de tempos em tempos.
 *
 * DUAS DECISÕES QUE PARECEM DETALHE E NÃO SÃO:
 *
 * 1. Ele mede em TODO quadro e só AVISA a cada meio segundo. Se avisasse a cada quadro,
 *    o React re-renderizaria sessenta vezes por segundo pra mostrar um número — e o
 *    medidor viraria a maior causa de travada da tela que ele deveria estar medindo.
 *
 * 2. Desligado, ele não agenda nada. Não é um laço rodando com um `if` dentro: é um laço
 *    que não existe. Medidor que custa quando está desligado acaba sendo arrancado do
 *    código, e aí ninguém mede mais nada.
 */
import { useEffect, useRef, useState } from 'react';

import { criarMedidorDeQuadros, type MedidaDeQuadros } from './medidorDeQuadros';

const AVISA_A_CADA_MS = 500;

export function useMedidorDeQuadros(ligado: boolean): MedidaDeQuadros | null {
  const [medida, setMedida] = useState<MedidaDeQuadros | null>(null);
  const medidor = useRef(criarMedidorDeQuadros());

  useEffect(() => {
    if (!ligado) {
      setMedida(null);
      medidor.current.zerar();
      return undefined;
    }

    let vivo = true;
    let pedido = 0;
    let ultimoAviso = 0;

    const passo = (agora: number) => {
      if (!vivo) return;
      medidor.current.quadro(agora);
      if (agora - ultimoAviso >= AVISA_A_CADA_MS) {
        ultimoAviso = agora;
        setMedida(medidor.current.resultado());
      }
      pedido = requestAnimationFrame(passo);
    };
    pedido = requestAnimationFrame(passo);

    return () => {
      vivo = false;
      cancelAnimationFrame(pedido);
      medidor.current.zerar();
    };
  }, [ligado]);

  return medida;
}
