import type { CorsOptions, CorsOptionsDelegate } from '@nestjs/common/interfaces/external/cors-options.interface';

import { registro } from '../observabilidade/registro';

/**
 * DE ONDE O NAVEGADOR PODE FALAR COM ESTE SERVIDOR.
 *
 * O QUE ESTAVA ERRADO: `app.enableCors()` sem argumento nenhum, que quer dizer *qualquer
 * origem*. Num aplicativo nativo isso não muda nada — o CORS é uma regra do navegador, e o
 * celular não a aplica. Mas este projeto TAMBÉM roda na web (`react-native-web`), e aí a
 * conta é outra: qualquer página, em qualquer domínio, podia fazer o navegador de quem
 * está logado chamar esta API.
 *
 * O que isso permite, na prática, com o token no armazenamento do navegador: um site
 * qualquer que a pessoa abra em outra aba faz pedidos autenticados em nome dela. Apostar,
 * coletar, trocar o nome. Não é roubo do token — é uso dele, o que dá no mesmo.
 *
 * A REGRA NOVA: uma lista, e ela vem de `ORIGENS_PERMITIDAS` no ambiente. Sem a variável,
 * valem as origens de desenvolvimento (localhost, e a rede local, que é como se testa no
 * celular de verdade). Produção define a lista e nada mais entra.
 *
 * E PEDIDO SEM ORIGEM CONTINUA PASSANDO, de propósito: aplicativo nativo, `curl` e o
 * webhook do provedor de pagamento não mandam `Origin`. Recusá-los quebraria o aplicativo
 * inteiro sem fechar nada — quem não é navegador não é obrigado a mandar cabeçalho
 * nenhum, então usar a ausência dele como tranca não tranca coisa alguma. O que protege
 * essas portas é o token e a assinatura HMAC, não o CORS.
 */

/** Localhost em qualquer porta, e a rede local privada — é assim que se testa no celular. */
const DESENVOLVIMENTO = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https?:\/\/\[::1\](:\d+)?$/,
  /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,
  /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,
  /^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}(:\d+)?$/,
];

export function origensDoAmbiente(): string[] {
  return (process.env.ORIGENS_PERMITIDAS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

/**
 * Esta origem pode falar com a API?
 *
 * @param origem o cabeçalho `Origin`. `undefined` é quem não é navegador.
 */
export function origemPermitida(
  origem: string | undefined,
  permitidas = origensDoAmbiente(),
  hostDoPedido?: string,
): boolean {
  if (!origem) return true; // aplicativo nativo, curl, webhook: não mandam Origin

  /*
   * MESMA ORIGEM, PRIMEIRO E SEM CONFIGURAÇÃO. Se o `Origin` aponta para o mesmo host que
   * atendeu o pedido, quem está chamando é o próprio site — e o próprio site nunca é "de
   * fora". Ter que listar o próprio domínio numa variável seria uma armadilha: esquecer a
   * variável derruba o caminho principal, que foi exatamente o que aconteceu.
   */
  if (hostDoPedido && mesmoHost(origem, hostDoPedido)) return true;

  if (permitidas.length > 0) return permitidas.includes(origem);
  return DESENVOLVIMENTO.some((padrao) => padrao.test(origem));
}

/**
 * O `Origin` aponta para este mesmo servidor?
 *
 * Compara HOST (com porta), e não a URL inteira: o `Origin` traz o esquema
 * (`https://casa.com`) e o `Host` não (`casa.com`). Comparar texto cru nunca bateria.
 */
function mesmoHost(origem: string, hostDoPedido: string): boolean {
  try {
    return new URL(origem).host.toLowerCase() === hostDoPedido.toLowerCase();
  } catch {
    return false; // `Origin` que não é URL não é mesma origem coisa nenhuma
  }
}

/**
 * A configuração de CORS que o Nest e o Socket.IO usam.
 *
 * `credentials: false` porque este projeto não usa cookie de sessão: o token vai no
 * cabeçalho `Authorization`, que o navegador não manda sozinho entre sites. É o que torna
 * um pedido forjado de outra aba inútil mesmo que ele passasse pelo CORS.
 */
const OPCOES_FIXAS: CorsOptions = {
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86_400,
};

/**
 * A configuração de CORS que o Nest usa.
 *
 * É uma FUNÇÃO DO PEDIDO, e não um objeto fixo, porque a decisão precisa do `Host` — é ele
 * que responde "este `Origin` é o meu próprio site?". Com um objeto fixo, a função de
 * origem recebe só o `Origin` e não tem como saber isso.
 *
 * `credentials: false` porque este projeto não usa cookie de sessão: o token vai no
 * cabeçalho `Authorization`, que o navegador não manda sozinho entre sites. É o que torna
 * um pedido forjado de outra aba inútil mesmo que ele passasse pelo CORS.
 */
export const corsDaApi: CorsOptionsDelegate<{
  headers?: Record<string, string | string[] | undefined>;
}> = (req, callback) => {
  const origem = primeiro(req?.headers?.origin);
  const host = primeiro(req?.headers?.host);

  if (origemPermitida(origem, origensDoAmbiente(), host)) {
    return callback(null, { ...OPCOES_FIXAS, origin: origem ?? true });
  }

  /*
   * RECUSAR SEM CABEÇALHO, e não com exceção.
   *
   * A versão anterior lançava `ForbiddenException`, e isso ia parar NA TELA DO JOGADOR: a
   * mensagem técnica aparecia em cima do prêmio dele. Não devolver o cabeçalho de CORS é o
   * que o padrão manda fazer — o NAVEGADOR recusa a resposta, e do lado de cá não existe
   * erro nenhum para vazar. Quem não é navegador já passou pela linha de cima.
   */
  registro.aviso('cors', 'origem-recusada', { host });
  callback(null, { ...OPCOES_FIXAS, origin: false });
};

/** Cabeçalho pode vir como lista quando aparece repetido; vale o primeiro. */
function primeiro(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

/** O mesmo critério, no formato que o Socket.IO entende (ele não usa delegate). */
export const corsDoSocket = {
  ...OPCOES_FIXAS,
  origin: (origem: string | undefined, callback: (erro: Error | null, permitido?: boolean) => void) => {
    /*
     * O socket não tem o `Host` do pedido nesta função, então a mesma origem entra pela
     * lista — e, sem lista, pelo padrão de desenvolvimento. É menos preciso que o caminho
     * da API de propósito: preferir errar recusando um socket a errar aceitando qualquer um.
     */
    callback(null, origemPermitida(origem));
  },
};
