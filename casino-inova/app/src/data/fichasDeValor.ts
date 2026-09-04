import { PLAYER_CHIP_IMAGES, PLAYER_COLOR_LABELS, PlayerColor } from './chipImages';

/**
 * A FICHA: de quem ela é, e quanto ela vale.
 *
 * Numa mesa de cassino essas são duas informações separadas, carregadas por duas coisas
 * diferentes da mesma ficha, e é isso que faz uma mesa cheia funcionar:
 *
 *   A COR DO CORPO diz DE QUEM É. Quando você senta numa mesa, o dealer te entrega
 *   fichas de uma cor que ninguém mais tem naquela mesa. Aí várias pessoas podem apostar
 *   na mesma casa e, na hora de pagar, ninguém discute de quem é o quê — dá pra ver.
 *   Quem escolhe a cor é o servidor, em PLAYER_COLORS: são quinze, e por isso a mesa tem
 *   no máximo quinze lugares.
 *
 *   A CHAPA NO MEIO diz QUANTO VALE. Fica escrito, em número, num disco escuro no centro
 *   da ficha. Tem que ser assim porque a cor já está ocupada dizendo de quem é: se a cor
 *   dissesse também o valor, um jogador com quinze denominações precisaria de quinze
 *   cores, e a mesa acabaria na primeira pessoa.
 *
 * Isso não é invenção nossa: é exatamente o sistema da roleta de cassino físico, onde
 * cada jogador recebe fichas sem valor impresso, numa cor só dele, e o valor é acertado
 * na mesa. Aqui o valor vai impresso porque a tela permite, e o resultado é melhor:
 * dá pra ler de quem é E quanto vale de uma olhada só.
 */
/**
 * O NÚMERO ESCRITO NA CHAPA, encurtado pra caber num disco.
 *
 * "5.000.000" não cabe num disco de 50 pixels e saía cortado como "5…" — que é pior do
 * que abreviar, porque quem lê não sabe se são cinco mil ou cinco bilhões. Foi o que
 * apareceu na tela com as fichas altas.
 *
 * As abreviações são as do português: k pra mil, mi pra milhão, bi pra bilhão, tri pra
 * trilhão, qua pra quatrilhão. Elas seguem enquanto a escada seguir.
 *
 * Meio número é escrito com vírgula ("2,5mi") e não com ponto: em português o ponto
 * separa milhar, e "2.5mi" se lê como dois milhões e meio em inglês e como nada em
 * português.
 */
const SUFIXOS: Array<{ de: number; sufixo: string }> = [
  { de: 1e15, sufixo: 'qua' },
  { de: 1e12, sufixo: 'tri' },
  { de: 1e9, sufixo: 'bi' },
  { de: 1e6, sufixo: 'mi' },
  { de: 1e3, sufixo: 'k' },
];

export function chapaEmTexto(valor: number): string {
  if (!Number.isFinite(valor)) return '?';
  for (const { de, sufixo } of SUFIXOS) {
    if (valor >= de) {
      const n = valor / de;
      // Só mostra a casa decimal quando ela existe: "2,5mi" sim, "5,0mi" não.
      const escrito = Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
      return `${escrito}${sufixo}`;
    }
  }
  return String(Math.round(valor));
}

/**
 * O mesmo valor, separado no que é NÚMERO e no que é ESCALA.
 *
 * Numa ficha de cassino de verdade a denominação alta não vem escrita numa linha só: o
 * número vem grande e a escala vem pequena embaixo dele. Não é enfeite — é o que faz o
 * valor caber. Numa chapa redonda a linha mais larga é que manda no tamanho da letra, e
 * "500mi" numa linha obriga a letra a encolher tanto que ninguém lê. Quebrado em "500"
 * em cima e "mi" embaixo, o número fica quase 50% maior, que é a informação que
 * importa: quem olha o trilho decide pela grandeza, não pelo sufixo.
 *
 * Sem sufixo (valores abaixo de mil) `sufixo` vem vazio e a chapa desenha uma linha só.
 */
export function chapaEmPartes(valor: number): { numero: string; sufixo: string } {
  const texto = chapaEmTexto(valor);
  const corte = texto.search(/[a-z]/i);
  if (corte < 0) return { numero: texto, sufixo: '' };
  return { numero: texto.slice(0, corte), sufixo: texto.slice(corte) };
}

/**
 * As denominações e a cor da chapa de cada uma.
 *
 * Vermelho 5, verde 25 e preto 100 é a convenção que vale em qualquer mesa do mundo.
 * Acima disso cada casa faz de um jeito, então seguimos o que a arte tem: azul pro 500 e
 * ouro pro 1000. Quem já jogou reconhece; quem nunca jogou aprende algo que vale fora
 * daqui também.
 *
 * A chapa é sempre escura por baixo do número, seja qual for a cor do jogador — um
 * número dourado sobre disco preto lê igual em cima de ficha branca ou de ficha vinho, e
 * é o que garante que a denominação não some quando a cor do jogador é clara.
 */
/*
 * AS FICHAS NÃO SÃO MAIS UMA LISTA — elas vêm do SERVIDOR, calculadas sobre o saldo.
 *
 * Enquanto eram uma lista escrita à mão, ela precisava adivinhar até onde uma banca
 * podia crescer, e sempre acabava antes: quem chegou a noventa e nove bilhões via o
 * trilho parar em cem milhões. Agora o servidor manda as cinco fichas do degrau em que
 * a pessoa está (`/niveis/meu`), e este arquivo só sabe DESENHAR uma ficha de qualquer
 * valor — inclusive de um valor que ninguém previu.
 *
 * O que sobrou aqui é o que é visual: como o valor é escrito na chapa e de que cor ela
 * fica.
 */

