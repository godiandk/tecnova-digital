/**
 * ABRE O CONTEXTO DO PEDIDO ANTES DE TUDO.
 *
 * POR QUE MIDDLEWARE E NÃO INTERCEPTOR. A primeira versão disto era só um interceptor, e
 * ele funcionava — para os pedidos que davam certo. As recusas de login sumiam: no Nest, o
 * GUARD roda ANTES do interceptor, então um 401 do `AuthGuard` era lançado num ponto em
 * que o interceptor ainda nem tinha começado. Resultado: cem tentativas com token
 * inválido não deixavam UMA linha.
 *
 * Justamente as que mais importam. Token recusado em série é a assinatura de alguém
 * tentando entrar numa conta que não é dele, e era exatamente isso que ficava invisível.
 *
 * Middleware roda antes do guard. Abrindo o contexto aqui, tudo o que vier depois — guard,
 * interceptor, serviço, filtro de exceção — cai dentro do mesmo pedido.
 */
import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { comContexto } from './contexto-do-pedido';

/** Onde o relógio do pedido começou, pra o `ms` sair certo em quem for escrever a linha. */
export const COMECOU_EM = Symbol('comecouEm');

@Injectable()
export class RegistroMiddleware implements NestMiddleware {
  use(pedido: Request, resposta: Response, seguir: NextFunction): void {
    const numeroDoPedido = randomUUID().slice(0, 8);
    /*
     * Vai de volta no cabeçalho. É o que transforma uma reclamação em busca: a pessoa
     * manda o print, o número está nele, e a linha se acha.
     */
    resposta.setHeader('X-Pedido', numeroDoPedido);
    (pedido as unknown as Record<symbol, number>)[COMECOU_EM] = Date.now();

    comContexto({ pedido: numeroDoPedido }, () => seguir());
  }
}
