import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { registro } from '../observabilidade/registro';

/**
 * O LIMITE DE TENTATIVAS — o que impede alguém de testar senhas a noite inteira.
 *
 * O QUE NÃO EXISTIA: nada. Nenhuma rota tinha limite de chamadas, e a de login também não.
 * Com scrypt no meio, cada tentativa custa caro ao SERVIDOR (é para isso que scrypt é
 * lento), então o mesmo laço que tenta senhas também derruba a máquina — duas portas pelo
 * preço de uma.
 *
 * O QUE ELE É: uma janela deslizante por chave, em memória. Deliberadamente simples, e as
 * limitações estão ditas aqui em vez de escondidas:
 *
 *   - É POR PROCESSO. Com duas instâncias atrás de um balanceador, o limite efetivo
 *     dobra. Para uma instância — que é o caso hoje — ele vale exatamente o que promete;
 *     para várias, o lugar certo é um contador compartilhado (Redis) ou o próprio
 *     balanceador. Está escrito para que ninguém descubra isso por acidente.
 *   - É POR IP, e IP não é pessoa: uma operadora de celular põe milhares de assinantes
 *     atrás do mesmo endereço. Por isso o limite do login é por IP **e por e-mail** ao
 *     mesmo tempo — quem ataque uma conta específica esbarra no e-mail mesmo trocando de
 *     IP, e quem varra muitas contas esbarra no IP.
 *   - A MEMÓRIA É LIMPA SOZINHA. Sem isso, um atacante trocando de IP a cada pedido faria
 *     o mapa crescer até o processo morrer — o limitador viraria a vulnerabilidade.
 */
export interface RegraDeLimite {
  /** Quantas chamadas cabem na janela. */
  quantas: number;
  /** O tamanho da janela, em segundos. */
  janelaEmSegundos: number;
  /** Além do IP, limitar por este campo do corpo (ex.: 'email'). */
  tambemPor?: string;
}

export const LIMITE = 'limite_de_tentativas';
export const Limite = (regra: RegraDeLimite) => SetMetadata(LIMITE, regra);

interface Janela {
  /** Os instantes das chamadas dentro da janela. */
  quando: number[];
}

const MAXIMO_DE_CHAVES = 50_000;

@Injectable()
export class LimiteDeTentativasGuard implements CanActivate {
  private readonly janelas = new Map<string, Janela>();
  private ultimaLimpeza = Date.now();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const regra = this.reflector.getAllAndOverride<RegraDeLimite | undefined>(LIMITE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!regra) return true;

    const req = context.switchToHttp().getRequest();
    const agora = Date.now();
    this.limparSePreciso(agora, regra.janelaEmSegundos);

    const rota = `${req.method}:${req.route?.path ?? req.url}`;
    const chaves = [`${rota}|ip:${enderecoDe(req)}`];
    if (regra.tambemPor) {
      const valor = req.body?.[regra.tambemPor];
      if (typeof valor === 'string' && valor) {
        chaves.push(`${rota}|${regra.tambemPor}:${valor.toLowerCase()}`);
      }
    }

    for (const chave of chaves) {
      if (this.estourou(chave, agora, regra)) {
        /*
         * O REGISTRO NÃO GUARDA A CHAVE, só a rota e quantas tentativas. A chave contém
         * e-mail e IP — os dois são dado pessoal, e o registro deste projeto esconde os
         * dois por formato (ver `observabilidade/registro.ts`). Registrar a chave inteira
         * seria contornar a própria regra.
         */
        registro.aviso('limite', 'tentativas-demais', { rota, quantas: regra.quantas, janela: regra.janelaEmSegundos });
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: `Tentativas demais. Espere ${regra.janelaEmSegundos} segundos e tente de novo.`,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    for (const chave of chaves) this.registrar(chave, agora, regra);
    return true;
  }

  private estourou(chave: string, agora: number, regra: RegraDeLimite): boolean {
    const janela = this.janelas.get(chave);
    if (!janela) return false;
    const corte = agora - regra.janelaEmSegundos * 1000;
    janela.quando = janela.quando.filter((t) => t > corte);
    return janela.quando.length >= regra.quantas;
  }

  private registrar(chave: string, agora: number, regra: RegraDeLimite): void {
    const janela = this.janelas.get(chave) ?? { quando: [] };
    const corte = agora - regra.janelaEmSegundos * 1000;
    janela.quando = [...janela.quando.filter((t) => t > corte), agora];
    this.janelas.set(chave, janela);
  }

  /**
   * Joga fora o que já não conta.
   *
   * SEM ISTO, O LIMITADOR SERIA A VULNERABILIDADE: quem trocasse de IP a cada pedido
   * criaria uma chave nova toda vez, e o mapa cresceria até o processo morrer. O teto de
   * chaves é a segunda tranca, para o caso de a limpeza não dar conta.
   */
  private limparSePreciso(agora: number, janelaEmSegundos: number): void {
    if (agora - this.ultimaLimpeza < 60_000 && this.janelas.size < MAXIMO_DE_CHAVES) return;
    this.ultimaLimpeza = agora;
    const corte = agora - janelaEmSegundos * 1000;
    for (const [chave, janela] of this.janelas) {
      const vivas = janela.quando.filter((t) => t > corte);
      if (vivas.length === 0) this.janelas.delete(chave);
      else janela.quando = vivas;
    }
    /* Se ainda assim estourou o teto, esvazia: perder o limite é melhor que perder o processo. */
    if (this.janelas.size >= MAXIMO_DE_CHAVES) this.janelas.clear();
  }
}

/**
 * O endereço de quem chamou.
 *
 * `x-forwarded-for` só é lido quando `CONFIAR_NO_PROXY=true`, e isso é decisão consciente:
 * o cabeçalho é escrito pelo cliente e pode ser inventado. Confiar nele sem um proxy na
 * frente deixa qualquer um trocar de "IP" a cada pedido e passar por cima do limite. Com
 * um proxy de verdade na frente (que reescreve o cabeçalho), ele é o único jeito de saber
 * quem é — e aí a variável liga.
 */
function enderecoDe(req: { headers?: Record<string, unknown>; ip?: string; socket?: { remoteAddress?: string } }): string {
  if (process.env.CONFIAR_NO_PROXY === 'true') {
    const encaminhado = req.headers?.['x-forwarded-for'];
    const primeiro = Array.isArray(encaminhado) ? encaminhado[0] : String(encaminhado ?? '').split(',')[0];
    if (primeiro?.trim()) return primeiro.trim();
  }
  return req.ip ?? req.socket?.remoteAddress ?? 'desconhecido';
}
