import Constants from 'expo-constants';
import { limparSessao, tokenAtual } from './session';

const SERVER_PORT = 3000;

/**
 * Descobre sozinho o endereço do servidor.
 *
 * O problema que isso resolve: num iPhone de verdade, "localhost" é o próprio
 * iPhone — não o computador onde o servidor está rodando. Então um endereço fixo
 * `http://localhost:3000` funciona no simulador e falha no celular, com um erro de
 * rede que não explica nada.
 *
 * A saída: quando você roda `npx expo start`, o Expo já sabe o IP da sua máquina na
 * rede local (é o endereço que aparece no QR Code), e expõe isso em `hostUri`, algo
 * como "192.168.0.10:8081". A gente aproveita esse IP e só troca a porta pela do
 * servidor. Assim funciona no celular físico, no simulador e no emulador, sem você
 * precisar editar nada.
 *
 * Publicado, o caminho é outro: o servidor entrega o próprio app como site, então a
 * API está no MESMO endereço da página e basta usar a origem dela. É o que faz o jogo
 * funcionar em qualquer domínio sem recompilar e sem configurar CORS.
 *
 * `EXPO_PUBLIC_API_URL` continua tendo prioridade sobre tudo, pra quando o servidor
 * ficar num endereço diferente do site.
 */
function resolveApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv;

  const hostUri = Constants.expoConfig?.hostUri ?? (Constants as { manifest2?: { extra?: { expoGo?: { developer?: { host?: string } } } } }).manifest2?.extra?.expoGo?.developer?.host;
  const host = hostUri?.split(':')[0];

  if (host) return `http://${host}:${SERVER_PORT}`;

  /*
   * Publicado no navegador: o site é servido pelo próprio servidor, então a API está na
   * mesma origem da página.
   *
   * O `!__DEV__` é o que separa isso do desenvolvimento, e não é detalhe: rodando
   * `expo start --web`, quem serve a página é o Metro na 8081 e o servidor está na
   * 3000. Sem essa condição, o app em desenvolvimento passava a chamar a própria 8081 e
   * toda tela dizia "não deu pra falar com o servidor".
   */
  if (!__DEV__ && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  // Último recurso (build nativo sem Metro): só o simulador da própria máquina.
  return `http://localhost:${SERVER_PORT}`;
}

export const API_BASE_URL = resolveApiBaseUrl();

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/**
 * Um id novo pra UMA intenção do jogador.
 *
 * Gere no momento do toque, e REUSE o mesmo id se a chamada precisar ser repetida. É
 * isso que deixa o servidor distinguir "apostou duas vezes" de "a mesma aposta chegou
 * duas vezes" — sem o id ele debita as duas, porque as duas requisições são idênticas.
 *
 * Não precisa ser imprevisível, só único por jogador: quem manda a chave já está
 * autenticado, e adivinhar a própria chave não dá acesso a nada.
 */
export function novaAcao(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function apiRequest<T>(
  path: string,
  options?: { method?: 'GET' | 'POST' | 'PATCH'; body?: unknown; actionId?: string },
): Promise<T> {
  const token = tokenAtual();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options?.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      // Quem você é vai no cabeçalho, assinado. Nenhuma rota lê identidade do corpo.
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    /*
     * A chave de idempotência entra no corpo junto com o resto. Fica aqui, num lugar
     * só, pra nenhuma tela precisar lembrar de montar o campo na mão.
     */
    body: options?.body
      ? JSON.stringify(options.actionId ? { ...(options.body as object), actionId: options.actionId } : options.body)
      : undefined,
  });

  // Token expirado ou revogado: derruba a sessão pra o app voltar pro login em vez de
  // ficar mostrando erro em toda tela.
  if (response.status === 401) {
    await limparSessao();
  }

  const payload = await response.json().catch(() => undefined);

  if (!response.ok) {
    const message = payload?.message ?? `Erro ${response.status} ao falar com o servidor.`;
    throw new ApiError(Array.isArray(message) ? message.join(' ') : message, response.status);
  }

  return payload as T;
}

/**
 * A MENSAGEM QUE O JOGADOR PODE VER.
 *
 * ISTO EXISTE POR UM DEFEITO QUE FOI AO AR: a tela mostrava `erro.message` cru, e num dia
 * ruim o jogador leu **"Origem não permitida: https://casino-inova.onrender.com"** escrito
 * em vermelho em cima do prêmio dele. Detalhe de infraestrutura na cara de quem só queria
 * jogar. Não é questão de texto feio — é a quarta parede caindo.
 *
 * A REGRA, e ela é uma linha: **o servidor tem duas famílias de mensagem, e só uma é para
 * gente.**
 *
 *   400 / 409 — REGRA DE JOGO, escrita para ser lida: "Na mesa Bronze, a aposta mínima é
 *               50 fichas", "Você já coletou hoje". Estas passam inteiras: elas explicam
 *               o que fazer, e trocá-las por um genérico piora a vida de quem joga.
 *
 *   401 / 403 / 5xx / rede — INFRAESTRUTURA. Sessão, permissão, origem, banco, servidor
 *               fora do ar. Nada disso o jogador pode resolver, e o texto técnico só
 *               assusta. Viram frases humanas, e o detalhe vai para o console.
 *
 * O QUE SE PERDE, dito de frente: um 400 mal escrito pelo servidor chega inteiro na tela.
 * É o preço de não transformar toda mensagem útil em "algo deu errado" — e o remédio é
 * escrever bem o 400, não esconder todos.
 */
export function mensagemParaOJogador(erro: unknown, quandoDerCerto = 'Não foi possível agora. Tente de novo.'): string {
  if (!(erro instanceof ApiError)) {
    /* Sem status: nem chegou no servidor. É rede, e é o único caso que o jogador resolve. */
    console.warn('[api] falha sem resposta do servidor', erro);
    return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
  }

  if (erro.status === 401) return 'Sua sessão expirou. Entre de novo para continuar.';
  if (erro.status === 429) return erro.message || 'Muitas tentativas seguidas. Espere um instante.';

  /* Regra de jogo: o texto FOI escrito para ser lido. */
  if ((erro.status === 400 || erro.status === 409 || erro.status === 404) && erro.message) {
    return erro.message;
  }

  /*
   * 403 e 5xx são nossos, não do jogador. O detalhe técnico vai para o console — onde o
   * desenvolvedor olha — e a tela recebe uma frase que não mente nem assusta.
   */
  console.warn(`[api] ${erro.status}: ${erro.message}`);
  return quandoDerCerto;
}
