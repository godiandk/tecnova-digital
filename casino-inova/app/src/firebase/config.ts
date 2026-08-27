/**
 * Configuração pública do projeto Firebase `inova-casino`.
 *
 * Isto NÃO é segredo — é a metade pública do Firebase, feita pra ir no aplicativo. Ela
 * identifica o projeto, não autoriza nada: quem tiver esses valores consegue no máximo
 * abrir a tela de login do Google apontando pro nosso projeto. Quem decide se alguém
 * entra é o nosso servidor, que confere o token com o Google (ver server/src/modules/
 * auth/firebase.ts).
 *
 * A chave que É segredo é outra: a "chave de serviço" (service account), que fica só no
 * servidor, na variável FIREBASE_SERVICE_ACCOUNT, e nunca no repositório. Essa dá acesso
 * administrativo ao projeto inteiro. Se alguém confundir as duas, é a hora de reler
 * docs/como-ligar-o-firebase.md.
 */
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyD3pdVewLuthnKxOkBpmFJ4KPYkxjFBGTo',
  authDomain: 'inova-casino.firebaseapp.com',
  projectId: 'inova-casino',
  storageBucket: 'inova-casino.firebasestorage.app',
  messagingSenderId: '129274658076',
  appId: '1:129274658076:web:3b8836e9dceee12b0e8ed9',
};

/**
 * Ids de cliente OAuth do Google, um por plataforma.
 *
 * Não vêm no trecho de configuração do Firebase — aparecem quando o login com Google é
 * ligado no console (Authentication → Sign-in method → Google → Configuração do SDK da
 * Web), e no arquivo `GoogleService-Info.plist` no caso do iOS.
 *
 * Ficam em variável de ambiente pra dar pra preencher sem mexer em código. Enquanto
 * estiverem vazios, o botão do Google não aparece na tela de login.
 */
export const GOOGLE_CLIENT_IDS = {
  web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
  ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
  android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '',
};

export function googleEstaConfigurado(): boolean {
  return GOOGLE_CLIENT_IDS.web.length > 0;
}
