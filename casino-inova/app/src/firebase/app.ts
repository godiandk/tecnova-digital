import { getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth, initializeAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { FIREBASE_CONFIG } from './config';

/**
 * O Firebase do lado do app.
 *
 * Duas diferenças em relação ao trecho que o console do Firebase entrega, que é escrito
 * pra web e quebra em React Native:
 *
 * 1. **Nada de `getAnalytics`.** O módulo `firebase/analytics` é só pra navegador — ele
 *    depende de `window` e de IndexedDB. Em React Native ele falha. Analytics em app
 *    nativo é outro pacote (`@react-native-firebase/analytics`), e nem é necessário pro
 *    login funcionar.
 *
 * 2. **`initializeAuth` com persistência do AsyncStorage**, não `getAuth`. Sem passar a
 *    persistência explicitamente, o Firebase guarda a sessão só em memória no React
 *    Native: fechou o app, perdeu o login. (No nosso caso o efeito seria pequeno, porque
 *    quem manda na sessão é o NOSSO token no SecureStore — mas o aviso no console
 *    confunde, e o comportamento certo é este.)
 */
let authCache: Auth | null = null;

export function firebaseAuth(): Auth {
  if (authCache) return authCache;

  const app = getApps()[0] ?? initializeApp(FIREBASE_CONFIG);

  try {
    // `getReactNativePersistence` não é exportado no tipo público do SDK web, mas existe
    // no pacote — é assim que a própria documentação do Firebase manda fazer em RN.
    const { getReactNativePersistence } = require('firebase/auth') as {
      getReactNativePersistence: (armazenamento: unknown) => unknown;
    };
    authCache = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage) as never,
    });
  } catch {
    // Já inicializado (recarga de código em desenvolvimento) ou versão sem o helper.
    authCache = getAuth(app);
  }
  return authCache;
}
