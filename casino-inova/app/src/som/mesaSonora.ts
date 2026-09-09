import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';

/**
 * O SOM DA MESA.
 *
 * Três regras, e elas explicam quase todas as decisões deste arquivo:
 *
 * 1. O SOM CONTA O QUE JÁ ACONTECEU. Cada estalo sai de uma batida que a física
 *    registrou, no quadro em que ela aconteceu (ver `Batida` no motor de dados) — nunca
 *    de um relógio. Som sorteado por cima da animação é o mesmo tipo de mentira que uma
 *    animação sorteada por cima do resultado: parece certo e não é.
 *
 * 2. DÁ PRA DESLIGAR, E O DESLIGADO FICA. O mudo é guardado no aparelho e vale na
 *    próxima vez. Um cassino que volta a fazer barulho toda vez que abre é um cassino
 *    que não aceitou a resposta.
 *
 * 3. QUEM PEDIU MENOS MOVIMENTO PEDIU MENOS BARULHO. O sistema tem uma preferência de
 *    movimento reduzido (no navegador, `prefers-reduced-motion`), e quem a liga não quer
 *    uma mesa estalando doze vezes por lançamento. Aí só o essencial toca: a ficha
 *    encostando e a casa pagando, que são confirmações do que a pessoa fez.
 *
 * O volume de cada batida vem da FORÇA dela. Um dado que roça o outro e um que cai de
 * cima não podem soar igual; é o que separa uma mesa de um metrônomo.
 */

const CHAVE_DO_MUDO = 'casino-inova:som-mudo';

/** Quantas vozes do mesmo som podem tocar ao mesmo tempo. */
const VOZES_POR_SOM = 4;

/**
 * A força (em meios-dados por segundo, a unidade do motor) que já corresponde ao volume
 * cheio. Medido nos lançamentos: a queda do copo bate por volta de 30 a 45; um roçar
 * entre dados fica abaixo de 5.
 */
const FORCA_CHEIA = 34;

/** Batidas mais fracas que isto não tocam: são o dado se ajeitando, não uma batida. */
const FORCA_MINIMA = 2.5;

export type NomeDoSom =
  | 'batida-no-couro'
  | 'batida-no-dado'
  | 'copo'
  | 'ficha-no-pano'
  | 'ficha-na-pilha'
  | 'pagou';

const ARQUIVOS: Record<NomeDoSom, number> = {
  'batida-no-couro': require('../../assets/sons/batida-no-couro.wav'),
  'batida-no-dado': require('../../assets/sons/batida-no-dado.wav'),
  copo: require('../../assets/sons/copo.wav'),
  'ficha-no-pano': require('../../assets/sons/ficha-no-pano.wav'),
  'ficha-na-pilha': require('../../assets/sons/ficha-na-pilha.wav'),
  pagou: require('../../assets/sons/pagou.wav'),
};

/** Os que continuam tocando com movimento reduzido: confirmam um gesto da pessoa. */
const ESSENCIAIS = new Set<NomeDoSom>(['ficha-no-pano', 'ficha-na-pilha', 'pagou']);

type Voz = { som: Audio.Sound; ocupadaAte: number };

const vozes = new Map<NomeDoSom, Voz[]>();
let carregando: Promise<void> | null = null;
let mudo = false;
let movimentoReduzido = false;
const ouvintesDoMudo = new Set<(m: boolean) => void>();

/**
 * CARREGA UMA VEZ, E VÁRIAS CÓPIAS DE CADA SOM.
 *
 * Um `Audio.Sound` toca uma coisa de cada vez: pedir pra ele tocar de novo enquanto
 * ainda está tocando CORTA o som anterior. Com três dados batendo quase junto, isso
 * viraria um estalo só. Quatro cópias por som resolvem sem custo perceptível — os
 * arquivos somam menos de 140 KB.
 */
async function carregar(): Promise<void> {
  if (carregando) return carregando;
  carregando = (async () => {
    /*
     * `playsInSilentModeIOS: false` de propósito: quem põe o iPhone no silencioso está
     * pedindo silêncio, e um jogo que estala mesmo assim é o jogo passando por cima de
     * uma escolha que a pessoa já fez com o aparelho na mão.
     */
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: false, staysActiveInBackground: false });
    await Promise.all(
      (Object.keys(ARQUIVOS) as NomeDoSom[]).map(async (nome) => {
        const copias: Voz[] = [];
        for (let i = 0; i < VOZES_POR_SOM; i += 1) {
          const { sound } = await Audio.Sound.createAsync(ARQUIVOS[nome], { volume: 0 });
          copias.push({ som: sound, ocupadaAte: 0 });
        }
        vozes.set(nome, copias);
      }),
    );
  })();
  return carregando;
}

