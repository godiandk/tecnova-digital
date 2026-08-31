import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Orientacao from 'expo-screen-orientation';

/**
 * Libera as duas orientações enquanto uma mesa está aberta.
 *
 * A primeira versão TRAVAVA em paisagem, porque a arte de mesa da V2 era 16:9 deitada.
 * A V3 desfez isso: cada jogo tem composição própria pra computador (1920x1080),
 * tablet (1536x2048) e celular EM PÉ (1080x1920), e o guia manda a mesa reagir à
 * largura em vez de forçar o aparelho a girar.
 *
 * Forçar rotação é decisão agressiva: tira do jogador o controle do aparelho e quebra
 * quem joga com o celular apoiado. Aqui a mesa aceita as duas e se recompõe.
 */
export function useOrientacaoLivre() {
  useEffect(() => {
    if (Platform.OS === 'web') return;

    Orientacao.unlockAsync().catch(() => {});

    return () => {
      Orientacao.lockAsync(Orientacao.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);
}
