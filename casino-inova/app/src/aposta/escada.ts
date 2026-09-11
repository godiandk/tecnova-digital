/**
 * A ESCADA DA APOSTA — quanto dá pra apostar, e como chegar lá em dois ou três toques.
 *
 * O PROBLEMA QUE ISTO RESOLVE, dito com número: nas mesas altas o mínimo é 500 milhões de
 * fichas. Oito telas do jogo tinham um `+` e um `−` que andavam de 50 em 50, começando em
 * 100. Pra sair de 100 e chegar em 500 milhões seriam **dez milhões de toques**. Não é
 * exagero de retórica: é a divisão.
 *
 * Pior: a tela pedia a configuração da mesa e recebia sempre o mínimo do BRONZE (50),
 * enquanto o servidor validava a aposta contra o degrau de VERDADE da pessoa. Quem tinha
 * saldo de mesa alta via um seletor de 50 a 1.000 e tomava 400 em toda aposta.
 *
 * AS REGRAS, e todas valem sempre:
 *
 *   1. A APOSTA COMEÇA NO MÍNIMO DA MESA, nunca num número inventado. Se a mesa pede 500
 *      milhões, o seletor abre em 500 milhões.
 *   2. NUNCA ABAIXO DO MÍNIMO, NUNCA ACIMA DO SALDO. As duas pontas são apertadas aqui,
 *      antes de qualquer requisição — quem não tem saldo pro mínimo não recebe um seletor
 *      quebrado, recebe a informação de que não dá.
 *   3. FICHA NÃO SE PARTE. Todo valor é inteiro, e o arredondamento é sempre PRA BAIXO,
 *      pro ajuste nunca criar uma aposta que o saldo não cobre.
 *
 * ESTE ARQUIVO NÃO DESENHA NADA. É conta, e por isso a promessa dos "dois a três toques"
 * pode ser CONFERIDA em vez de prometida — `verifica-escada-de-aposta` mede o caminho até
 * cada atalho e reprova se algum passar de três.
 */

export interface FaixaDeAposta {
  /** O mínimo do degrau em que a pessoa joga. Vem do servidor (`/niveis/meu`). */
  minimo: number;
  /** O saldo dela. É o teto de verdade — não existe aposta máxima neste jogo. */
  saldo: number;
  /** As fichas do degrau, do menor pro maior. A menor é o próprio mínimo. */
  fichas: number[];
  /**
   * O teto da ARITMÉTICA desta mesa, quando ela tem um. Não é aposta máxima de negócio —
   * não existe aposta máxima neste jogo —, é até onde o prêmio máximo ainda cabe em ficha
   * exata.
   *
   * NÃO BASTA O TRILHO PARAR NO DEGRAU CERTO, e foi a conferência que mostrou: quem tem
   * 146 bilhões e toca "tudo" no caça-níqueis monta uma aposta de 146 bilhões, e o
   * servidor recusa em 112,6 bilhões (80.000x acima disso não cabe). O degrau estava
   * certo; quem estourava era o saldo. Como todo caminho do seletor passa por `ajustar`,
   * o teto mora aqui e vale pra ficha, dobro, metade e tudo de uma vez.
   *
   * Ausente = sem teto de aritmética; o saldo continua sendo o único limite.
   */
  maximo?: number;
}

/** Dá pra apostar nesta mesa? Falso quando o saldo não cobre nem o mínimo. */
export function podeApostar(faixa: FaixaDeAposta): boolean {
  if (!Number.isFinite(faixa.saldo) || !Number.isFinite(faixa.minimo)) return false;
  if (faixa.minimo <= 0 || faixa.saldo < faixa.minimo) return false;
  /* O mínimo também precisa caber no teto da conta — senão não existe aposta legal. */
  const teto = faixa.maximo;
  return teto === undefined || !Number.isFinite(teto) || faixa.minimo <= teto;
}

/**
 * Aperta um valor na faixa e deixa inteiro.
 *
 * O arredondamento é PRA BAIXO de propósito: `Math.round` num valor perto do saldo
 * poderia subir um ponto e criar uma aposta que o saldo não paga — o servidor recusaria,
 * e a pessoa levaria um erro depois de escolher.
 */
export function ajustar(faixa: FaixaDeAposta, valor: number): number {
  if (!podeApostar(faixa)) return 0;
  if (!Number.isFinite(valor)) return faixa.minimo;
  return Math.max(faixa.minimo, Math.min(tetoDaMesa(faixa), Math.floor(valor)));
}

