import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Orientacao from 'expo-screen-orientation';

/**
 * Deita a tela enquanto a mesa está aberta, e devolve em pé ao sair.
 *
 * As mesas de jogo são desenhadas em 16:9 deitado, que é como cassino de verdade
 * apresenta mesa. O resto do app — salão, loja, perfil — continua em pé. Por isso o
 * travamento é POR TELA, e não no app.json: lá a orientação ficou "default", que
 * apenas permite as duas.
 *
 * Na web não se trava orientação de janela, então nem se tenta: a mesa usa a largura
 * que tiver. E as chamadas são protegidas — sem o módulo disponível, a tela apenas
 * continua em pé, o que é ruim mas não é motivo pra derrubar o jogo.
 */
export function useDeitado() {
  useEffect(() => {
    if (Platform.OS === 'web') return;

    Orientacao.lockAsync(Orientacao.OrientationLock.LANDSCAPE).catch(() => {});

    return () => {
      Orientacao.lockAsync(Orientacao.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);
}
