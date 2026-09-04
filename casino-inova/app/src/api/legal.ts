import { apiRequest } from './client';

export interface DocumentoLegal {
  titulo: string;
  versao: string;
  /** O texto em markdown, como está no repositório. */
  texto: string;
}

/**
 * Os termos de uso e a política de privacidade, vindos do servidor.
 *
 * VÊM DE LÁ E NÃO ESTÃO ESCRITOS AQUI DENTRO por um motivo prático: corrigir uma frase
 * do documento passaria a exigir uma versão nova do aplicativo, e quem não atualizasse
 * continuaria concordando com o texto velho sem saber. Servido, o texto é um só, e a
 * versão que a pessoa aceitou fica registrada com data.
 */
export function fetchDocumento(qual: 'termos' | 'privacidade'): Promise<DocumentoLegal> {
  return apiRequest<DocumentoLegal>(`/legal/${qual}`);
}
