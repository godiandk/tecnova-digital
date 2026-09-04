import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { readFileSync } from 'fs';
import { existsSync } from 'fs';
import { join } from 'path';
import { Publico } from '../auth/auth.guard';
import { VERSAO_DOS_TERMOS } from './termos';

/**
 * Os termos de uso e a política de privacidade, servidos do próprio texto do projeto.
 *
 * O TEXTO MORA EM `docs/` E NÃO AQUI DENTRO, de propósito. Documento jurídico que vive
 * escondido dentro de uma constante de TypeScript é documento que ninguém revisa: não dá
 * pra ler no GitHub, não dá pra mandar por e-mail, não dá pra abrir num editor. Em
 * markdown, ele é lido por qualquer pessoa e a mudança aparece no diff em linguagem, não
 * em código.
 *
 * O Dockerfile copia a pasta pra dentro da imagem — é uma linha, e em troca existe UM
 * texto só, o mesmo que o aplicativo mostra e o mesmo que está no repositório. Duas
 * cópias divergiriam no primeiro ajuste.
 */
const PASTAS_POSSIVEIS = [
  process.env.PASTA_DOS_DOCUMENTOS,
  join(__dirname, '..', '..', '..', 'documentos'),
  join(__dirname, '..', '..', '..', '..', 'docs'),
].filter(Boolean) as string[];

const ARQUIVOS: Record<string, { arquivo: string; titulo: string }> = {
  termos: { arquivo: 'termos-de-uso.md', titulo: 'Termos de Uso' },
  privacidade: { arquivo: 'politica-de-privacidade.md', titulo: 'Política de Privacidade' },
};

function ler(arquivo: string): string | null {
  for (const pasta of PASTAS_POSSIVEIS) {
    const caminho = join(pasta, arquivo);
    if (existsSync(caminho)) return readFileSync(caminho, 'utf-8');
  }
  return null;
}

@Controller('legal')
export class LegalController {
  /**
   * Pública porque precisa ser lida ANTES de existir conta: a caixinha de aceite está na
   * tela de cadastro, e um documento que só abre depois de entrar não pode ser condição
   * pra entrar.
   */
  @Publico()
  @Get(':documento')
  documento(@Param('documento') documento: string) {
    const alvo = ARQUIVOS[documento];
    if (!alvo) throw new NotFoundException('Documento não encontrado.');

    const texto = ler(alvo.arquivo);
    if (!texto) throw new NotFoundException('Documento não encontrado.');

    return { titulo: alvo.titulo, versao: VERSAO_DOS_TERMOS, texto };
  }
}
