import { ForbiddenException } from '@nestjs/common';

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
export function origemPermitida(origem: string | undefined, permitidas = origensDoAmbiente()): boolean {
  if (!origem) return true; // aplicativo nativo, curl, webhook: não mandam Origin
  if (permitidas.length > 0) return permitidas.includes(origem);
  return DESENVOLVIMENTO.some((padrao) => padrao.test(origem));
}

/**
 * A configuração de CORS que o Nest e o Socket.IO usam.
 *
 * `credentials: false` porque este projeto não usa cookie de sessão: o token vai no
 * cabeçalho `Authorization`, que o navegador não manda sozinho entre sites. É o que torna
 * um pedido forjado de outra aba inútil mesmo que ele passasse pelo CORS.
 */
export const corsDaApi = {
  origin: (origem: string | undefined, callback: (erro: Error | null, permitido?: boolean) => void) => {
    if (origemPermitida(origem)) return callback(null, true);
    /*
     * 403, E NÃO UM ERRO CRU. Devolvendo um `Error` comum, o Nest não sabe o que é e
     * responde 500 — o que faz uma regra funcionando parecer um servidor quebrado, enche o
     * registro de erro falso e esconde um 500 de verdade no meio. `ForbiddenException` diz
     * a coisa certa: o pedido foi entendido e recusado.
     */
    callback(new ForbiddenException(`Origem não permitida: ${origem}`));
  },
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86_400,
};
