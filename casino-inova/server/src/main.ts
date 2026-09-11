import 'reflect-metadata';
import { networkInterfaces } from 'os';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UsersService } from './modules/users/users.service';
import { PASTA_DO_SITE, SITE_PUBLICADO } from './site/pasta-do-site';
import { corsDaApi, origensDoAmbiente } from './comum/origens-permitidas';

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

  /*
   * CORS COM LISTA, e não `enableCors()` sem argumento — que quer dizer QUALQUER ORIGEM.
   *
   * Num aplicativo nativo isso não mudaria nada (CORS é regra de navegador). Mas este
   * projeto também roda na web, e aí qualquer página que a pessoa abra em outra aba podia
   * fazer o navegador dela chamar esta API em nome dela. Ver `comum/origens-permitidas.ts`.
   */
  app.enableCors(corsDaApi);
  const origens = origensDoAmbiente();
  console.log(
    origens.length > 0
      ? `CORS restrito a: ${origens.join(', ')}`
      : 'CORS em modo de desenvolvimento (localhost e rede local). Defina ORIGENS_PERMITIDAS em produção.',
  );

  /*
   * CABEÇALHOS DE SEGURANÇA, escritos à mão em vez de trazer o helmet.
   *
   * São cinco linhas contra uma dependência nova, e cada uma está aqui por um motivo que
   * dá pra explicar — que é melhor do que um pacote cujo padrão ninguém leu:
   *
   *   nosniff       — impede o navegador de "adivinhar" que um JSON é HTML e executá-lo.
   *   frame-options — ninguém põe esta API dentro de um iframe pra enganar quem clica.
   *   referrer      — o endereço desta API não vaza para sites de terceiros.
   *   HSTS          — depois da primeira visita por HTTPS, o navegador recusa HTTP. Só em
   *                   produção: ligá-lo em desenvolvimento tranca `localhost` no HTTPS.
   *   CSP           — a API devolve JSON, então a política mais apertada possível serve:
   *                   nada pode ser carregado a partir do que ela responde. O site
   *                   publicado tem a sua própria, no SiteController.
   */
  app.use((_req: unknown, res: { setHeader: (n: string, v: string) => void }, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  /*
   * O CORPO TEM TETO. O padrão do Express é 100 KB, que já é pequeno, mas ele vale por
   * pedido e este servidor não recebe nada grande: a maior requisição é uma lista de
   * apostas de roleta. 64 KB é folgado para isso e estreito para quem tentar entupir a
   * memória com corpos gigantes.
   */
  app.useBodyParser('json', { limit: '64kb' });
  app.useBodyParser('urlencoded', { limit: '64kb', extended: true });

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

