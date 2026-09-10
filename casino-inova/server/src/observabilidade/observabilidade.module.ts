/**
 * Liga o registro no ciclo de vida de todo pedido HTTP.
 *
 * São três peças, e a ordem entre elas é a razão de existirem três:
 *
 *   middleware  → abre o contexto do pedido ANTES do guard (senão o 401 some);
 *   interceptor → escreve a linha de quem deu certo, já sabendo quem é o dono;
 *   filtro      → escreve a linha de quem deu errado, inclusive o que o guard lançou.
 *
 * Global de propósito: observabilidade que precisa ser importada módulo a módulo é
 * observabilidade que vai faltar justamente no módulo que ninguém lembrou.
 */
import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { RegistroDeFalhasFilter } from './registro.filter';
import { RegistroInterceptor } from './registro.interceptor';
import { RegistroMiddleware } from './registro.middleware';

@Global()
@Module({
  providers: [
    { provide: APP_INTERCEPTOR, useClass: RegistroInterceptor },
    { provide: APP_FILTER, useClass: RegistroDeFalhasFilter },
  ],
})
export class ObservabilidadeModule implements NestModule {
  configure(consumidor: MiddlewareConsumer): void {
    consumidor.apply(RegistroMiddleware).forRoutes('*');
  }
}