/**
 * Prepara a mesa: lê o mudo guardado, pergunta ao sistema sobre movimento reduzido e
 * carrega os arquivos. Chamar mais de uma vez não custa nada.
 */
export async function prepararOSom(): Promise<void> {
  try {
    const guardado = await AsyncStorage.getItem(CHAVE_DO_MUDO);
    mudo = guardado === 'sim';
  } catch {
    /* Sem armazenamento (janela anônima, por exemplo), começa com som. */
  }
  try {
    movimentoReduzido = await AccessibilityInfo.isReduceMotionEnabled();
  } catch {
    movimentoReduzido = false;
  }
  AccessibilityInfo.addEventListener('reduceMotionChanged', (ligado) => {
    movimentoReduzido = ligado;
  });
  await carregar().catch(() => {
    /* Sem áudio disponível o jogo continua: som é enfeite, mesa não é. */
  });
}

/**
 * Toca um som, com o volume que a força da batida pede.
 *
 * `forca` é opcional: sem ela, toca no volume cheio do som (é o caso da ficha e do
 * pagamento, que não têm física por trás).
 */
export function tocar(nome: NomeDoSom, forca?: number): void {
  if (mudo) return;
  if (movimentoReduzido && !ESSENCIAIS.has(nome)) return;
  if (forca !== undefined && forca < FORCA_MINIMA) return;

  const copias = vozes.get(nome);
  if (!copias) return;

  const agora = Date.now();
  const livre = copias.find((v) => v.ocupadaAte <= agora) ?? copias[0];
  livre.ocupadaAte = agora + 220;

  const volume = forca === undefined ? 0.9 : Math.min(1, 0.25 + (0.75 * forca) / FORCA_CHEIA);
  /*
   * Reposicionar antes de tocar é obrigatório: um som que chegou ao fim fica parado no
   * fim, e mandar tocar de novo não rebobina sozinho — o segundo toque sairia mudo.
   */
  void livre.som
    .setStatusAsync({ positionMillis: 0, volume, shouldPlay: true })
    .catch(() => {
      /* Navegador que ainda não liberou áudio, ou som descarregado: silêncio, e pronto. */
    });
}

/**
 * Toca a sequência de batidas de um lançamento, cada uma no seu tempo.
 *
 * Os tempos saem dos QUADROS que a física registrou, convertidos pela mesma taxa que a
 * animação usa. Devolve uma função que cancela o que ainda não tocou — a tela chama
 * isso ao sair da mesa, senão os estalos de uma rodada abandonada tocam por cima da
 * seguinte.
 */
export function tocarAsBatidas(
  batidas: Array<{ quadro: number; forca: number; tipo: 'chao' | 'dado' }>,
  quadrosPorSegundo: number,
): () => void {
  if (mudo || movimentoReduzido) return () => {};
  const marcados = batidas.map((b) =>
    setTimeout(
      () => tocar(b.tipo === 'chao' ? 'batida-no-couro' : 'batida-no-dado', b.forca),
      (b.quadro / quadrosPorSegundo) * 1000,
    ),
  );
  return () => marcados.forEach(clearTimeout);
}

/** O estado do mudo pra tela desenhar o botão, e o jeito de virar. */
export function useMudo(): { mudo: boolean; alternar: () => void } {
  const [ligado, setLigado] = useState(mudo);

  useEffect(() => {
    ouvintesDoMudo.add(setLigado);
    setLigado(mudo);
    return () => {
      ouvintesDoMudo.delete(setLigado);
    };
  }, []);

  const alternar = useCallback(() => {
    mudo = !mudo;
    ouvintesDoMudo.forEach((avisar) => avisar(mudo));
    AsyncStorage.setItem(CHAVE_DO_MUDO, mudo ? 'sim' : 'nao').catch(() => {});
    /*
     * Sair do mudo TOCA UM SOM. Sem isso, quem desligou o mudo não tem como saber se
     * funcionou até a próxima ficha — e num aparelho com o volume no zero a pessoa
     * mexeria no botão para sempre.
     */
    if (!mudo) tocar('ficha-no-pano');
  }, []);

  return { mudo: ligado, alternar };
}

/** Pra conferência: o volume que uma força produz. Exportado pra poder ser medido. */
export function volumeDaForca(forca: number): number {
  return Math.min(1, 0.25 + (0.75 * forca) / FORCA_CHEIA);
}

/** No servidor de testes não existe `window`; a conferência usa isto pra pular. */
export const TEM_AUDIO = Platform.OS !== 'web' || typeof window !== 'undefined';
