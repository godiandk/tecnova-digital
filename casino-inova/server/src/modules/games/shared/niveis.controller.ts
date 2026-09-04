import { Controller, Get } from '@nestjs/common';
import { UsuarioAtual } from '../../auth/usuario-atual.decorator';
import { WalletService } from '../../wallet/wallet.service';
import { MESAS_DE_ENTRADA, NIVEIS_DE_MESA, nivelPara, niveisDisponiveis } from './niveis-de-mesa';

/**
 * Em que nível de mesa esta pessoa joga, e quanto ela pode apostar.
 *
 * ISTO PRECISOU EXISTIR porque a escada de níveis estava construída e conferida, e
 * nenhum jogo lia ela. Os limites continuavam sendo dois números fixos no código da
 * banca francesa — mínimo 50, máximo 5.000 — pra todo mundo, do que acabou de criar a
 * conta a quem tem cem milhões. Quem tinha cem milhões apostava no máximo cinco mil,
 * 0,005% da banca: uma aposta que não mexe em nada.
 *
 * A RESPOSTA VEM DO SERVIDOR, e não é o aplicativo que calcula, por dois motivos.
 * Primeiro, o saldo mora aqui: o aplicativo mostra um número que pode estar velho, e
 * limite calculado em cima de saldo velho aceita aposta que o servidor vai recusar.
 * Segundo, o limite É REGRA — e regra que o cliente calcula é regra que o cliente muda.
 */
@Controller('niveis')
export class NiveisController {
  constructor(private readonly wallet: WalletService) {}

  @Get('meu')
  async meuNivel(@UsuarioAtual() userId: string) {
    const saldo = await this.wallet.balanceOf(userId);
    const meu = nivelPara(saldo);
    const disponiveis = niveisDisponiveis(saldo);

    return {
      saldo,
      nivel: meu,
      /** O nível dele e o degrau abaixo — onde ele pode sentar. */
      disponiveis,
      /** As mesas entre jogadores (truco, dominó, pôquer) que ele alcança. */
      mesasDeEntrada: MESAS_DE_ENTRADA.filter((mesa) =>
        disponiveis.some((nivel) => nivel.id === mesa.nivel),
      ),
    };
  }

  /** A escada inteira, pra a tela poder mostrar o que vem depois. Não depende de quem pede. */
  @Get('escada')
  escada() {
    return NIVEIS_DE_MESA;
  }
}