/** O maior valor que esta mesa aceita: o saldo, ou o teto da conta exata se houver. */
function tetoDaMesa(faixa: FaixaDeAposta): number {
  const teto = faixa.maximo;
  return teto !== undefined && Number.isFinite(teto) && teto > 0
    ? Math.min(faixa.saldo, teto)
    : faixa.saldo;
}

/** Onde o seletor abre: o mínimo da mesa. Nunca um número inventado. */
export function apostaInicial(faixa: FaixaDeAposta): number {
  return podeApostar(faixa) ? faixa.minimo : 0;
}

export function dobrar(faixa: FaixaDeAposta, valor: number): number {
  return ajustar(faixa, valor * 2);
}

export function metade(faixa: FaixaDeAposta, valor: number): number {
  return ajustar(faixa, valor / 2);
}

/** Tudo o que a pessoa tem. Um toque, e é a aposta que mais gente procura. */
export function tudo(faixa: FaixaDeAposta): number {
  return ajustar(faixa, faixa.saldo);
}

/**
 * Os atalhos que aparecem como fichas na tela.
 *
 * São as fichas do degrau (mínimo × 1, 2, 5, 10 e 20) que cabem no saldo. Uma mesa cujo
 * degrau a pessoa acabou de alcançar mostra menos fichas, e isso é correto: ficha que a
 * pessoa não pode pagar só serve pra ela tocar e receber recusa.
 */
export function atalhos(faixa: FaixaDeAposta): number[] {
  if (!podeApostar(faixa)) return [];
  const cabem = faixa.fichas
    .filter((f) => Number.isFinite(f) && f >= faixa.minimo && f <= tetoDaMesa(faixa))
    .map((f) => Math.floor(f));
  /* O mínimo sempre aparece, mesmo que o degrau venha sem fichas declaradas. */
  const comOMinimo = cabem.includes(faixa.minimo) ? cabem : [faixa.minimo, ...cabem];
  return [...new Set(comOMinimo)].sort((a, b) => a - b);
}

/** Os movimentos que a tela oferece, na ordem em que aparecem. */
export type Movimento =
  | { tipo: 'ficha'; valor: number }
  | { tipo: 'dobrar' }
  | { tipo: 'metade' }
  | { tipo: 'tudo' };

export function movimentosDe(faixa: FaixaDeAposta): Movimento[] {
  if (!podeApostar(faixa)) return [];
  return [
    ...atalhos(faixa).map((valor) => ({ tipo: 'ficha' as const, valor })),
    { tipo: 'metade' },
    { tipo: 'dobrar' },
    { tipo: 'tudo' },
  ];
}

export function aplicar(faixa: FaixaDeAposta, valor: number, movimento: Movimento): number {
  switch (movimento.tipo) {
    case 'ficha': return ajustar(faixa, movimento.valor);
    case 'dobrar': return dobrar(faixa, valor);
    case 'metade': return metade(faixa, valor);
    case 'tudo': return tudo(faixa);
    default: return valor;
  }
}

/**
 * QUANTOS TOQUES até chegar em `alvo`, partindo da aposta inicial.
 *
 * Existe pra a promessa "dois a três toques" ser MEDIDA e não prometida. É uma busca em
 * largura sobre os movimentos que a tela realmente oferece — então ela mede o caminho que
 * a pessoa faria com o dedo, e não um caminho teórico.
 *
 * Devolve `Infinity` quando não há caminho, que é uma resposta legítima: nem todo número
 * é alcançável por fichas e dobros, e o seletor não promete isso. O que ele promete é
 * chegar rápido nos VALORES QUE IMPORTAM — as fichas do degrau e o tudo.
 */
export function toquesPara(faixa: FaixaDeAposta, alvo: number, teto = 6): number {
  if (!podeApostar(faixa)) return Infinity;
  const inicio = apostaInicial(faixa);
  if (inicio === alvo) return 0;

  const movimentos = movimentosDe(faixa);
  let fronteira = [inicio];
  const vistos = new Set([inicio]);

  for (let toques = 1; toques <= teto; toques += 1) {
    const proxima: number[] = [];
    for (const valor of fronteira) {
      for (const movimento of movimentos) {
        const novo = aplicar(faixa, valor, movimento);
        if (novo === alvo) return toques;
        if (!vistos.has(novo)) {
          vistos.add(novo);
          proxima.push(novo);
        }
      }
    }
    if (proxima.length === 0) break;
    fronteira = proxima;
  }
  return Infinity;
}
