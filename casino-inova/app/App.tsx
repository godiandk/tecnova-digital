import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Poppins_600SemiBold, Poppins_700Bold, Poppins_800ExtraBold } from '@expo-google-fonts/poppins';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';

import { RootNavigator } from './src/navigation/RootNavigator';
import { LoginScreen } from './src/screens/LoginScreen';
import { carregarSessao, aoMudarSessao } from './src/api/session';
import { recuperarSessao } from './src/api/auth';
import { colors } from './src/theme';

SplashScreen.preventAutoHideAsync();

export default function App() {
  /*
   * Três estados, não dois: enquanto a sessão guardada não foi conferida com o
   * servidor, não dá pra saber se mostra login ou lobby. Chutar "deslogado" faria a
   * tela de login piscar em todo abrir de app pra quem já está logado.
   */
  const [logado, setLogado] = useState<boolean | null>(null);

  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    let ativo = true;

    (async () => {
      const token = await carregarSessao();
      // Token guardado só vale se o servidor concordar — pode ter expirado.
      const usuario = token ? await recuperarSessao() : null;
      if (ativo) setLogado(Boolean(usuario));
    })();

    // O cliente de API limpa a sessão sozinho quando o servidor devolve 401; isto aqui
    // é o que faz o app reagir e voltar pro login.
    const parar = aoMudarSessao((estaLogado) => {
      if (ativo) setLogado(estaLogado);
    });

    return () => {
      ativo = false;
      parar();
    };
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded && logado !== null) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, logado]);

  if (!fontsLoaded) {
    return null;
  }

  /*
   * O SafeAreaProvider precisa envolver TUDO, não só a parte navegada.
   *
   * Toda tela usa SafeAreaView do react-native-safe-area-context, e ele exige esse
   * provedor acima na árvore. A tela de login fica fora do NavigationContainer, então
   * sem isto ela renderiza sem provedor nenhum — o que estoura com "No safe area value
   * available" antes de desenhar qualquer coisa.
   */
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: colors.background }} onLayout={onLayoutRootView}>
        <StatusBar style="light" />
        {logado === null ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.goldBright} />
          </View>
        ) : logado ? (
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        ) : (
          <LoginScreen aoEntrar={() => setLogado(true)} />
        )}
      </View>
    </SafeAreaProvider>
  );
}
