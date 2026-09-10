/**
 * COMO SE LIGA O PAINEL DE QUADROS.
 *
 * Precisa ser fácil pra quem está medindo e impossível pra quem está jogando. Um botão
 * na tela seria fácil demais; um recompilar seria difícil demais e ninguém mediria nada.
 *
 * Na web: `?quadros=1` na barra de endereço. É o que permite mandar UM link pra alguém
 * abrir no celular dela e ler o número — que é exatamente o que o §6 do
 * `RENDERING_STRATEGY.md` pede pra fechar a decisão de renderer.
 *
 * No celular nativo: `globalThis.__MEDIR_QUADROS__ = true` no console do depurador.
 *
 * Em produção não liga de jeito nenhum: `__DEV__` é falso e a função devolve `false`
 * antes de olhar qualquer outra coisa.
 */
import { Platform } from 'react-native';

/** Só em desenvolvimento. Em produção isto some junto com o painel. */
export const PODE_MEDIR = typeof __DEV__ !== 'undefined' && __DEV__;

export function medirQuadrosNaAbertura(): boolean {
  if (!PODE_MEDIR) return false;

  if (Platform.OS === 'web') {
    try {
      const params = new URLSearchParams(globalThis.location?.search ?? '');
      if (params.get('quadros') === '1') return true;
    } catch {
      /* sem `location` (num teste, num worker) — segue pro próximo caminho */
    }
  }

  return (globalThis as { __MEDIR_QUADROS__?: boolean }).__MEDIR_QUADROS__ === true;
}
