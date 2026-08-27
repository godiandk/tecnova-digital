import 'reflect-metadata';
import { networkInterfaces } from 'os';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

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
  const app = await NestFactory.create(AppModule);
  app.enableCors();

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
