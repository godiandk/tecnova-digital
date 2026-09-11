/**
 * XP e nível: quanto uma rodada vale e quanto cada nível custa.
 *
 * ISTO NÃO EXISTIA. A tabela `users` tinha as colunas `level` e `xp`, a barra do topo
 * sabia desenhar o preenchimento, e as contas de semente nasciam com valores escritos à
 * mão — mas nenhuma linha de código somava XP quando alguém jogava. A barra ia ficar
 * parada pra sempre, e o nível de todo mundo congelado no que nasceu.
 *
 * A CURVA MOROU NO APP ATÉ AQUI, com um comentário admitindo que era provisório. Nível
 * é decisão do servidor: se o app calcula quanto falta pro próximo, dois aplicativos de
 * versões diferentes mostram barras diferentes pro mesmo XP, e nenhum dos dois é a
 * verdade. Agora quem responde é aqui, e o app só desenha o que recebe.
 *
 * COMO A RODADA VIRA XP, e por que assim:
 *
 * XP vem de JOGAR, nunca de ganhar ou de perder. Premiar vitória faria a barra andar
 * mais devagar justamente pra quem está perdendo, que é a última pessoa que deveria
 * receber um empurrão pra continuar. Premiar derrota seria pior ainda: um jogo que
 * recompensa perder. Aqui as duas coisas valem igual, porque o que está sendo
 * reconhecido é o tempo na mesa.
 *
 * A APOSTA ENTRA EM UNIDADES DA MESA, e é essa a decisão que impede dinheiro de virar
 * nível. `r = aposta / mínimo do degrau da pessoa`. Um jogador Bronze apostando vinte
 * vezes o mínimo (mil fichas) e um Eclipse apostando vinte vezes o mínimo (cem trilhões)
 * ganham EXATAMENTE o mesmo XP. Dinheiro compra ficha, ficha compra mesa alta — e mesa
 * alta não dá XP. O que dá XP é jogar grande PARA A SUA MESA, e isso todo mundo pode.
 *
 * A FÓRMULA ANTIGA PREMIAVA APOSTAR O MÍNIMO, e por muito: era `1 + raiz(aposta/10)`, e
 * o "+1" fixo dominava as apostas pequenas. Medido, por ficha apostada, apostar 50 rendia
 * VINTE E NOVE VEZES mais XP que apostar no teto — e ainda perdia vinte e nove vezes menos
 * pra casa. Não havia troca: apostar o mínimo era melhor nos dois eixos ao mesmo tempo,
 * o que é a definição de estratégia dominante.
 *
 * E DUAS COISAS QUE SÃO INCOMPATÍVEIS, ditas de frente: "retorno decrescente" quer uma
 * função côncava, e "apostar pouco não pode ser exploit" quer XP por ficha constante.
 * Função côncava tem XP por ficha decrescente — é a definição de concavidade. A única com
 * XP por ficha constante é a reta, que transformaria ficha em nível.
 *
 * A saída é que o eixo que importa não é POR FICHA, é POR RODADA: o que limita uma pessoa
 * é tempo, não ficha. Aqui, por rodada, apostar a ficha maior rende 4,5 vezes o mínimo; por
 * ficha, o mínimo ainda rende mais, mas 4 vezes em vez de 29. E o que fecha a porta do robô
 * não é a curva, é o TETO DIÁRIO — com ele, quem aposta o mínimo cinco mil vezes por dia e
 * quem aposta a ficha maior mil e duzentas vezes batem no mesmo limite.
 */

/**
 * XP de uma rodada.
 *
 * @param apostado quanto foi apostado, em fichas
 * @param minimoDaMesa a aposta mínima do degrau DA PESSOA — nunca o da mesa em que ela
 *   sentou. Sem isso existe um atalho: quem pode descer um degrau apostaria o mesmo
 *   tanto numa mesa dez vezes mais barata e ganharia 3,5 vezes mais XP pelas mesmas fichas.
 */
