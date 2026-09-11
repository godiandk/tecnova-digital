import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../../../database/database.service';
import { WalletService } from '../../wallet/wallet.service';
import { degrauEconomico, niveisDisponiveis, type NivelDeMesa } from './niveis-de-mesa';

/**
 * QUEM É ESTA PESSOA, ECONOMICAMENTE — saldo, nível e o degrau que os dois liberam.
 *
 * Existe porque o degrau passou a depender de DUAS coisas. Antes bastava o saldo, e todo
 * jogo já tinha a carteira injetada: uma linha, e pronto. Agora o degrau é
 * `min(o que o saldo banca, o que o nível liberou)`, e sem um lugar só pra responder isso
 * cada um dos dez jogos precisaria injetar a carteira E os usuários, e fazer a mesma
 * composição à mão — dez cópias de uma regra de economia, que é exatamente o defeito que
 * `niveis-de-mesa.ts` veio consertar quando a regra estava copiada em seis jogos.
 *
 * POR QUE LÊ O NÍVEL DIRETO E NÃO PELO UsersService: pra não amarrar os dez jogos ao
 * módulo de usuários (que carrega credencial, papel, código público — nada disso tem a
 * ver com sentar numa mesa) e pra que a consulta seja exatamente a coluna que interessa.
 */
@Injectable()
export class DegrauDoJogador {
  constructor(
    private readonly db: DatabaseService,
    private readonly wallet: WalletService,
  ) {}

  /**
   * O saldo, o nível e o degrau econômico de quem vai apostar.
   *
   * As duas leituras vão em paralelo porque são independentes e isto está no caminho
   * quente: toda aposta de todo jogo passa por aqui, e somar dois tempos de ida e volta
   * ao banco por rodada é caro à toa.
   *
   * NÍVEL AUSENTE VIRA 1, e não "o degrau que o saldo banca". A diferença aparece no
   * único caso em que importa — uma conta que sumiu da tabela entre a autenticação e a
   * aposta —, e aí a resposta segura é a mesa mais barata, não a mais cara.
   */
  async de(userId: string): Promise<QuemAposta> {
    const [saldo, linha] = await Promise.all([
      this.wallet.balanceOf(userId),
      this.db.queryOne<{ level: number }>('SELECT level FROM users WHERE id = $1', [userId]),
    ]);
    const nivel = linha?.level ?? 1;
    return { saldo, nivel, degrau: degrauEconomico(saldo, nivel), onde: niveisDisponiveis(saldo, nivel) };
  }
}

export interface QuemAposta {
  saldo: number;
  nivel: number;
  /** O degrau econômico: `min(o que o saldo banca, o que o nível liberou)`. */
  degrau: NivelDeMesa;
  /** Onde ela pode sentar: o degrau dela e o logo abaixo. */
  onde: NivelDeMesa[];
}
