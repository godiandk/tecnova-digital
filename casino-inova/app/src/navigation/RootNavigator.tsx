import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList, TabParamList } from './types';
import { colors, fontFamily, fontSize } from '../theme';
import { LobbyScreen } from '../screens/LobbyScreen';
import { TournamentsScreen } from '../screens/TournamentsScreen';
import { StoreScreen } from '../screens/StoreScreen';
import { FriendsScreen } from '../screens/FriendsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { GameTableScreen } from '../screens/games/GameTableScreen';
import { SlotsScreen } from '../screens/games/SlotsScreen';
import { RouletteScreen } from '../screens/games/RouletteScreen';
import { BlackjackScreen } from '../screens/games/BlackjackScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const TAB_ICONS: Record<keyof TabParamList, keyof typeof Ionicons.glyphMap> = {
  Lobby: 'home',
  Tournaments: 'trophy',
  Store: 'cart',
  Friends: 'people',
  Profile: 'person-circle',
};

const TAB_LABELS: Record<keyof TabParamList, string> = {
  Lobby: 'Lobby',
  Tournaments: 'Torneios',
  Store: 'Loja',
  Friends: 'Amigos',
  Profile: 'Perfil',
};

function TabsNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.goldBright,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.backgroundElevated,
          borderTopColor: colors.feltLine,
          height: 64,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.xs },
        tabBarIcon: ({ color, size }) => <Ionicons name={TAB_ICONS[route.name]} size={size} color={color} />,
        tabBarLabel: TAB_LABELS[route.name],
      })}
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
      <Stack.Screen name="Slots" component={SlotsScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Roulette" component={RouletteScreen} options={{ animation: 'fade' }} />
      <Stack.Screen name="Blackjack" component={BlackjackScreen} options={{ animation: 'fade' }} />
    </Stack.Navigator>
  );
}
