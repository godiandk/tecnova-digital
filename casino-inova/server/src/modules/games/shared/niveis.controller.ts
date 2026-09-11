import { Controller, Get } from '@nestjs/common';
import { UsuarioAtual } from '../../auth/usuario-atual.decorator';
import { DegrauDoJogador } from './degrau-do-jogador.service';
import { MESAS_DE_ENTRADA, NIVEIS_DE_MESA, NIVEL_PARA_ABRIR_O_DEGRAU, nivelPara } from './niveis-de-mesa';

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
  constructor(private readonly degraus: DegrauDoJogador) {}

  @Get('meu')
  async meuNivel(@UsuarioAtual() userId: string) {
    const quem = await this.degraus.de(userId);

    /*
     * O DEGRAU QUE O SALDO BANCARIA, mandado junto e separado do degrau de verdade.
     *
     * Quando os dois são diferentes é porque o NÍVEL está segurando: a pessoa tem fichas
     * pra uma mesa que ela ainda não abriu. Isso precisa aparecer na tela com o número —
     * "seu saldo alcança a mesa Ouro; ela abre no nível 50" —, e não sumir. Uma mesa que
     * não abre sem explicação é a diferença entre uma regra e um defeito, e quem comprou
     * fichas é justamente quem vai perguntar.
     */
    const peloSaldo = nivelPara(quem.saldo);
    const travadoPeloNivel = peloSaldo.id !== quem.degrau.id;

    return {
      saldo: quem.saldo,
      level: quem.nivel,
      /** O degrau econômico: `min(o que o saldo banca, o que o nível liberou)`. */
      nivel: quem.degrau,
      /** O degrau dele e o logo abaixo — onde ele pode sentar. */
      disponiveis: quem.onde,
      /** As mesas entre jogadores (truco, dominó, pôquer) que ele alcança. */
      mesasDeEntrada: MESAS_DE_ENTRADA.filter((mesa) =>
        quem.onde.some((nivel) => nivel.id === mesa.nivel),
      ),
      /** O nível está segurando uma mesa que o saldo já bancaria? */
      travadoPeloNivel,
      /** Qual mesa, e em que nível ela abre. Nulo quando nada está travado. */
      proximaPorNivel: travadoPeloNivel
        ? {
            nivel: peloSaldo,
            abreNoLevel: NIVEL_PARA_ABRIR_O_DEGRAU[NIVEIS_DE_MESA.indexOf(peloSaldo)] ?? null,
          }
        : null,
    };
  }

  /**
   * A escada inteira, com o nível em que cada degrau abre. Não depende de quem pede.
   *
   * O nível de abertura vai JUNTO porque a tela precisa mostrar o caminho inteiro, e não
   * só o degrau atual: sem ele, a escada é uma lista de mesas caras sem nenhuma pista de
   * como se chega lá.
   */
  @Get('escada')
  escada() {
    return NIVEIS_DE_MESA.map((nivel, i) => ({
      ...nivel,
      abreNoLevel: NIVEL_PARA_ABRIR_O_DEGRAU[i] ?? null,
    }));
  }
}
