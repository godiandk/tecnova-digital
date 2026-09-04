import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { BancaFrancesaService } from './banca-francesa.service';
import { BancaFrancesaBet } from './banca-francesa.engine';
import { UsuarioAtual } from '../../auth/usuario-atual.decorator';
import { Publico } from '../../auth/auth.guard';
import { AcaoDto } from '../shared/acao.dto';

class ApostarDto {
  bets!: BancaFrancesaBet[];
}

/**
 * A mesa de um jogador só.
 *
 * QUATRO ROTAS, e a separação é a regra: apostar não lança, lançar não aposta. Antes
 * era uma rota só (`/apostar`) que confirmava, relançava sozinha até decidir e pagava —
 * o jogador tocava uma vez e recebia o fim da história. Com o nulo devolvido a quem
 * aposta, cada passo virou uma ação de verdade.
 */
@Controller('games/banca-francesa')
export class BancaFrancesaController {
  constructor(private readonly bancaFrancesaService: BancaFrancesaService) {}

  /** O placar DESTA mesa: dados, somas e nulos. Não é o do bacará. */
  @Publico()
  @Get('placar')
  getPlacar() {
    return this.bancaFrancesaService.getPlacar();
  }

  @Publico()
  @Get('config')
  getConfig() {
    return this.bancaFrancesaService.getConfig();
  }

  /**
   * O estado autoritativo da rodada deste jogador.
   *
   * É o que a tela pede ao abrir e ao reconectar. Nenhuma decisão do cliente sobrevive
   * a uma recarga: o que vale é o que o servidor responde aqui.
   */
  @Get('rodada')
  rodada(@UsuarioAtual() usuarioLogado: string) {
    return this.bancaFrancesaService.rodadaParaOCliente(usuarioLogado);
  }

  /** Confirma as apostas. Não cobra nada — ficha só sai do saldo quando o dado decide. */
  @Post('apostar')
  apostar(@UsuarioAtual() usuarioLogado: string, @Body() body: ApostarDto) {
    if (!Array.isArray(body?.bets)) {
      throw new BadRequestException('Informe bets: a lista de apostas.');
    }
    return this.bancaFrancesaService.apostar(usuarioLogado, body.bets);
  }

  /** Tira as fichas da mesa. De graça: nada foi cobrado ainda. */
  @Post('retirar')
  retirar(@UsuarioAtual() usuarioLogado: string) {
    return this.bancaFrancesaService.retirar(usuarioLogado);
  }

  /** UM lançamento. Nulo não cobra nada e devolve a mesa pro jogador. */
  @Post('lancar')
  lancar(@UsuarioAtual() usuarioLogado: string, @Body() body: AcaoDto) {
    return this.bancaFrancesaService.lancar(usuarioLogado, body?.actionId);
  }
}
