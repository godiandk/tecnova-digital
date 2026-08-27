import { BadRequestException, Logger } from '@nestjs/common';
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const logger = new Logger('Firebase');

/**
 * Liga o Firebase Admin — a peça que confere, com o Google, que um token de login
 * social é legítimo.
 *
 * As credenciais vêm de FIREBASE_SERVICE_ACCOUNT, com o JSON inteiro da chave de
 * serviço (o arquivo que o console do Firebase baixa). Vale como variável de ambiente,
 * e não como arquivo no repositório, porque essa chave dá acesso administrativo ao
 * projeto inteiro: commitar por engano é entregar as contas de todo mundo.
 *
 * Sem a variável, devolve null e o login social recusa — nunca aceita sem conferir.
 */
let appCache: App | null | undefined;

function appFirebase(): App | null {
  if (appCache !== undefined) return appCache;

  const bruto = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!bruto) {
    appCache = null;
    return null;
  }

  try {
    const credencial = JSON.parse(bruto) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    if (!credencial.project_id || !credencial.client_email || !credencial.private_key) {
      throw new Error('faltam project_id, client_email ou private_key');
    }

    appCache =
      getApps()[0] ??
      initializeApp({
        credential: cert({
          projectId: credencial.project_id,
          clientEmail: credencial.client_email,
          /*
           * A chave privada tem quebras de linha de verdade. Passar um JSON por
           * variável de ambiente costuma transformá-las em "\n" literal (dois
           * caracteres), e aí a chave não é aceita. Desfazer isso aqui evita o erro
           * mais comum de configuração do Firebase Admin.
           */
          privateKey: credencial.private_key.replace(/\\n/g, '\n'),
        }),
      });
    logger.log(`Firebase Admin ligado no projeto ${credencial.project_id}.`);
  } catch (erro) {
    logger.error(
      `FIREBASE_SERVICE_ACCOUNT está definida mas não deu pra usar: ${
        erro instanceof Error ? erro.message : erro
      }`,
    );
    appCache = null;
  }
  return appCache;
}

export function firebaseEstaLigado(): boolean {
  return appFirebase() !== null;
}

export interface IdentidadeDoProvedor {
  /** Identificador estável da pessoa naquele provedor — é a chave da credencial. */
  subject: string;
  nome?: string;
  email?: string;
}

/**
 * Confere o token que o app recebeu do Google/Apple/Facebook.
 *
 * `verifyIdToken` confere assinatura, validade, emissor e público-alvo contra as
 * chaves públicas do Google. Token forjado, expirado ou de outro projeto Firebase é
 * recusado aqui — é isto que impede alguém entrar como qualquer pessoa só inventando
 * um token.
 *
 * O segundo argumento (`checkRevoked`) faz a conferência ir até o servidor do Google
 * ver se a sessão foi revogada (logout em todos os aparelhos, conta desativada). Custa
 * uma ida à rede por login, o que é aceitável: login não acontece a cada jogada.
 */
export async function verificarTokenFirebase(
  provedorEsperado: string,
  token: string,
): Promise<IdentidadeDoProvedor> {
  const app = appFirebase();
  if (!app) {
    throw new BadRequestException(
      'Login social não está ligado neste servidor — falta definir FIREBASE_SERVICE_ACCOUNT.',
    );
  }

  let decodificado;
  try {
    decodificado = await getAuth(app).verifyIdToken(token, true);
  } catch (erro) {
    // Mensagem genérica: o motivo exato (expirado, assinatura errada, revogado) só
    // ajudaria quem estiver tentando adivinhar o que falta pro token passar.
    throw new BadRequestException('Não deu pra confirmar esse login. Tente entrar de novo.');
  }

  /*
   * Confere que o token é do provedor que o app disse ter usado. Sem isso, um token
   * legítimo do Google serviria pra entrar por uma credencial marcada como Apple, e as
   * duas contas se misturariam.
   */
  const provedorDoToken = mapearProvedor(decodificado.firebase?.sign_in_provider);
  if (provedorDoToken && provedorDoToken !== provedorEsperado) {
    throw new BadRequestException(
      `Esse token é de ${provedorDoToken}, não de ${provedorEsperado}.`,
    );
  }

  return {
    subject: decodificado.uid,
    nome: decodificado.name,
    email: decodificado.email,
  };
}

/** Nomes do Firebase → os nomes que a coluna `provider` usa. */
function mapearProvedor(signInProvider?: string): string | null {
  switch (signInProvider) {
    case 'google.com':
      return 'google';
    case 'apple.com':
      return 'apple';
    case 'facebook.com':
      return 'facebook';
    case 'password':
      return 'senha';
    default:
      return null;
  }
}
