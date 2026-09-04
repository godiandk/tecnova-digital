/**
 * Quem é dono do jogo, por e-mail.
 *
 * Vira admin ao entrar. Existe porque `assignRole` se recusa a promover alguém a admin
 * de propósito — se a API pudesse fazer isso, um moderador poderia se promover, e a
 * separação entre moderador e admin não valeria nada. Então a promoção a admin acontece
 * fora da API, e este é o "fora da API": uma lista de donos, conferida no login.
 *
 * A LISTA VEM DO AMBIENTE, com um padrão escrito aqui. O padrão existe pra a coisa
 * funcionar na hospedagem sem ninguém precisar mexer em variável de ambiente pelo
 * celular; a variável existe pra trocar o dono sem precisar de um deploy, e pra quem
 * for rodar isto em outro lugar não herdar o dono deste projeto.
 *
 *   EMAILS_DE_ADMIN="alguem@exemplo.com,outro@exemplo.com"
 *
 * O que isto NÃO é: um jeito de entrar. Ter o e-mail na lista não cria conta nem pula
 * senha nenhuma — a pessoa entra normalmente, com a senha dela, e o papel é ajustado
 * depois de a identidade já estar provada.
 */
const DONO_PADRAO = 'wly.vianna@gmail.com';

export function emailsDeAdmin(): string[] {
  const doAmbiente = process.env.EMAILS_DE_ADMIN;
  const bruto = doAmbiente && doAmbiente.trim() ? doAmbiente : DONO_PADRAO;
  return bruto
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function ehEmailDeAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return emailsDeAdmin().includes(email.trim().toLowerCase());
}
