import 'reflect-metadata';
import { networkInterfaces } from 'os';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UsersService } from './modules/users/users.service';

/** IP da máquina na rede local — é por ele que o celular enxerga o servidor. */
function localNetworkAddress(): string | null {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) {
        return address.address;
      }
    }
  }
  return null;
}

async function bootstrap() {
  // Falha na subida, não no primeiro login: sem segredo não existe token confiável.
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET não está definida — o servidor não sobe sem ela.');
  }

  const app = await NestFactory.create(AppModule);
  app.enableCors();

  /*
   * `init()` explícito antes da semente: é ele que dispara o onModuleInit do
   * DatabaseService, que aplica o esquema. Sem isso a semente tentava inserir numa
   * tabela que ainda não existia. `listen()` chamaria init() de qualquer jeito, mas
   * tarde demais pro que vem aqui embaixo — e init() é idempotente, então chamar
   * agora não custa nada.
   */
  await app.init();

  // Contas de teste, só quando a base está vazia. Depois disso o banco manda.
  await app.get(UsersService).seedIfEmpty();

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  // '0.0.0.0' em vez do padrão: aceita conexão de outros aparelhos da rede, que é o
  // que permite testar no celular de verdade e não só no simulador.
  await app.listen(port, '0.0.0.0');

  const lan = localNetworkAddress();
  // eslint-disable-next-line no-console
  console.log(`Casino Inova API rodando em http://localhost:${port}`);
  if (lan) {
    // eslint-disable-next-line no-console
    console.log(`Na rede local (é este que o celular usa): http://${lan}:${port}`);
  }
}

bootstrap();
