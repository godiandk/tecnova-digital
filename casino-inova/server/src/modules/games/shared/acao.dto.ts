/**
 * Base de todo pedido que mexe em fichas.
 *
 * `actionId` identifica a INTENÇÃO do jogador, não a requisição. O app gera um id novo
 * quando a pessoa toca em apostar, e reusa o MESMO id se precisar tentar de novo — num
 * timeout de rede, por exemplo, em que a requisição chegou no servidor e só a resposta
 * se perdeu. O servidor então reconhece que é a mesma aposta e devolve o resultado que
 * já tinha, em vez de debitar de novo.
 *
 * É opcional de propósito: nenhum cliente antigo quebra por não mandar. Mas sem ele o
 * servidor não tem como distinguir "apostou duas vezes" de "a mesma aposta chegou duas
 * vezes", e vai debitar as duas — que é o comportamento que existia antes disto.
 */
export class AcaoDto {
  actionId?: string;
}
