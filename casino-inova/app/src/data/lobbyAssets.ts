/**
 * Imagens do lobby: os cartazes de cada jogo, os cartazes de variante/modo e as peças
 * de interface (moldura de fichas, barra de nível, selos, ícones).
 *
 * O Metro exige `require` com caminho estático, então tudo aqui é escrito literal —
 * mesma regra dos outros mapas de imagem do projeto.
 *
 * Um detalhe importante sobre os cartazes: eles já vêm com moldura dourada e o
 * emblema da marca desenhados na própria arte. Por isso `moldura-cartaz.png` e
 * `moldura-cartaz-destaque.png` vieram no pacote mas NÃO são usados — sobrepor uma
 * segunda moldura em cima da que já existe deixa a borda dobrada e come um pedaço da
 * arte. Ficam guardados em assets/images/interface/ caso um cartaz sem moldura
 * apareça algum dia.
 */

/** Cartaz vertical de cada jogo, chave = id de games.ts. */
export const GAME_POSTERS: Record<string, number> = {
  slots: require('../../assets/images/cartazes/cartaz-slots.png'),
  roleta: require('../../assets/images/cartazes/cartaz-roleta.png'),
  blackjack: require('../../assets/images/cartazes/cartaz-blackjack.png'),
  bacara: require('../../assets/images/cartazes/cartaz-bacara.png'),
  'banca-francesa': require('../../assets/images/cartazes/cartaz-banca-francesa.png'),
  'bac-bo': require('../../assets/images/cartazes/cartaz-bac-bo.png'),
  'stock-market': require('../../assets/images/cartazes/cartaz-stock-market.png'),
  truco: require('../../assets/images/cartazes/cartaz-truco.png'),
  domino: require('../../assets/images/cartazes/cartaz-domino.png'),
  poker: require('../../assets/images/cartazes/cartaz-poker.png'),
};

/**
 * Cartaz de cada opção da tela de escolha. A chave é o `id` da opção em gameModes.ts
 * quando ela é única (1x1, 2x2, sozinho, mesa), e o id prefixado quando o mesmo id
 * aparece em jogos diferentes com arte própria (paulista, mineiro).
 */
export const MODE_BANNERS: Record<string, number> = {
  paulista: require('../../assets/images/cartazes/variantes/truco-paulista.png'),
  mineiro: require('../../assets/images/cartazes/variantes/truco-mineiro.png'),
  '1x1': require('../../assets/images/cartazes/variantes/modo-1x1.png'),
  '2x2': require('../../assets/images/cartazes/variantes/modo-2x2.png'),
  sozinho: require('../../assets/images/cartazes/variantes/modo-sozinho.png'),
  mesa: require('../../assets/images/cartazes/variantes/modo-mesa-online.png'),
};

export const LOBBY_UI = {
  /** Cápsula do contador de fichas: pilha à esquerda, botão + à direita, meio vazio. */
  hudFichas: require('../../assets/images/interface/hud-fichas.png'),
  /** Calha vazia da barra de nível, com o brasão redondo na ponta esquerda. */
  barraNivel: require('../../assets/images/interface/hud-barra-nivel.png'),
  /** A faixa dourada que preenche a calha — o app corta pela porcentagem. */
  barraNivelPreenchimento: require('../../assets/images/interface/hud-barra-nivel-preenchimento.png'),
  /** Cadeado pra jogo ainda travado por nível. */
  seloBloqueado: require('../../assets/images/interface/selo-bloqueado.png'),
  /** Fita vermelha vazia — o app escreve "NOVO" por cima. */
  seloNovo: require('../../assets/images/interface/selo-novo.png'),
  /** Corredor de cassino desfocado, fundo da tela de escolha de modo. */
  fundoSelecaoModo: require('../../assets/images/interface/fundo-selecao-modo.png'),
} as const;

export const LOBBY_ICONS = {
  mesaOnline: require('../../assets/images/interface/icones/mesa-online.png'),
  contraACasa: require('../../assets/images/interface/icones/contra-a-casa.png'),
  atualizar: require('../../assets/images/interface/icones/atualizar.png'),
  favoritar: require('../../assets/images/interface/icones/favoritar.png'),
} as const;
