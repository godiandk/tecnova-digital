import 'reflect-metadata';
import { networkInterfaces } from 'os';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UsersService } from './modules/users/users.service';
import { PASTA_DO_SITE, SITE_PUBLICADO } from './site/pasta-do-site';

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

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors();

  /*
   * Os arquivos do site, com cache agressivo — e isso é seguro justamente porque os
   * nomes carregam o resumo do conteúdo (AppEntry-a1072ff.js). Nome novo a cada versão
   * significa que guardar por um ano nunca serve um arquivo velho: o pedido é por outro
   * nome. Quem manda na atualização é o index.html, que vai com `no-store` no
   * SiteController.
   */
  if (SITE_PUBLICADO) {
    app.useStaticAssets(PASTA_DO_SITE, {
      index: false,
      setHeaders: (res, caminho) => {
        const temResumoNoNome = /-[0-9a-f]{8,}\.[a-z0-9]+$/i.test(caminho);
        res.setHeader(
          'Cache-Control',
          temResumoNoNome ? 'public, max-age=31536000, immutable' : 'no-cache',
        );
      },
    });
  }

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

  /*
   * Quem está na lista de donos vira admin agora, e não só no próximo login. Uma conta
   * já existente e já logada nunca passa de novo pelo login — sem isto, o painel só
   * apareceria pra quem saísse e entrasse outra vez.
   */
  const promovidos = await app.get(UsersService).promoverDonos();
  if (promovidos > 0) console.log(`${promovidos} conta(s) de dono promovida(s) a admin.`);

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

