/**
 * TODA FALHA VIRA LINHA — inclusive as que o guard lança.
 *
 * Um filtro de exceção global vê o que o interceptor não vê: o 401 do `AuthGuard`, o 403
 * do papel errado, o 400 da validação. São as linhas mais importantes do registro e eram
 * exatamente as que faltavam.
 *
 * Ele NÃO muda a resposta. O corpo do erro continua saindo como o Nest manda; este filtro
 * só escreve e devolve. Registro que altera comportamento é armadilha.
 */
import {
  ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

import { contextoAgora } from './contexto-do-pedido';
import { registro } from './registro';
import { COMECOU_EM } from './registro.middleware';

@Catch()
export class RegistroDeFalhasFilter extends BaseExceptionFilter implements ExceptionFilter {
  catch(erro: unknown, host: ArgumentsHost): void {
    if (host.getType() === 'http') {
      const http = host.switchToHttp();
      const pedido = http.getRequest();
      const status = erro instanceof HttpException
        ? erro.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
      const comecou = (pedido as unknown as Record<symbol, number>)[COMECOU_EM];
      const { jogo, rodada } = contextoAgora();

      /*
       * 5xx é `erro` — é nosso. 4xx é `aviso` — é do pedido: token vencido, saldo
       * insuficiente, aposta fora da mesa. Separados porque a primeira lista tem que
       * ficar vazia e a segunda nunca fica.
       */
      registro[status >= 500 ? 'erro' : 'aviso'](
        'http',
        `${pedido?.method} ${String(pedido?.originalUrl ?? pedido?.url ?? '').split('?')[0]}`,
        {
          status,
          ...(comecou ? { ms: Date.now() - comecou } : {}),
          ...(jogo ? { jogo } : {}),
          ...(rodada ? { rodada } : {}),
          falha: erro,
        },
      );
    }
    super.catch(erro, host);
  }
}
