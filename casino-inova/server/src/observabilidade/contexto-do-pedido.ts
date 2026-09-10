/**
 * O CONTEXTO QUE VIAJA COM O PEDIDO.
 *
 * O problema que isto resolve: pra uma linha escrita lá no fundo do caça-níqueis saber de
 * qual pedido ela é, ou o número do pedido desce por parâmetro por toda a pilha — e aí
 * *toda* assinatura de *todo* serviço ganha um argumento que não tem nada a ver com o jogo
 * —, ou ele fica guardado em algum lugar que acompanha a execução.
 *
 * `AsyncLocalStorage` é esse lugar. Ele é do próprio Node, sobrevive a `await`, e é
 * separado por pedido mesmo com dezenas acontecendo ao mesmo tempo — que é a parte que
 * uma variável global não daria conta.
 *
 * O QUE NÃO ENTRA AQUI: nada que o jogo precise pra decidir. Isto é contexto de
 * OBSERVAÇÃO. Autorização, saldo e regra continuam vindo por parâmetro e passando pelo
 * banco, porque o dia em que uma decisão de dinheiro depender de um valor implícito é o
 * dia em que ninguém mais consegue ler o código e ter certeza.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

import { ligarContextoDoPedido, type ContextoDoRegistro } from './registro';

const armazem = new AsyncLocalStorage<ContextoDoRegistro>();

/** Roda `oQueFazer` com este contexto pendurado em tudo que acontecer dentro. */
export function comContexto<T>(contexto: ContextoDoRegistro, oQueFazer: () => T): T {
  const deFora = armazem.getStore() ?? {};
  return armazem.run({ ...deFora, ...contexto }, oQueFazer);
}

/** O contexto de agora, ou vazio se estamos fora de um pedido (na subida, num cron). */
export function contextoAgora(): ContextoDoRegistro {
  return armazem.getStore() ?? {};
}

/**
 * Acrescenta ao contexto do pedido que já está correndo.
 *
 * É assim que o `rodada` entra: quando o pedido começou ele ainda não existia — a rodada
 * só é aberta lá dentro. A partir do momento em que existe, toda linha seguinte daquele
 * pedido carrega o número dela, sem ninguém precisar passar nada.
 */
export function acrescentarAoContexto(mais: ContextoDoRegistro): void {
  const agora = armazem.getStore();
  if (agora) Object.assign(agora, mais);
}

ligarContextoDoPedido(contextoAgora);
