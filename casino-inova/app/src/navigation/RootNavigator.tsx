import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { BarraDeAbas } from '../components/BarraDeAbas';

import { RootStackParamList, TabParamList } from './types';
import { LobbyScreen } from '../screens/LobbyScreen';
import { TournamentsScreen } from '../screens/TournamentsScreen';
import { StoreScreen } from '../screens/StoreScreen';
import { FriendsScreen } from '../screens/FriendsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { GameTableScreen } from '../screens/games/GameTableScreen';
import { GameModeScreen } from '../screens/GameModeScreen';
import { SlotsScreen } from '../screens/games/SlotsScreen';
import { RouletteScreen } from '../screens/games/RouletteScreen';
import { BlackjackScreen } from '../screens/games/BlackjackScreen';
import { BaccaratScreen } from '../screens/games/BaccaratScreen';
import { BancaFrancesaScreen } from '../screens/games/BancaFrancesaScreen';
import { BancaFrancesaMesaScreen } from '../screens/games/BancaFrancesaMesaScreen';
import { AdminScreen } from '../screens/AdminScreen';
import { BacBoMesaScreen } from '../screens/games/BacBoMesaScreen';
import { StockMarketScreen } from '../screens/games/StockMarketScreen';
import { TrucoScreen } from '../screens/games/TrucoScreen';
import { TrucoMesaScreen } from '../screens/games/TrucoMesaScreen';
import { DominoScreen } from '../screens/games/DominoScreen';
import { DominoMesaScreen } from '../screens/games/DominoMesaScreen';
import { PokerScreen } from '../screens/games/PokerScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function TabsNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BarraDeAbas {...props} />}
    >
      <Tab.Screen name="Lobby" component={LobbyScreen} />
      <Tab.Screen name="Tournaments" component={TournamentsScreen} />
      <Tab.Screen name="Store" component={StoreScreen} />
      <Tab.Screen name="Friends" component={FriendsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={TabsNavigator} />
      <Stack.Screen name="GameTable" component={GameTableScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="GameMode" component={GameModeScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Slots" component={SlotsScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Roulette" component={RouletteScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Blackjack" component={BlackjackScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Baccarat" component={BaccaratScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="BancaFrancesa" component={BancaFrancesaScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="BancaFrancesaMesa" component={BancaFrancesaMesaScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Painel" component={AdminScreen} />
      <Stack.Screen name="BacBo" component={BacBoMesaScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="StockMarket" component={StockMarketScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Truco" component={TrucoScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="TrucoMesa" component={TrucoMesaScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Domino" component={DominoScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="DominoMesa" component={DominoMesaScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Poker" component={PokerScreen} options={{ animation: 'fade' }} />
    </Stack.Navigator>
  );
}
