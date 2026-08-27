import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Onde está o app web publicado.
 *
 * `PASTA_DO_SITE` permite apontar pra outro lugar na hospedagem; o padrão é a pasta
 * `dist` que o `npx expo export --platform web` gera dentro de app/.
 */
export const PASTA_DO_SITE = process.env.PASTA_DO_SITE ?? join(__dirname, '..', '..', '..', 'app', 'dist');

/** O site só é servido quando foi publicado; sem ele, o servidor sobe só com a API. */
export const SITE_PUBLICADO = existsSync(join(PASTA_DO_SITE, 'index.html'));
