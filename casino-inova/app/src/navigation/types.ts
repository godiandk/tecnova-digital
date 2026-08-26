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
};
