import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { RecompensasService } from './recompensas.service';
import { UsuarioAtual } from '../auth/usuario-atual.decorator';

class ColetarDto {
  /**
   * A chave que o cliente escolhe pra identificar ESTA coleta.
   *
   * Ela identifica a INTENÇÃO ("a coleta que eu pedi às 9h03"), não a linha. Dois toques
   * no botão, um retry depois de timeout, ou o mesmo pedido saindo de dois aparelhos
   * chegam com a mesma chave — e a segunda devolve o resultado da primeira em vez de um
   * erro, porque do ponto de vista de quem tocou o botão a coleta deu certo.
   *
   * Opcional: sem ela, um id é sorteado no servidor e a proteção fica sendo só a do dia,
   * que já basta pra impedir pagar duas vezes. O que se perde é a resposta amigável ao
   * retry — ele vira "você já coletou hoje".
   */
  claimId?: string;
}

@Controller('recompensas')
export class RecompensasController {
  constructor(private readonly recompensas: RecompensasService) {}

  /** O calendário desta pessoa, com o valor de cada casa do mês. */
  @Get('diaria')
  calendario(@UsuarioAtual() userId: string) {
    return this.recompensas.calendarioDe(userId);
  }

  @Post('diaria/coletar')
  coletar(@UsuarioAtual() userId: string, @Body() body: ColetarDto) {
    if (body?.claimId !== undefined && typeof body.claimId !== 'string') {
      throw new BadRequestException('claimId precisa ser texto.');
    }
    return this.recompensas.coletar(userId, undefined, body?.claimId);
  }

  /**
   * As últimas coletas, com a conta de cada uma.
   *
   * Existe porque "por que recebi 3.000?" é uma pergunta que chega no suporte, e o extrato
   * sozinho responde "entrou 3.000" — não responde por quê. Aqui está o nível da pessoa
   * naquele dia, o multiplicador da casa e o bônus, que são os três números que fizeram a
   * conta.
   */
  @Get('diaria/historico')
  historico(@UsuarioAtual() userId: string, @Query('limite') limite?: string) {
    const n = Number(limite);
    return this.recompensas.historicoDe(userId, Number.isFinite(n) && n > 0 ? n : 60);
  }
}
