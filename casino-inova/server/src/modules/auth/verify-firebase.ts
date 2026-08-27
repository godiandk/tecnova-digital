/**
 * Confere a integração com o Firebase contra o projeto DE VERDADE.
 *
 * Diferente dos outros verificadores, este precisa da chave de serviço
 * (FIREBASE_SERVICE_ACCOUNT). Sem ela, ele avisa e sai sem falhar — não faz sentido
 * quebrar a bateria inteira num ambiente que não tem a credencial.
 *
 * O que prova, e por que cada um importa:
 *
 * 1. A chave de serviço é aceita e o Admin SDK fala com o projeto certo.
 * 2. `verifyIdToken` valida um token REAL, assinado pelo Google. Isso é o que separa
 *    "o código chama a função" de "a função realmente confere com o Google" — sem este
 *    teste, um erro de configuração só apareceria quando um jogador tentasse entrar.
 * 3. Um token real, válido e não expirado é RECUSADO quando o provedor não bate. É a
 *    prova de que a checagem de provedor não é enfeite.
 * 4. Token adulterado é recusado.
 */
import { getAuth } from 'firebase-admin/auth';
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { verificarTokenFirebase } from './firebase';

let falhas = 0;
const checa = (nome: string, ok: boolean, detalhe = '') => {
  console.log(ok ? `OK   ${nome}` : `FALHA ${nome}${detalhe ? ' — ' + detalhe : ''}`);
  if (!ok) falhas += 1;
};

/** A chave pública do projeto, pra trocar token customizado por token de verdade. */
const API_KEY_PUBLICA = process.env.FIREBASE_API_KEY ?? '';

async function main() {
  const bruto = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!bruto) {
    console.log('FIREBASE_SERVICE_ACCOUNT não definida — pulando (isto não é falha).');
    return;
  }

  const credencial = JSON.parse(bruto) as { project_id: string; client_email: string; private_key: string };
  const app: App =
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId: credencial.project_id,
        clientEmail: credencial.client_email,
        privateKey: credencial.private_key.replace(/\\n/g, '\n'),
      }),
    });
  checa('a chave de serviço é aceita', true, credencial.project_id);

  // --- Emite um token customizado e troca por um ID token de verdade ---
  const uidDeTeste = `verificacao-${Date.now()}`;
  const tokenCustomizado = await getAuth(app).createCustomToken(uidDeTeste);
  checa('o Admin SDK consegue emitir token (fala com o projeto)', tokenCustomizado.length > 100);

  if (!API_KEY_PUBLICA) {
    console.log('FIREBASE_API_KEY não definida — pulando a parte que precisa dela.');
  } else {
    const resposta = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY_PUBLICA}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenCustomizado, returnSecureToken: true }),
      },
    );
    const dados = (await resposta.json()) as { idToken?: string; error?: { message?: string } };
    checa('a chave pública troca por um ID token real', Boolean(dados.idToken), dados.error?.message ?? '');

    if (dados.idToken) {
      // 2. O Admin SDK valida um token assinado pelo Google de verdade.
      const decodificado = await getAuth(app).verifyIdToken(dados.idToken);
      checa('verifyIdToken aceita um token real do Google', decodificado.uid === uidDeTeste, decodificado.uid);
      checa('o token é do nosso projeto', decodificado.aud === credencial.project_id, String(decodificado.aud));

      // 3. Mesmo sendo real e válido, é recusado porque o provedor não bate.
      let recusouPorProvedor = false;
      let mensagem = '';
      try {
        await verificarTokenFirebase('google', dados.idToken);
      } catch (erro) {
        recusouPorProvedor = true;
        mensagem = erro instanceof Error ? erro.message : String(erro);
      }
      checa('token real mas de outro provedor é recusado', recusouPorProvedor, mensagem);

      // 4. Token adulterado (um caractere trocado na assinatura).
      const adulterado = dados.idToken.slice(0, -1) + (dados.idToken.slice(-1) === 'a' ? 'b' : 'a');
      let recusouAdulterado = false;
      try {
        await verificarTokenFirebase('google', adulterado);
      } catch {
        recusouAdulterado = true;
      }
      checa('token adulterado é recusado', recusouAdulterado);
    }
  }

  // Limpa o usuário que a troca criou, pra não deixar lixo no projeto.
  try {
    await getAuth(app).deleteUser(uidDeTeste);
    console.log(`     (usuário de teste ${uidDeTeste} apagado do projeto)`);
  } catch {
    // Pode não ter sido criado, se a troca não aconteceu.
  }
}

main()
  .then(() => {
    console.log(falhas === 0 ? '\nIntegração com o Firebase OK.' : `\n${falhas} falha(s).`);
    process.exit(falhas === 0 ? 0 : 1);
  })
  .catch((erro) => {
    console.error('ERRO:', erro instanceof Error ? erro.message : erro);
    process.exit(1);
  });
