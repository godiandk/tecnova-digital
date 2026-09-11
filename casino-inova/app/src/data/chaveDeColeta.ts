/**
 * A CHAVE DE IDEMPOTÊNCIA DA COLETA DO DIA.
 *
 * Ela identifica a INTENÇÃO ("a coleta de hoje"), não o pedido. Isso é o que faz o retry
 * depois de uma rede ruim devolver o prêmio em vez de um erro: se o servidor já pagou e a
 * resposta se perdeu no caminho, o segundo pedido chega com a MESMA chave e recebe de
 * volta a mesma coleta.
 *
 * POR QUE NÃO SORTEAR A CADA TOQUE: aí o segundo toque seria uma coleta DIFERENTE, o
 * servidor a recusaria com "você já coletou hoje", e quem tocou duas vezes por causa de
 * lentidão veria um erro no lugar do prêmio — exatamente o caso que a idempotência existe
 * pra cobrir.
 *
 * A CHAVE É POR APARELHO E POR DIA. O aparelho entra porque duas pessoas coletando ao
 * mesmo tempo não podem colidir; o dia entra porque a coleta de amanhã é outra intenção.
 * O identificador do aparelho é sorteado uma vez e guardado em memória: perder na troca de
 * tela não tem custo, porque a trava de verdade — uma coleta por pessoa por dia — está no
 * banco, e a chave só melhora a mensagem.
 */
let esteAparelho: string | null = null;

function idDoAparelho(): string {
  if (!esteAparelho) {
    esteAparelho = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
  return esteAparelho;
}

/** @param dia o dia do servidor, em `AAAA-MM-DD` — vem no calendário. */
export function chaveDeColeta(dia: string): string {
  return `${dia}:${idDoAparelho()}`;
}