export function xpDaRodada(apostado: number, minimoDaMesa: number): number {
  if (!Number.isFinite(apostado) || apostado <= 0) return 0;
  if (!Number.isFinite(minimoDaMesa) || minimoDaMesa <= 0) return 0;
  /*
   * O `r` PARA NA FICHA MAIOR, e isto fecha uma porta que o degrau econômico abriu.
   *
   * Com `economicTier = min(saldo, nível)`, quem compra fichas e continua no nível baixo
   * fica travado numa mesa barata COM MUITO DINHEIRO NO BOLSO. Como não existe aposta
   * máxima (é decisão do dono do jogo, ver `niveis-de-mesa.ts`), essa pessoa podia apostar
   * cem vezes o mínimo daquela mesa e levar o XP do teto em toda rodada — 20% a mais que
   * quem aposta a ficha maior honestamente. Comprar ficha voltaria a acelerar o nível, que
   * é exatamente o que o degrau econômico veio impedir.
   *
   * Apostar acima da ficha maior continua PERMITIDO — só não rende XP a mais. A maior
   * ficha do trilho é o teto do que uma rodada pode valer, e isso vale pros doze degraus.
   */
  const r = Math.min(R_DE_REFERENCIA, apostado / minimoDaMesa);
  const bruto = (XP_NA_FICHA_MAIOR * Math.log(1 + r)) / Math.log(1 + R_DE_REFERENCIA);
  /*
   * O PISO DE 1 XP. Quem desce um degrau pra jogar barato num dia ruim aposta bem abaixo
   * do mínimo do degrau dele — `r` fica em 0,02 e a conta arredonda pra zero. Zero XP numa
   * rodada que a pessoa jogou de verdade parece defeito, e o remédio é barato: o piso não
   * dá pra farmar, porque a 1 XP por rodada seriam 60.000 rodadas pra encher o teto do
   * dia, contra 5.455 apostando o mínimo do próprio degrau. Jogar pequeno demais continua
   * sendo o caminho mais lento de todos — só não é mais o caminho parado.
   */
  return Math.max(1, Math.min(XP_MAXIMO_POR_RODADA, Math.floor(bruto)));
}

/**
 * Quanto vale apostar a MAIOR ficha do trilho, que é 20 vezes o mínimo.
 *
 * É a âncora da curva: `R_DE_REFERENCIA` é o ponto onde o XP chega a este valor, e o teto
 * por rodada fica um pouco acima pra apostar mais que a ficha maior ainda render alguma
 * coisa — só que pouca, e parando logo.
 */
export const XP_NA_FICHA_MAIOR = 50;
export const R_DE_REFERENCIA = 20;

/**
 * Teto de XP por rodada. Nenhuma aposta, por maior que seja, compra um nível.
 *
 * Ele COINCIDE com `XP_NA_FICHA_MAIOR` por construção, agora que o `r` para na ficha
 * maior — e continua existindo como trava separada porque é ele que está conferido contra
 * o custo do nível mais barato (`verify-xp`, conferência 5). Se um dia alguém soltar o
 * limite do `r`, é esta constante que segura, e a conferência avisa antes.
 */
export const XP_MAXIMO_POR_RODADA = 50;

/**
 * TETO DE XP POR DIA — é ele que trava robô, automação e farm de aposta mínima.
 *
 * A curva sozinha não resolve: quem tem tempo infinito aposta o mínimo muitas vezes e
 * chega no mesmo lugar gastando menos ficha. Com o teto, os dois caminhos batem no mesmo
 * limite diário — o robô economiza ficha e NÃO sobe de nível mais rápido, que é o que
 * interessa.
 *
 * 60.000 são cerca de duas horas de jogo apostando a ficha maior. Quem joga mais que isso
 * num dia continua jogando; só não acumula mais barra naquele dia.
 */
export const XP_MAXIMO_POR_DIA = 60_000;

/**
 * Quanto XP o nível `nivel` precisa pra virar o seguinte.
 *
 * Cresce com a RAIZ do nível: o 1 custa 197, o 100 custa 1.970, o 10.000 custa 19.700.
 * Raiz e não reta porque com dez mil níveis uma reta obriga a escolher entre níveis
 * iniciais gratuitos e níveis finais inalcançáveis — a raiz dá os dois, com o último
 * nível custando cem vezes o primeiro.
 */
export function xpDoNivel(nivel: number): number {
  return Math.round(CUSTO_BASE * Math.sqrt(Math.max(1, nivel)));
}

/**
 * A constante da curva de custo, calibrada pelo ALVO DE TEMPO e não pelo gosto.
 *
 * `custo(N) = 197 × √N`. O 197 sai de uma conta com destino: o jogador pesado (duas horas
 * e meia por dia na ficha maior, batendo no teto diário) chega ao nível 10.000 em seis
 * anos. Foi assim que as faixas caíram onde o produto pediu — 1 a 20 em horas, 100 numa
 * semana, 1.000 em oito meses, e o 10.000 como prestígio de verdade.
 *
 * A curva ANTIGA era `500 + (N−1) × 250`, e com ela o nível 10.000 exigia 250 milhões de
 * rodadas: quarenta anos jogando sem parar. O nível alto não era difícil, era ficção.
 */
