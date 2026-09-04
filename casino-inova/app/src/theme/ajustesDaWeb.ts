import { Platform } from 'react-native';

/**
 * Conserta o comportamento da página no navegador do celular.
 *
 * O SINTOMA: "a tela anda pra um lado pro outro, pra cima pra baixo, estranhasso".
 * Três causas somadas, todas do navegador e nenhuma do aplicativo:
 *
 * 1. ARRASTO ELÁSTICO. O Safari deixa arrastar a página inteira além do fim e ela volta
 *    balançando. Num site isso é natural; num jogo em tela cheia parece defeito, porque
 *    a mesa inteira desliza embaixo do dedo enquanto se tenta encostar uma ficha.
 *    `overscroll-behavior: none` desliga.
 *
 * 2. A BARRA DE ENDEREÇO QUE APARECE E SOME. No iPhone ela se recolhe ao rolar e volta
 *    ao tocar, e a altura da janela muda junto. Com altura em `100%` o conteúdo pula a
 *    cada troca. `100dvh` é a altura de VERDADE naquele instante, já descontada a barra,
 *    e acompanha em vez de pular. (`100vh` tem o mesmo defeito do `100%` — ele mede a
 *    tela com a barra escondida, mesmo quando ela está aparecendo.)
 *
 * 3. ROLAGEM DA PÁGINA POR CIMA DA ROLAGEM DA TELA. O aplicativo tem as listas dele, que
 *    rolam sozinhas; quando o documento TAMBÉM rola, os dois disputam o mesmo dedo, e o
 *    resultado é a tela andando junto com a lista. Prender o corpo da página resolve.
 *
 * O QUE NÃO É FEITO AQUI, de propósito: desligar o zoom com `user-scalable=no`. Ele
 * também acabaria com parte do deslize — e junto tiraria a única forma de quem enxerga
 * pouco conseguir ler a tela. Deslize incômodo se conserta de outro jeito; zoom
 * desligado não tem outro jeito.
 */
const CSS = `
  html {
    height: 100%;
    overscroll-behavior: none;
    /* Evita o Safari aumentar a fonte sozinho quando o telefone deita. */
    -webkit-text-size-adjust: 100%;
  }
  body {
    margin: 0;
    height: 100%;
    overflow: hidden;
    overscroll-behavior: none;
    /* Prende o corpo: quem rola são as listas de dentro, uma de cada vez. */
    position: fixed;
    inset: 0;
    width: 100%;
  }
  #root {
    width: 100%;
    /* Reserva pros navegadores sem dvh; a linha seguinte manda onde ele existe. */
    height: 100%;
    height: 100dvh;
  }
`;

/**
 * Instruções pro iPhone quando o jogo é adicionado à tela de início.
 *
 * `apple-mobile-web-app-capable` é a que importa: SEM ELA, o atalho na tela de início
 * abre dentro do Safari, com a barra de endereço em cima dos ícones da barra de baixo —
 * que é exatamente o defeito que aparece. Com ela, o atalho abre em tela cheia, sem
 * barra nenhuma, e o jogo ocupa o aparelho inteiro como um aplicativo instalado.
 *
 * `viewport-fit=cover` é o que faz o iPhone informar as margens seguras (o entalhe em
 * cima, a barrinha de gesto embaixo). Sem ela essas margens chegam como zero, e a barra
 * de abas nasce colada na borda de baixo, por cima da barrinha do sistema.
 */
const ETIQUETAS: Array<[string, string]> = [
  ['apple-mobile-web-app-capable', 'yes'],
  ['mobile-web-app-capable', 'yes'],
  ['apple-mobile-web-app-status-bar-style', 'black-translucent'],
  ['apple-mobile-web-app-title', 'Casino Inova'],
  ['theme-color', '#0B0F0D'],
];

let jaAplicado = false;

/** Chamado uma vez na subida do app. Fora da web não faz nada. */
export function aplicarAjustesDaWeb(): void {
  if (Platform.OS !== 'web' || jaAplicado) return;
  const documento = (globalThis as { document?: Document }).document;
  if (!documento?.head) return;

  const folha = documento.createElement('style');
  folha.setAttribute('id', 'casino-inova-ajustes');
  folha.textContent = CSS;
  documento.head.appendChild(folha);

  for (const [nome, conteudo] of ETIQUETAS) {
    if (documento.querySelector(`meta[name="${nome}"]`)) continue;
    const etiqueta = documento.createElement('meta');
    etiqueta.setAttribute('name', nome);
    etiqueta.setAttribute('content', conteudo);
    documento.head.appendChild(etiqueta);
  }

  /*
   * `viewport-fit=cover` precisa entrar na etiqueta de viewport que JÁ EXISTE — criar uma
   * segunda não adianta, o navegador usa a primeira.
   */
  const viewport = documento.querySelector('meta[name="viewport"]');
  const conteudo = viewport?.getAttribute('content') ?? '';
  if (viewport && !conteudo.includes('viewport-fit')) {
    viewport.setAttribute('content', `${conteudo}, viewport-fit=cover`);
  }

  jaAplicado = true;
}

/**
 * Quanto reservar embaixo por causa da barra do navegador.
 *
 * O SINTOMA: no Safari do iPhone a barra de endereço flutua POR CIMA da página, e ela
 * cobre justamente a barra de abas — os cinco ícones ficam atrás dela.
 *
 * As margens seguras do sistema não resolvem: a barra flutuante do Safari não entra
 * nelas. Ela não é parte do aparelho, é parte do navegador, e o navegador não avisa.
 *
 * Então: quando o jogo está aberto DENTRO do navegador, reserva 34 pontos a mais embaixo.
 * Quando está aberto pela tela de início (em tela cheia, sem barra nenhuma), reserva
 * zero — ali a barra não existe e o espaço extra só faria a barra de abas flutuar.
 *
 * A solução de verdade continua sendo "Adicionar à Tela de Início": isto aqui é pra
 * quem ainda não fez, e pra continuar utilizável no navegador do computador.
 */
export function folgaDaBarraDoNavegador(): number {
  if (Platform.OS !== 'web') return 0;
  const janela = globalThis as {
    navigator?: { standalone?: boolean };
    matchMedia?: (consulta: string) => { matches: boolean };
  };
  const emTelaCheia =
    janela.navigator?.standalone === true ||
    janela.matchMedia?.('(display-mode: standalone)').matches === true;
  return emTelaCheia ? 0 : 34;
}
