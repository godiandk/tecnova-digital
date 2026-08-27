import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';

/** Global porque praticamente todo módulo precisa do banco — evita repetir o import. */
@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
