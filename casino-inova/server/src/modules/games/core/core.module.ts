import { Global, Module } from '@nestjs/common';
import { RegistroDeEventos } from './registro-de-eventos';
import { ReconexaoService } from './reconexao.service';

/**
 * O núcleo compartilhado das mesas: log de eventos e janela de reconexão.
 *
 * Global pelo mesmo motivo do SharedGamesModule: uma instância por módulo faria cada
 * jogo ter o seu log, e a reconexão de uma mesa não enxergaria os eventos dela.
 */
@Global()
@Module({
  providers: [RegistroDeEventos, ReconexaoService],
  exports: [RegistroDeEventos, ReconexaoService],
})
export class CoreDeSalasModule {}
