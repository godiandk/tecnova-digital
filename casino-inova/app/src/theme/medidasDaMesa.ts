import { LARGURA_MINIMA_PRO_TAMPO } from '../components/TampoDaMesa';

/**
 * O DIMENSIONAMENTO DAS MESAS — todo tamanho de objeto de jogo, num lugar só.
 *
 * Antes disto as medidas estavam espalhadas: parte em mapaDosTampos.ts junto das
 * POSIÇÕES, parte solta dentro das telas, e as funções que calculam o tamanho da ficha
 * estavam COPIADAS palavra por palavra em duas telas — duas cópias que iam divergir na
 * primeira vez que alguém ajustasse uma e esquecesse a outra. O tamanho do dado do Bac
 * Bo era um 0.05 escrito no meio do código, sem nome e sem explicação.
 *
 * A regra que organiza este arquivo, e que vale pra toda medida daqui:
 *
 *     TAMANHO = fração do tampo, com piso (e às vezes teto) em pixel.
 *
 * A FRAÇÃO mantém a proporção certa: um tampo de 1600 e um de 700 são a mesma mesa em
 * tamanhos diferentes, e um objeto medido em fração cresce junto com ela. Sem isso, uma
 * ficha boa no tablet vira um botão gigante no monitor.
 *
 * O PISO EM PIXEL é o que a fração sozinha não garante: legibilidade e alcance do dedo.
 * Numa janela estreita, 5% de qualquer coisa vira confete — o número da ficha some, o
 * ponto do dado some, e o alvo de toque fica menor que a ponta do dedo. Abaixo do piso
 * a proporção perde pra função, de propósito.
 *
 * Cada número abaixo diz DE ONDE VEIO. Nenhum é chute: ou saiu de medição na arte, ou
 * de um limite conhecido de interface (os 44pt de alvo de toque), ou de uma proporção
 * física de cassino. Quem mudar um deles deve trocar a explicação junto.
 */

/* ------------------------------------------------------------------ *
 * FICHAS                                                              *
 * ------------------------------------------------------------------ */

/**
 * Ficha em cima do pano, em fração da LARGURA do tampo.
 *
 * A régua é a letra impressa no feltro: uma ficha tem que ler tão fácil quanto o nome
 * da casa em que está. Medindo a altura das maiúsculas na arte do Bac Bo — JOGADOR
 * 0.0491 e BANCA 0.0704 da altura da mesa, média 0.0598, que numa mesa 16:9 dá 0.0336
 * da largura — e aplicando a vez e meia que uma ficha de cassino tem em relação à letra
 * ao lado dela, chega-se a 0.054.
 */
export const FICHA_NO_PANO = 0.054;

/** Abaixo de 44px o número impresso na ficha some, e fração não protege disso. */
export const FICHA_NO_PANO_MINIMA = 44;

/**
 * Ficha no trilho, em fração da largura do tampo.
 *
 * Maior que a do pano porque nela se TOCA. O mínimo confortável pra um dedo é 44pt; 56
 * dá folga real, e o teto de 84 evita que numa tela grande o trilho vire um cinto de
 * fichas gigantes.
 */
export const FICHA_NO_TRILHO = 0.062;
export const FICHA_NO_TRILHO_MINIMA = 56;
export const FICHA_NO_TRILHO_MAXIMA = 84;

/**
 * Quanto de cada ficha aparece na pilha, em fração do diâmetro.
 *
 * Medido numa foto de pilha de verdade: seis fichas empilhadas ocupam cerca de 1,2
 * diâmetro de altura, o que dá 0.20 por ficha. Menos que isso e a pilha vira um borrão;
 * mais e ela lê como fichas soltas equilibradas.
 */
export const PASSO_DA_PILHA = 0.2;

/**
 * Quantas fichas da pilha aparecem.
 *
 * Cinco não é número redondo: a faixa de feltro livre da casa do jogador mede 0.163 da
 * altura da mesa, e cinco fichas ocupam 1 + 4×0.20 = 1.8 diâmetro, que é o que cabe ali
 * sem subir por cima do nome da casa. Passando disso a pilha continua contando certo —
 * ela só para de crescer na tela, como pilha que alguém arrumou.
 */
export const FICHAS_VISIVEIS_NA_PILHA = 5;

/* ------------------------------------------------------------------ *
 * DADOS                                                               *
 * ------------------------------------------------------------------ */

/**
 * Dado dentro do agitador de vidro (Bac Bo), em fração da largura do tampo.
 *
 * 5% é o que cabe DENTRO do vidro desenhado na arte — maior que isso e o dado
 * transborda o copo.
 */
export const DADO_NO_AGITADOR = 0.05;
export const DADO_NO_AGITADOR_MINIMO = 26;

/**
 * Dado dentro da tigela de couro (Banca Francesa), em fração da largura do tampo.
 *
 * A régua é a própria tigela: ela tem 0.109 da altura da mesa de fundo visível (de
 * 0.163 a 0.2722, medido), e um dado a 60% dessa altura assenta dentro dela sem afundar
 * nem transbordar — 0.065 da altura, que numa mesa 16:9 dá 0.037 da largura. Num tampo
 * de 1180 são 44 pixels: menor que uma ficha (64), que é o certo, porque dado é menor
 * que ficha mesmo.
 */
