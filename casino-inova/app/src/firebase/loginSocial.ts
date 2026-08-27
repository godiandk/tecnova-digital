import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';

import { firebaseAuth } from './app';
import { GOOGLE_CLIENT_IDS } from './config';
import { apiRequest } from '../api/client';
import { salvarToken } from '../api/session';
import type { UsuarioLogado } from '../api/auth';

/**
 * Fecha a janela do navegador sozinha quando o login termina. Sem isso, no Android a
 * pessoa volta pro app com uma aba aberta por cima.
 */
WebBrowser.maybeCompleteAuthSession();

/**
 * Login com Google.
 *
 * A corrente inteira, que vale entender porque cada elo tem um motivo:
 *
 * 1. `expo-auth-session` abre a tela do Google e volta com um `id_token` do Google.
 * 2. O Firebase troca esse id_token por uma sessão Firebase (`signInWithCredential`).
 * 3. `getIdToken()` dá o token do FIREBASE — que é diferente do token do Google.
 * 4. Esse token vai pro NOSSO servidor, que confere com o Google se é legítimo e só
 *    então cria a conta e devolve a NOSSA sessão.
 *
 * O passo 4 é o que importa pra segurança: o app nunca decide quem entrou. Ele só
 * carrega um token que o servidor confere. É por isso que não adianta alguém adulterar
 * o app — o servidor não acredita nele.
 *
 * Devolve um hook porque o fluxo do `expo-auth-session` precisa de estado de React (a
 * resposta chega depois que o navegador fecha, não no retorno da chamada).
 */
export function useLoginGoogle() {
  const [, resposta, pedirLogin] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_CLIENT_IDS.web,
    iosClientId: GOOGLE_CLIENT_IDS.ios || undefined,
    androidClientId: GOOGLE_CLIENT_IDS.android || undefined,
  });

  /**
   * Chamar depois que `resposta` chegar com sucesso. Separado do hook porque o React
   * precisa reagir à resposta num efeito, e a troca é assíncrona.
   */
  const concluir = async (): Promise<UsuarioLogado | null> => {
    if (resposta?.type !== 'success') return null;

    const idTokenDoGoogle = resposta.params?.id_token;
    if (!idTokenDoGoogle) return null;

    const credencial = GoogleAuthProvider.credential(idTokenDoGoogle);
    const sessaoFirebase = await signInWithCredential(firebaseAuth(), credencial);
    const tokenDoFirebase = await sessaoFirebase.user.getIdToken();

    const nossa = await apiRequest<{ token: string; user: UsuarioLogado }>(
      '/auth/entrar-com-provedor',
      {
        method: 'POST',
        body: {
          provedor: 'google',
          token: tokenDoFirebase,
          nome: sessaoFirebase.user.displayName ?? undefined,
        },
      },
    );

    await salvarToken(nossa.token, { id: nossa.user.id, name: nossa.user.name });
    return nossa.user;
  };

  return { resposta, pedirLogin, concluir };
}
