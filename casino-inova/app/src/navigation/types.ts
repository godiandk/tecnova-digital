export type TabParamList = {
  Lobby: undefined;
  Tournaments: undefined;
  Store: undefined;
  Friends: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Tabs: undefined;
  GameTable: { gameId: string };
  GameMode: { gameId: string };
  Slots: undefined;
  Roulette: undefined;
  Blackjack: undefined;
  Baccarat: undefined;
  BancaFrancesa: undefined;
  BancaFrancesaMesa: undefined;
  BacBo: undefined;
  StockMarket: undefined;
  Truco: { variant?: 'paulista' | 'mineiro' } | undefined;
  TrucoMesa: { variant?: 'paulista' | 'mineiro' } | undefined;
  Domino: undefined;
  DominoMesa: undefined;
  Poker: undefined;
  /** Painel de administração. A tela confere a permissão de novo — a rota existir não abre nada. */
  Painel: undefined;
};
