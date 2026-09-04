import { AppState, Platform } from 'react-native';
import { apiRequest } from './client';

/**
 * Percebe quando o servidor passou a entregar uma versão nova do app, e recarrega.
 *
 * O PROBLEMA QUE ISTO RESOLVE: publicar uma correção não bastava pra ver a correção. O
 * navegador guardava o index.html antigo, o index antigo apontava pro pacote antigo, e a
 * pessoa recarregava várias vezes vendo a mesma versão. O cabeçalho `no-store` no
 * servidor já conserta isso pra quem recarrega; isto aqui é pra quem NÃO recarrega —
 * quem deixou a aba aberta e voltou nela.
 *
 * QUANDO RECARREGA, e por que não é sempre:
 *
 * Recarregar joga fora tudo que está na tela. No meio de uma rodada isso seria péssimo:
 * a pessoa perderia a animação do resultado que está acontecendo. A aposta em si está
 * guardada no servidor e nada de dinheiro se perde — mas ver a mesa sumir enquanto os
 * dados rolam é o tipo de coisa que parece defeito grave.
 *
 * Então a regra é: só recarrega quando NINGUÉM avisou que está no meio de alguma coisa.
 * Uma tela de jogo chama `estouOcupado(true)` enquanto uma rodada corre, e a atualização
 * espera. Se a pessoa ficar jogando sem parar, a atualização acontece na próxima vez que
 * ela voltar pro salão.
 */
const naWeb = Platform.OS === 'web';

let versaoConhecida: string | null = null;
let ocupado = 0;
let parar: (() => void) | null = null;

/** Uma tela de jogo avisa que tem rodada correndo. Conta em pilha: telas empilham. */
export function estouOcupado(sim: boolean) {
  ocupado = Math.max(0, ocupado + (sim ? 1 : -1));
}

async function conferir(): Promise<void> {
  if (!naWeb) return;
  try {
    const { versao } = await apiRequest<{ versao: string }>('/versao');
    if (!versaoConhecida) {
      versaoConhecida = versao;
      return;
    }
    if (versao === versaoConhecida || ocupado > 0) return;

    // `reload(true)` não existe mais nos navegadores modernos; o `no-store` do index é
    // quem garante que a recarga busca a versão nova de verdade.
    (globalThis as { location?: { reload(): void } }).location?.reload();
  } catch {
    // Servidor fora do ar ou sem rede: tenta na próxima. Não é motivo pra avisar nada.
  }
}

/**
 * Liga a vigilância. Confere ao voltar pra aba e de tempos em tempos.
 *
 * Os dois, e não um só: voltar pra aba pega o caso comum (a pessoa trocou de aplicativo
 * e voltou), e o intervalo pega a aba que fica aberta no mesmo lugar por horas. Trinta
 * segundos é barato — a resposta tem 30 bytes e não toca no banco.
 */
export function vigiarVersao(): () => void {
  if (!naWeb || parar) return () => undefined;

  void conferir();
  const relogio = setInterval(() => void conferir(), 30_000);
  const inscricao = AppState.addEventListener('change', (estado) => {
    if (estado === 'active') void conferir();
  });

  parar = () => {
    clearInterval(relogio);
    inscricao.remove();
    parar = null;
  };
  return parar;
}
