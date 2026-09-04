/**
 * A ARTE DE CADA TELA — o que estava pronto na pasta e não chegava à tela.
 *
 * Uma auditoria cruzando os 311 arquivos de arte com o que o código realmente carrega
 * achou 64 que nunca apareciam: 31 sem nenhum `require` e 33 dentro de constantes que
 * ninguém importava. Uma parte era fonte (folhas de contato, de onde as peças são
 * cortadas) e é normal ficar de fora. O resto era arte de tela acabada, encostada.
 *
 * Este arquivo é onde essa arte passa a existir pro código. O Metro exige `require`
 * com caminho estático, então o mapa é escrito à mão.
 */

/** O fundo de cada tela. Cada uma tem o seu; não é a mesma foto repetida. */
export const FUNDOS = {
  entrada: require('../../assets/images/backgrounds/login-fundo.jpg'),
  salao: require('../../assets/images/backgrounds/lobby-fundo.jpg'),
  loja: require('../../assets/images/backgrounds/loja-fundo.jpg'),
  torneios: require('../../assets/images/backgrounds/torneios-fundo.jpg'),
} as const;

/** A marca. */
export const MARCA = {
  logo: require('../../assets/images/branding/logo-principal-oficial.png'),
  logoMono: require('../../assets/images/branding/logo-mono.png'),
} as const;

/**
 * As molduras de avatar, uma por nível do clube.
 *
 * Os nomes batem com `vipTier` em usePlayer.ts — bronze, prata, ouro e diamante — e
 * não por acaso: a arte foi feita com quatro anéis, e o app tem quatro níveis.
 */
export const MOLDURAS_DE_AVATAR = {
  bronze: require('../../assets/images/perfil/molduras/bronze.png'),
  prata: require('../../assets/images/perfil/molduras/prata.png'),
  ouro: require('../../assets/images/perfil/molduras/ouro.png'),
  diamante: require('../../assets/images/perfil/molduras/diamante.png'),
} as const;

/** Os seis retratos que vêm com o app, cortados da folha `avatares-padrao.jpg`. */
export const AVATARES_PADRAO = [
  require('../../assets/images/perfil/avatares/1.jpg'),
  require('../../assets/images/perfil/avatares/2.jpg'),
  require('../../assets/images/perfil/avatares/3.jpg'),
  require('../../assets/images/perfil/avatares/4.jpg'),
  require('../../assets/images/perfil/avatares/5.jpg'),
  require('../../assets/images/perfil/avatares/6.jpg'),
];

/**
 * O retrato que a pessoa ESCOLHEU, pelo nome que o servidor guarda.
 *
 * Os nomes são `avatar-1` a `avatar-6` e a ordem bate com a lista acima. Se um dia
 * chegar um nome que esta versão do aplicativo não conhece — conta criada numa versão
 * mais nova, aplicativo antigo na mão — cai no retrato de sempre em vez de deixar o
 * perfil sem rosto.
 */
export function avatarEscolhido(nome: string | null | undefined, id?: string) {
  if (!nome) return avatarPadraoDe(id);
  const posicao = Number(String(nome).replace('avatar-', ''));
  const indice = Number.isInteger(posicao) ? posicao - 1 : -1;
  return AVATARES_PADRAO[indice] ?? avatarPadraoDe(id);
}

export const SELO_VIP = require('../../assets/images/perfil/selo-vip.png');

/** Pódio e troféus do ranking. */
export const TROFEUS = {
  ranking: require('../../assets/images/trofeus/trofeus-ranking.jpg'),
  podio: require('../../assets/images/trofeus/podio-3d.jpg'),
} as const;

/**
 * Qual retrato uma pessoa recebe, quando ela ainda não escolheu.
 *
 * Sai do identificador, não de sorteio: assim o rosto é sempre o mesmo pra quem entra,
 * sessão após sessão, em vez de trocar a cada abertura do app. Sem identificador
 * (visitante) cai no primeiro — não inventamos identidade pra quem não tem.
 */
export function avatarPadraoDe(id: string | undefined) {
  if (!id) return AVATARES_PADRAO[0];
  let soma = 0;
  for (let i = 0; i < id.length; i += 1) soma = (soma * 31 + id.charCodeAt(i)) >>> 0;
  return AVATARES_PADRAO[soma % AVATARES_PADRAO.length];
}
