export type Role = 'jogador' | 'moderador' | 'admin';

/**
 * Cada função é uma permissão isolada — "moderador" e "admin" são só pacotes
 * pré-montados dessas permissões, não dois blocos de poder fixos. Dá pra criar um
 * terceiro pacote (ex: "moderador sênior") só ajustando esta lista, sem mexer em
 * nenhuma rota.
 */
export type Permission =
  | 'banir_usuario'
  | 'silenciar_usuario'
  | 'ver_denuncias'
  | 'ver_carteira_usuario'
  | 'conceder_fichas_suporte'
  | 'gerenciar_cupons'
  | 'gerenciar_papeis'
  | 'ajustar_economia'
  | 'ver_analytics';

export const ALL_PERMISSIONS: Permission[] = [
  'banir_usuario',
  'silenciar_usuario',
  'ver_denuncias',
  'ver_carteira_usuario',
  'conceder_fichas_suporte',
  'gerenciar_cupons',
  'gerenciar_papeis',
  'ajustar_economia',
  'ver_analytics',
];

/**
 * O pedido original era só "moderador não pode banir" — a matriz abaixo é a resposta
 * completa a "quais cargos e funções podem ter": moderador ganha as ferramentas de
 * suporte do dia a dia (silenciar, ver denúncias, ver carteira pra investigar um
 * caso, dar um crédito pontual limitado) e nada que mexe em dinheiro na escala do
 * app inteiro (cupons, papéis de outras pessoas, economia) nem a ação irreversível
 * (banir). Admin tem tudo.
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  jogador: [],
  moderador: ['silenciar_usuario', 'ver_denuncias', 'ver_carteira_usuario', 'conceder_fichas_suporte', 'ver_analytics'],
  admin: ALL_PERMISSIONS,
};

/** Moderador só pode conceder até este tanto de fichas de suporte por ação — admin não tem teto. */
export const MODERATOR_SUPPORT_CHIPS_CAP = 5000;