/**
 * A cor da chapa, pelo lugar do valor dentro da própria casa decimal.
 *
 * Vermelho, verde, preto, azul e ouro é a convenção que vale em qualquer mesa do mundo
 * pra 5, 25, 100, 500 e 1000. Repetindo o ciclo a cada casa, quem aprendeu a ler o
 * trilho de baixo lê o de cima sem reaprender nada: o 5 milhões é vermelho como o 5, o
 * 25 milhões é verde como o 25.
 *
 * A conta é feita sobre a MANTISSA (o valor dividido pela maior potência de 10 que cabe
 * nele), então funciona pra qualquer tamanho, hoje e daqui a dez degraus.
 */
const CICLO_DE_CORES: Array<{ ate: number; chapa: string }> = [
  { ate: 1.5, chapa: '#B8892E' }, // 1 — ouro
  { ate: 3, chapa: '#C4342C' },   // 2 — vermelho
  { ate: 7, chapa: '#1E7A46' },   // 5 — verde
  { ate: 10, chapa: '#2B4E8C' },  // 8 e 9 — azul
];

export function corDaChapa(valor: number): string {
  if (!Number.isFinite(valor) || valor <= 0) return '#14181B';
  const casa = 10 ** Math.floor(Math.log10(valor));
  const mantissa = valor / casa;
  for (const faixa of CICLO_DE_CORES) if (mantissa < faixa.ate) return faixa.chapa;
  return '#14181B';
}

/** A arte da ficha de uma pessoa. Sem cor conhecida, cai na primeira — nunca quebra. */
export function arteDaFicha(cor: PlayerColor | undefined) {
  return PLAYER_CHIP_IMAGES[cor ?? 'branco'] ?? PLAYER_CHIP_IMAGES.branco;
}

/** "duas de 100 e uma de 25" — pra quem ouve a mesa em vez de ver. */
export function pilhaEmPalavras(fichas: number[]): string {
  if (fichas.length === 0) return 'nenhuma ficha';
  const contagem = new Map<number, number>();
  for (const f of fichas) contagem.set(f, (contagem.get(f) ?? 0) + 1);
  const partes = [...contagem.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([valor, n]) => `${n === 1 ? 'uma' : n} de ${valor.toLocaleString('pt-BR')}`);
  if (partes.length === 1) return partes[0];
  return `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`;
}

/** As quinze cores, na mesma ordem de PLAYER_COLORS no servidor. */
export const CORES_DE_JOGADOR = Object.keys(PLAYER_COLOR_LABELS) as PlayerColor[];

/**
 * A cor de quem está jogando sozinho contra a casa.
 *
 * Numa mesa compartilhada quem dá a cor é o SERVIDOR, que sabe quem já sentou e não
 * repete — é o único jeito de garantir que duas pessoas na mesma mesa não fiquem com a
 * mesma cor. Nas mesas de um jogador só contra a casa não existe essa disputa, e aí a
 * cor sai do identificador da própria pessoa: assim ela é sempre a mesma pra quem entra,
 * partida após partida, em vez de sortear uma cor diferente a cada rodada.
 *
 * Sem identificador (visitante que ainda não criou conta) a resposta é `undefined`, e
 * quem desenha cai na primeira cor. Não inventamos identidade pra quem não tem.
 */
export function corDoJogador(id: string | undefined): PlayerColor | undefined {
  if (!id) return undefined;
  let soma = 0;
  for (let i = 0; i < id.length; i += 1) soma = (soma * 31 + id.charCodeAt(i)) >>> 0;
  return CORES_DE_JOGADOR[soma % CORES_DE_JOGADOR.length];
}

/**
 * Um valor virado em fichas, da maior pra menor — do jeito que o caixa troca.
 *
 * Serve pra desenhar a pilha de quem a gente não viu apostar. As apostas que chegam do
 * servidor vêm como um número só ("450 no Grande"), não como a lista de fichas que a
 * pessoa encostou, então a pilha dela é reconstruída aqui. A da gente não passa por
 * isto enquanto não é confirmada: essa a gente viu montar, e mostra as fichas que foram
 * postas de verdade.
 */
export function decomporEmFichas(valor: number, fichasDaMesa?: number[]): number[] {
  /*
   * As unidades vêm da MESA quando ela é conhecida — são as fichas que aquele degrau
   * tem. Sem elas, cai num ciclo 1/2/5 gerado na hora, que serve pra qualquer valor.
   *
   * A lista fixa antiga parava em mil: uma pilha de cinco milhões virava cinco mil
   * fichas de mil, e a tela tentava desenhar cinco mil discos.
   */
  const unidades = (fichasDaMesa?.length ? [...fichasDaMesa] : unidadesAteCobrir(valor))
    .filter((u) => u > 0)
    .sort((a, b) => b - a);

  const fichas: number[] = [];
  let resto = valor;
  for (const unidade of unidades) {
    // Teto de segurança: uma pilha nunca precisa de mais de 20 fichas pra ser lida.
    while (resto >= unidade && fichas.length < 20) {
      fichas.push(unidade);
      resto -= unidade;
    }
  }
  // A pilha é desenhada de baixo pra cima, e no feltro a maior fica embaixo.
  return fichas.reverse();
}

/** Um ciclo 1/2/5 do 5 até cobrir o valor. Usado quando a mesa não informou as fichas. */
function unidadesAteCobrir(valor: number): number[] {
  const unidades: number[] = [];
  let casa = 5;
  while (casa <= Math.max(5, valor) && unidades.length < 40) {
    unidades.push(casa, casa * 2, casa * 5);
    casa *= 10;
  }
  return unidades;
}