export const DADO_NA_TIGELA = 0.037;
export const DADO_NA_TIGELA_MINIMO = 34;

/* ------------------------------------------------------------------ *
 * O FORMATO DA TELA                                                   *
 * ------------------------------------------------------------------ */

/**
 * Tela baixa: não cabe avental de duas linhas.
 *
 * 520px é a altura abaixo da qual reservar espaço pra duas linhas de controle espremia
 * a mesa a menos da metade da tela — sem cobrir nada, mas desperdiçando o resto em
 * tarja preta. É o caso do celular deitado (390 de altura). Acima disso as duas linhas
 * cabem com folga.
 */
export const ALTURA_DE_TELA_BAIXA = 520;

export function telaBaixa(janela: { height: number }): boolean {
  return janela.height < ALTURA_DE_TELA_BAIXA;
}

/* ------------------------------------------------------------------ *
 * AS CONTAS                                                           *
 * ------------------------------------------------------------------ */

const entre = (minimo: number, valor: number, maximo = Number.MAX_SAFE_INTEGER) =>
  Math.round(Math.min(maximo, Math.max(minimo, valor)));

/** Diâmetro da ficha em cima do pano. */
export function fichaNoPano(larguraDoTampo: number): number {
  return entre(FICHA_NO_PANO_MINIMA, larguraDoTampo * FICHA_NO_PANO);
}

/**
 * Diâmetro da ficha no trilho.
 *
 * Em tela baixa ela encolhe até o mínimo confortável pro dedo, e não abaixo: numa tela
 * de 390 de altura, uma ficha de 84 comeria um quinto do ecrã.
 */
export function fichaNoTrilho(larguraDoTampo: number, apertado = false): number {
  const bruto = entre(FICHA_NO_TRILHO_MINIMA, larguraDoTampo * FICHA_NO_TRILHO, FICHA_NO_TRILHO_MAXIMA);
  return apertado ? Math.min(bruto, FICHA_NO_TRILHO_MINIMA) : bruto;
}

/**
 * Quanto do vidro o dado ocupa, de lado a lado.
 *
 * 58% é o que faz caber COM FOLGA PRA CHACOALHAR. Acima disso o dado entala: sobra
 * menos de um quarto do próprio tamanho pra cada lado, e o movimento vira tremidinha em
 * vez de batida no vidro. Abaixo disso ele fica pequeno demais pra ler a face de longe.
 *
 * Com 58%, o dado tem 0,73 do próprio raio de folga pra cada lado na horizontal e mais
 * de um dado inteiro de altura pra subir — que é o espaço da bola na máquina de bingo.
 */
const DADO_DENTRO_DO_VIDRO = 0.58;

/**
 * Lado do dado dentro do agitador de vidro, DERIVADO DA CÁPSULA.
 *
 * ESTA É A CORREÇÃO DE UM DEFEITO QUE APARECEU NA TELA: o dado saía de dentro do pote.
 * A causa era o tamanho vir de um número próprio — 5% da largura do tampo — escolhido
 * sem olhar a cápsula. O vidro tem 5,2% da largura. O dado preenchia o tubo inteiro,
 * não sobrava folga nenhuma, e qualquer arredondamento o punha atravessando o vidro.
 *
 * Agora quem manda é a cápsula: o dado é uma fração DELA. Ele cabe por construção, em
 * qualquer tamanho de tela e em qualquer das duas artes (deitada e em pé), porque as
 * duas informam a própria largura de vidro.
 */
export function dadoDentroDoVidro(larguraDoTampo: number, larguraDoVidro: number): number {
  return Math.max(10, larguraDoVidro * larguraDoTampo * DADO_DENTRO_DO_VIDRO);
}

/**
 * Lado do dado no agitador, quando não se sabe a largura do vidro.
 *
 * Sobrou pra quem ainda não passa a cápsula. Prefira `dadoDentroDoVidro`: este aqui
 * escolhe o tamanho sem olhar onde o dado vai ficar, que é a origem do defeito acima.
 */
export function dadoNoAgitador(larguraDoTampo: number): number {
  return entre(DADO_NO_AGITADOR_MINIMO, larguraDoTampo * DADO_NO_AGITADOR);
}

/** Lado do dado na tigela de couro. */
export function dadoNaTigela(larguraDoTampo: number): number {
  return entre(DADO_NA_TIGELA_MINIMO, larguraDoTampo * DADO_NA_TIGELA);
}

/**
 * Largura do placar de histórico dentro da folha que o mostra.
 *
 * O teto existe porque a moldura é 2:1: sem ele, num monitor largo o painel viraria uma
 * faixa de meio metro de comprimento por um palmo de altura, com as contas perdidas
 * numa ponta. `margem` é o respiro lateral que a folha já aplica.
 */
export const PLACAR_LARGURA_MAXIMA = 760;

export function larguraDoPlacar(larguraDaJanela: number, margem: number): number {
  return Math.min(larguraDaJanela - margem * 2, PLACAR_LARGURA_MAXIMA);
}

/** Reexportado pra quem precisa decidir layout sem importar o componente do tampo. */
export { LARGURA_MINIMA_PRO_TAMPO };
