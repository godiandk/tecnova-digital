/**
 * Os retratos que dá pra escolher, por nome.
 *
 * SÃO NOMES, e não imagens enviadas pelo jogador. Deixar mandar foto significaria três
 * problemas que esta lista não tem: guardar arquivo (custo e backup), servir arquivo
 * (banda e cache) e MODERAR arquivo — porque no dia em que alguém subir uma foto que
 * não pode aparecer numa mesa com outras pessoas, alguém vai ter que tirar, e esse
 * alguém não existe neste projeto.
 *
 * A arte já está dentro do aplicativo (ver `AVATARES_PADRAO` em `data/artePorTela.ts`).
 * O servidor guarda só qual deles, e é ele quem diz quais existem: se a lista morasse
 * só no aplicativo, uma versão antiga poderia gravar um nome que a nova não desenha, e
 * a pessoa ficaria com um perfil sem rosto sem ter feito nada.
 */
export const AVATARES = [
  'avatar-1',
  'avatar-2',
  'avatar-3',
  'avatar-4',
  'avatar-5',
  'avatar-6',
];

export type Avatar = (typeof AVATARES)[number];

/** Existe? Escrito como função pra o `includes` aceitar uma string qualquer da rede. */
export function avatarExiste(nome: string): nome is Avatar {
  return (AVATARES as string[]).includes(nome);
}
