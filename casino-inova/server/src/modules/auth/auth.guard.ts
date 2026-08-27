import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';

export const ROTA_PUBLICA = 'rota_publica';

/**
 * Marca uma rota como aberta (login, cadastro, listas de configuração de jogo).
 * Tudo que NÃO tiver isso exige token — o padrão é fechado, porque esquecer de proteger
 * uma rota nova é bem mais fácil (e mais caro) do que esquecer de abrir uma.
 */
export const Publico = () => SetMetadata(ROTA_PUBLICA, true);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Só protege HTTP; o WebSocket tem o seu próprio caminho, no `identificar`.
    if (context.getType() !== 'http') return true;

    const publico = this.reflector.getAllAndOverride<boolean>(ROTA_PUBLICA, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (publico) return true;

    const req = context.switchToHttp().getRequest();
    const cabecalho: string | undefined = req.headers?.authorization;
    const token = cabecalho?.replace(/^Bearer\s+/i, '');
    if (!token) {
      throw new UnauthorizedException('Faça login para continuar.');
    }

    // Guarda o userId na requisição — daqui pra frente é ele que manda, nunca o corpo.
    req.userId = this.auth.verificarToken(token);
    return true;
  }
}
