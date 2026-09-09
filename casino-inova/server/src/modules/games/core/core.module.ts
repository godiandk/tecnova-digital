import { Global, Module } from '@nestjs/common';
import { RegistroDeEventos } from './registro-de-eventos';
import { ReconexaoService } from './reconexao.service';
import { RodadasRepository } from './rodadas.repository';

/**
 * O núcleo compartilhado das mesas: log de eventos em memória, janela de reconexão e a
 * rodada guardada no banco.
 *
 * Os dois logs convivem de propósito, e não por descuido. O `RegistroDeEventos` vive em
 * memória e serve à RECONEXÃO, que acontece em segundos e precisa ser barata: quem caiu
 * diz até que evento viu e recebe dali pra frente, sem tocar no banco. O
 * `RodadasRepository` grava no Postgres e serve à AUDITORIA, ao replay e ao suporte,
 * que acontecem dias depois e precisam sobreviver a um reinício.
 *
 * Global pelo mesmo motivo do SharedGamesModule: uma instância por módulo faria cada
 * jogo ter o seu log, e a reconexão de uma mesa não enxergaria os eventos dela.
 */
@Global()
@Module({
  providers: [RegistroDeEventos, ReconexaoService, RodadasRepository],
  exports: [RegistroDeEventos, ReconexaoService, RodadasRepository],
})
export class CoreDeSalasModule {}
