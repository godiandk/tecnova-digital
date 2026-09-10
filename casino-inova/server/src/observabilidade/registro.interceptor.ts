/**
 * UMA LINHA POR REQUISIÇÃO QUE DEU CERTO.
 *
 * As que dão errado saem no `registro.filter.ts`, que enxerga também o que o guard lança
 * — e o guard roda antes daqui. O número do pedido e o relógio vêm do
 * `registro.middleware.ts`, que abre o contexto antes de tudo.
 *
 * POR QUE UMA LINHA E NÃO DUAS. A tentação é escrever "começou" e "terminou". Dobra o
 * volume e não acrescenta quase nada: o que interessa — deu certo, demorou quanto, de quem
 * era — só se sabe no fim. Pedido que nunca termina aparece do mesmo jeito: pela ausência.
 */
import {
  CallHandler, ExecutionContext, Injectable, NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

import { acrescentarAoContexto, contextoAgora } from './contexto-do-pedido';
import { registro } from './registro';
import { COMECOU_EM } from './registro.middleware';

/** Rotas que não merecem uma linha cada quando dão certo: ruído puro, e são as mais chamadas. */
const CALADAS = [/^\/health$/, /^\/lobby\/estado$/, /\.(js|css|png|jpg|svg|woff2?|ico|map)$/];

@Injectable()
export class RegistroInterceptor implements NestInterceptor {
  intercept(contexto: ExecutionContext, seguir: CallHandler): Observable<unknown> {
    if (contexto.getType() !== 'http') return seguir.handle();

    const http = contexto.switchToHttp();
    const pedido = http.getRequest();
    const resposta = http.getResponse();
    const caminho: string = String(pedido.originalUrl ?? pedido.url ?? '').split('?')[0];

    /*
     * Quem é o dono do pedido só se sabe DEPOIS do guard — é ele que pendura `req.user`.
     * Por isso o usuário entra aqui e não no middleware. Vai o id e só o id: e-mail é dado
     * pessoal, e o registro não é lugar de dado pessoal.
     */
    const quem = pedido.user?.id ?? pedido.user?.sub;
    if (quem) acrescentarAoContexto({ usuario: quem });

    const comecou = (pedido as Record<symbol, number>)[COMECOU_EM] ?? Date.now();

    return seguir.handle().pipe(
      tap(() => {
        if (CALADAS.some((r) => r.test(caminho))) return;
        const { jogo, rodada } = contextoAgora();
        registro.info('http', `${pedido.method} ${caminho}`, {
          status: resposta?.statusCode,
          ms: Date.now() - comecou,
          ...(jogo ? { jogo } : {}),
          ...(rodada ? { rodada } : {}),
        });
      }),
    );
  }
}
