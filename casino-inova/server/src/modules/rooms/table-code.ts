import { umDe } from '../games/shared/rng';

/** Sem 0/O/1/I — são os que mais gente confunde ao digitar um código de convite. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * O código de convite de uma mesa privada.
 *
 * Usa sorteio seguro por um motivo concreto: este código é a única coisa que protege a
 * mesa. São 32^6 combinações (mais de 1 bilhão), o que só vale alguma coisa se elas
 * forem imprevisíveis — com um gerador de estado reconstruível, ver alguns códigos
 * bastaria pra prever os próximos e entrar em mesa de gente que não te convidou.
 */
export function generateTableCode(): string {
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += umDe(CODE_ALPHABET.split(''));
  }
  return code;
}
