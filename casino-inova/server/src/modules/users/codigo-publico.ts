import { randomInt } from 'node:crypto';

/**
 * O número que a pessoa vê no perfil e diz pro suporte.
 *
 * O id de verdade é `u-` seguido de nove bytes em base64url — algo como
 * `u-DIh-nVTLxIEX`. Serve pro banco e não serve pra mais nada humano: ninguém lê isso
 * em voz alta, ninguém digita sem errar, e diferenciar `l` de `I` numa tela de celular
 * é um convite pro suporte creditar a conta errada.
 *
 * Então: OITO DÍGITOS, e só dígitos. Mostrados como 0000-0000, porque número em grupos
 * de quatro é o formato que todo mundo já sabe copiar — é o do cartão e o do telefone.
 * Sem letra nenhuma, não existe confusão entre O e 0, entre 1 e l, entre S e 5.
 *
 * Cem milhões de combinações. Não é segredo e não protege nada — quem sabe o seu código
 * não consegue fazer nada com ele; é um jeito de te achar, como número de mesa. O que
 * autoriza continua sendo o token.
 */
export function gerarCodigoPublico(): string {
  return String(randomInt(0, 100_000_000)).padStart(8, '0');
}

/** 12345678 -> "1234-5678". A tela mostra assim; o banco guarda só os dígitos. */
export function formatarCodigo(codigo: string): string {
  const limpo = somenteDigitos(codigo);
  return limpo.length === 8 ? `${limpo.slice(0, 4)}-${limpo.slice(4)}` : codigo;
}

/** Aceita "1234-5678", "1234 5678" ou "12345678" — quem digita não devia se preocupar com o traço. */
export function somenteDigitos(valor: string): string {
  return (valor ?? '').replace(/\D/g, '');
}
