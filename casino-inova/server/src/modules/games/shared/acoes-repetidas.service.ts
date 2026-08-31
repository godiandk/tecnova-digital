import { Injectable } from '@nestjs/common';

/**
 * Faz uma ação do jogador acontecer UMA VEZ SÓ, mesmo que o pedido chegue várias.
 *
 * A idempotência da carteira sozinha não basta, e isso apareceu num teste: com 20
 * pedidos do mesmo giro, o débito acontecia uma vez (o ledger recusava os outros 19),
 * mas o jogo RODAVA 20 vezes e pagava 20 prêmios. O jogador era cobrado por um giro e
 * ganhava vinte — o contrário do erro que a gente estava caçando, e igualmente quebrado.
 *
 * A regra certa é a da especificação: a AÇÃO inteira é que não pode repetir, não só o
 * lançamento financeiro. Aqui a primeira chamada roda de verdade e as outras esperam
 * por ela e recebem a mesma resposta.
 *
 * Duas coisas fazem isso funcionar sob concorrência:
 *
 * - `emVoo` guarda a Promise da execução em andamento. Vinte pedidos simultâneos
 *   encontram a mesma Promise e todos esperam nela, em vez de vinte começarem juntos.
 * - `respostas` guarda o resultado por um tempo depois, pra o pedido que chegar
 *   atrasado (o retry depois do timeout) ainda receber a resposta original.
 *
 * O que isto NÃO cobre: reinício do servidor, que esvazia a memória. Nesse caso a
 * repetição volta a cair na idempotência do ledger — o dinheiro continua protegido, e o
 * jogador recebe um erro em vez da resposta antiga. É o comportamento seguro; guardar
 * isso no banco é o passo seguinte, junto com o event log.
 */
@Injectable()
export class AcoesRepetidas {
  private readonly respostas = new Map<string, { valor: unknown; expiraEm: number }>();
  private readonly emVoo = new Map<string, Promise<unknown>>();

  /** Quanto tempo a resposta fica guardada. Cobre folgado a janela de retry de um app. */
  private static readonly VALIDADE_MS = 2 * 60 * 1000;

  /**
   * Roda `executar` uma vez por (jogador, ação). Sem `actionId`, roda sempre — quem não
   * manda chave está pedindo uma ação nova a cada chamada, e isso é decisão do cliente.
   */
  async umaVezSo<T>(userId: string, actionId: string | undefined, executar: () => Promise<T>): Promise<T> {
    if (!actionId) return executar();

    const chave = `${userId}:${actionId}`;
    this.limpar();

    const guardada = this.respostas.get(chave);
    if (guardada) return guardada.valor as T;

    const andando = this.emVoo.get(chave);
    if (andando) return andando as Promise<T>;

    const promessa = executar()
      .then((valor) => {
        this.respostas.set(chave, { valor, expiraEm: Date.now() + AcoesRepetidas.VALIDADE_MS });
        return valor;
      })
      .finally(() => {
        this.emVoo.delete(chave);
      });

    /*
     * Erro NÃO é guardado: uma aposta recusada por saldo insuficiente pode ser tentada
     * de novo depois de comprar fichas, com a mesma chave, e deve funcionar. Só sucesso
     * vira resposta definitiva.
     */
    this.emVoo.set(chave, promessa);
    return promessa;
  }

  private limpar() {
    const agora = Date.now();
    for (const [chave, item] of this.respostas) {
      if (item.expiraEm <= agora) this.respostas.delete(chave);
    }
  }
}
