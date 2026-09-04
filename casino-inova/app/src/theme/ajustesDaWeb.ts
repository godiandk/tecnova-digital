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
  jaAplicado = true;
}