const CUSTO_BASE = 197;

/**
 * O TOPO DA ESCADA — o nível mais alto que existe.
 *
 * Não é enfeite nem número redondo escolhido por gosto: é o teto que a curva de custo foi
 * calibrada pra entregar, e é o mesmo 10.000 que o degrau Eclipse pede pra abrir. Seis
 * anos de jogo pesado até aqui.
 *
 * ELE PRECISA EXISTIR NO CÓDIGO, e não só no documento, por um motivo prático: sem teto,
 * `somarXp` ou sobe pra sempre (um prêmio grande viraria nível 40.000, que nenhuma tela
 * sabe desenhar) ou para no meio do caminho com a barra estourada. As duas coisas já
 * aconteceram aqui — a segunda era o `subiu > 100` que este arquivo tinha.
 */
export const NIVEL_MAXIMO = 10_000;

export interface Progresso {
  level: number;
  xp: number;
  /** Quanto falta pra virar de nível, a partir do XP atual. Zero no topo da escada. */
  xpToNextLevel: number;
  /** Quantos níveis subiram nesta rodada — 0 na maioria das vezes. */
  subiuNiveis: number;
  /** Chegou no `NIVEL_MAXIMO`. A barra não anda mais, e a tela precisa saber disso. */
  noTopo: boolean;
}

/**
 * O progresso depois de uma rodada — o que a tela precisa pra animar a barra com verdade.
 *
 * `ganho` é o XP que REALMENTE entrou, já cortado pelo teto do dia, e não o que a rodada
 * valeria. A diferença importa: uma animação de "+50 XP" subindo na tela enquanto a barra
 * não anda é a animação contando uma coisa que não aconteceu, e aqui toda animação conta
 * o que já aconteceu. Com `noTetoDoDia`, a tela diz a verdade — "você alcançou o máximo
 * de hoje" — em vez de mostrar um ganho fantasma.
 */
export interface ProgressoDaRodada extends Progresso {
  /** O XP que entrou de verdade nesta rodada. Zero quando o teto do dia já estava cheio. */
  ganho: number;
  /** Quanto já foi ganho hoje, somando esta rodada. */
  xpDoDia: number;
  /** O teto de hoje foi alcançado: as próximas rodadas não somam mais até virar o dia. */
  noTetoDoDia: boolean;
}

/**
 * Soma XP e sobe de nível quantas vezes for preciso.
 *
 * O LAÇO EXISTE porque um ganho grande pode passar de mais de um nível de uma vez.
 * Nenhuma APOSTA chega perto disso (o teto por rodada é 60 e o nível mais barato custa
 * 197), mas outras fontes chegam: prêmio de torneio, recompensa diária, ajuste de
 * suporte. Com um `if`, quem recebesse um prêmio grande subiria um nível só e ficaria
 * com a barra estourada — cheia muito além do fim — até a rodada seguinte.
 *
 * E O LAÇO PARA NO TOPO, não num número arbitrário. A versão anterior parava depois de
 * cem níveis numa chamada, o que trocava um defeito por outro: dez milhões de XP de uma
 * vez levavam ao nível 102 com 9.865.741 de XP sobrando numa barra que segura 1.990. O
 * teto de verdade é o `NIVEL_MAXIMO`, e o laço nunca roda mais que isso.
 *
 * O QUE ACONTECE COM O XP QUE SOBRA NO TOPO: some, e isso é dito na cara. Acima do
 * 10.000 não existe nível pra comprar, então guardar o excedente seria guardar crédito
 * pra uma coisa que não existe. Quem chegou lá vê `noTopo` e a barra cheia, parada.
 */
export function somarXp(level: number, xp: number, ganho: number): Progresso {
  let nivelNovo = Math.min(NIVEL_MAXIMO, Math.max(1, Math.floor(level)));
  let xpNovo = Math.max(0, Math.floor(xp)) + Math.max(0, Math.floor(ganho));
  let subiu = 0;

  while (nivelNovo < NIVEL_MAXIMO && xpNovo >= xpDoNivel(nivelNovo)) {
    xpNovo -= xpDoNivel(nivelNovo);
    nivelNovo += 1;
    subiu += 1;
  }

  const noTopo = nivelNovo >= NIVEL_MAXIMO;
  return {
    level: nivelNovo,
    xp: noTopo ? 0 : xpNovo,
    xpToNextLevel: noTopo ? 0 : xpDoNivel(nivelNovo),
    subiuNiveis: subiu,
    noTopo,
  };
}
