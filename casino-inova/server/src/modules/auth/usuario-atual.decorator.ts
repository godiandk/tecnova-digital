import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * O userId de quem está fazendo a requisição, tirado do token pelo AuthGuard.
 *
 * É o que substitui o `body.userId` que viajava solto: antes, mandar `{"userId":"u1"}`
 * era o suficiente pra agir como o u1: sem senha, sem nada. Agora o id vem do token
 * assinado e o corpo não tem voz nenhuma sobre quem você é.
 */
export const UsuarioAtual = createParamDecorator((_dado: unknown, contexto: ExecutionContext): string => {
  return contexto.switchToHttp().getRequest().userId;
});
