import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';

/**
 * Navegação para o Stack raiz, utilizável de dentro de qualquer tab — é como as telas
 * do Lobby empurram a `GameTable`, que vive fora do tab navigator (pra esconder a tab bar).
 */
export function useRootNavigation() {
  return useNavigation<NativeStackNavigationProp<RootStackParamList>>();
}
