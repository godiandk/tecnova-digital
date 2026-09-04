import { Controller, Get } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Publico } from '../modules/auth/auth.guard';
import { PASTA_DO_SITE, SITE_PUBLICADO } from './pasta-do-site';

/**
 * Qual versão do site este servidor está entregando.
 *
 * O identificador é o NOME DO PACOTE que o index.html carrega — algo como
 * `AppEntry-a1072ff4f3d47fd84d2c75437db7cefa.js`. Ele já é o resumo do conteúdo de todo
 * o aplicativo: mudou uma linha de código em qualquer tela, o nome muda. Não precisa de
 * número de versão escrito à mão, que alguém esqueceria de subir.
 *
 * Lido UMA VEZ, na subida. O arquivo não muda enquanto o processo vive — uma versão
 * nova é um processo novo. Ler a cada pedido seria um acesso a disco por visita pra
 * nunca ver diferença.
 */
function lerVersao(): string {
  if (!SITE_PUBLICADO) return 'sem-site';
  try {
    const html = readFileSync(join(PASTA_DO_SITE, 'index.html'), 'utf-8');
    return html.match(/AppEntry-([0-9a-f]+)\.js/)?.[1] ?? 'desconhecida';
  } catch {
    return 'desconhecida';
  }
}

const VERSAO = lerVersao();

@Controller('versao')
export class VersaoController {
  /**
   * Pública e barata de propósito: o aplicativo consulta isto ao voltar pra tela, e uma
   * rota que exigisse login ou banco transformaria uma checagem de rotina num custo.
   */
  @Publico()
  @Get()
  agora() {
    return { versao: VERSAO };
  }
}
