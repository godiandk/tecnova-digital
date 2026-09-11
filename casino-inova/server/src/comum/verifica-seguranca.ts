import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { corsDoSocket, origemPermitida } from './origens-permitidas';

/**
 * A SEGURANÇA DO APLICATIVO — a parte que nunca tinha sido auditada.
 *
 *   npm run verify:seguranca
 *
 * A auditoria anterior cobriu a segurança do JOGO: autoridade do servidor, RNG, saldo,
 * idempotência. Isso continua bom e não é o assunto aqui. O que nunca foi olhado é a
 * segurança do APLICATIVO — autenticação, sessão, autorização, limite de chamadas,
 * validação de entrada, SQL, segredos, CORS, WebSocket e o que vai parar no registro.
 *
 * O QUE ESTA CONFERÊNCIA FAZ, e o que ela NÃO faz. Ela prova propriedades que dá pra
 * provar sem subir a rede: que a lista de origens recusa o que deve recusar, que o
 * registro esconde o que deve esconder, que nenhuma consulta monta SQL por concatenação,
 * que nenhuma rota nova nasceu aberta por engano, e que segredo nenhum está escrito no
 * código. Ela NÃO substitui um teste de invasão, e não finge substituir.
 */
let falhas = 0;
function confere(titulo: string, ok: boolean, detalhe = '') {
  if (ok) console.log(`ok   ${titulo}`);
  else {
    falhas += 1;
    console.log(`FALHA ${titulo}${detalhe ? ` — ${detalhe}` : ''}`);
  }
}

const RAIZ = join(__dirname, '..');

function todosOsArquivos(pasta: string, ate: string[] = []): string[] {
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) todosOsArquivos(caminho, ate);
    else if (nome.endsWith('.ts')) ate.push(caminho);
  }
  return ate;
}
const ARQUIVOS = todosOsArquivos(RAIZ);
const ler = (p: string) => readFileSync(p, 'utf8');

console.log('--- 1. CORS: quem pode falar com a API ---');
{
  const permitidas = ['https://casinoinova.com'];
  confere('a origem da lista passa', origemPermitida('https://casinoinova.com', permitidas));
  confere('uma origem de fora é recusada', !origemPermitida('https://site-qualquer.com', permitidas));
  confere('um subdomínio parecido é recusado', !origemPermitida('https://casinoinova.com.evil.com', permitidas));
  confere('http onde se espera https é recusado', !origemPermitida('http://casinoinova.com', permitidas));

  /*
   * PEDIDO SEM ORIGEM PASSA, e isso é escolha e não descuido: aplicativo nativo, `curl` e
   * o webhook do provedor de pagamento não mandam `Origin`. Recusá-los quebraria o
   * aplicativo inteiro sem fechar nada — quem não é navegador não é obrigado a mandar
   * cabeçalho nenhum, então a ausência dele não tranca coisa alguma. Quem protege essas
   * portas é o token e a assinatura HMAC.
   */
  confere('pedido sem Origin (app nativo, webhook) passa', origemPermitida(undefined, permitidas));

  // Sem a variável de ambiente, só o desenvolvimento local entra.
  confere('em desenvolvimento, localhost entra', origemPermitida('http://localhost:8081', []));
  confere('em desenvolvimento, a rede local entra', origemPermitida('http://192.168.0.42:8081', []));
  confere('em desenvolvimento, um site externo NÃO entra', !origemPermitida('https://site-qualquer.com', []));

  /*
   * SEM COOKIE DE SESSÃO. O token vai no cabeçalho `Authorization`, que o navegador não
   * manda sozinho entre sites — é o que torna um pedido forjado de outra aba inútil mesmo
   * que ele passasse pelo CORS. Ligar `credentials` traria o risco de volta.
   */
  confere('o CORS não aceita credenciais (não há cookie de sessão)', corsDoSocket.credentials === false);

  /*
   * MESMA ORIGEM PASSA SEM CONFIGURAÇÃO NENHUMA, e esta é a conferência que o defeito de
   * produção pediu: este servidor serve o SITE e a API na mesma origem, e a lista sem
   * variável só conhecia localhost — então ele recusava o próprio site, e a mensagem
   * técnica aparecia na tela do jogador em cima do prêmio dele.
   */
  confere(
    'o próprio site passa mesmo sem lista nenhuma',
    origemPermitida('https://casino-inova.onrender.com', [], 'casino-inova.onrender.com'),
  );
  confere(
    'e passa mesmo com uma lista que não o inclui',
    origemPermitida('https://casino-inova.onrender.com', ['https://outro.com'], 'casino-inova.onrender.com'),
  );
  confere(
    'mas um host parecido NÃO passa como mesma origem',
    !origemPermitida('https://casino-inova.onrender.com.evil.com', [], 'casino-inova.onrender.com'),
  );
  confere('e a porta faz parte da comparação', !origemPermitida('http://localhost:9999', ['https://x.com'], 'localhost:3000'));
  confere('mesma origem com porta bate', origemPermitida('http://localhost:3000', ['https://x.com'], 'localhost:3000'));
}

console.log('\n--- 2. o registro não conta o que não deve ---');
{
  const registro = ler(join(RAIZ, 'observabilidade/registro.ts'));
  for (const chave of ['senha', 'password', 'token', 'authorization', 'secret', 'cpf', 'email']) {
    confere(`  '${chave}' está na lista de chaves escondidas`, registro.includes(`'${chave}'`));
  }
  confere('  JWT é escondido por FORMATO, e não só por nome de campo', registro.includes('ey[A-Za-z0-9_-]'));
  confere('  chave privada é escondida por formato', registro.includes('BEGIN [A-Z ]*PRIVATE KEY'));

  /*
   * Esconder por formato importa porque o nome do campo nem sempre denuncia: um token
   * dentro de `{ dados: 'eyJhbGci...' }` passaria por qualquer lista de nomes.
   */
}

console.log('\n--- 3. SQL: nenhuma consulta montada por concatenação ---');
{
  /*
   * Procura interpolação DENTRO de uma string de SQL — `${...}` entre crases num `query(`.
   * É o padrão que vira injeção. Parâmetros (`$1`, `$2`) não entram aqui: eles não são
   * interpolados, vão na lista de valores, que o driver escapa.
   *
   * DUAS FORMAS DE INTERPOLAÇÃO SÃO SEGURAS, e são as duas que este projeto usa. Aceitá-las
   * é o que mantém a conferência estrita em vez de ruidosa — uma conferência que acusa o
   * que é seguro acaba desligada, e aí não acusa mais nada:
   *
   *   1. UMA CONSTANTE EM MAIÚSCULAS do próprio módulo (`${SELECT_COM_RESGATES}`). É um
   *      pedaço de SQL escrito à mão, no código, que nenhuma requisição alcança.
   *   2. UM TERNÁRIO ENTRE DOIS LITERAIS (`${jogo ? 'AND jogo = $1' : ''}`). Ele escolhe a
   *      FORMA da consulta; o valor continua indo como parâmetro.
   *
   * Qualquer outra coisa — uma variável, uma propriedade, uma chamada — é valor entrando
   * na consulta, e reprova.
   */
  const CONSTANTE_DO_MODULO = /^[A-Z][A-Z0-9_]*$/;
  const TERNARIO_DE_LITERAIS = /^[\w.?!]+\s*\?\s*'[^']*'\s*:\s*'[^']*'$/;
  const suspeitos: string[] = [];
  for (const arquivo of ARQUIVOS) {
    if (arquivo.endsWith('verifica-seguranca.ts')) continue;
    const texto = ler(arquivo);
    for (const trecho of texto.match(/query(?:One)?\s*(?:<[^>]*>)?\s*\(\s*`[^`]*`/gs) ?? []) {
      for (const interpolacao of trecho.match(/\$\{([^}]*)\}/g) ?? []) {
        const dentro = interpolacao.slice(2, -1).trim();
        if (CONSTANTE_DO_MODULO.test(dentro) || TERNARIO_DE_LITERAIS.test(dentro)) continue;
        suspeitos.push(`${arquivo.replace(RAIZ, '')}: ${interpolacao}`);
      }
    }
  }
  confere('nenhuma consulta interpola valor dentro do SQL', suspeitos.length === 0, suspeitos.join(' | '));
}

console.log('\n--- 4. nenhum segredo escrito no código ---');
{
  const achados: string[] = [];
  for (const arquivo of ARQUIVOS) {
    if (arquivo.endsWith('verifica-seguranca.ts')) continue;
    for (const [i, linha] of ler(arquivo).split('\n').entries()) {
      if (/process\.env/.test(linha)) continue;
      if (/(SENHA_SEMENTE|senha de teste|não é segredo)/i.test(linha)) continue;
    /*
     * As próprias conferências carregam segredos DE MENTIRA como material de teste — é
     * assim que `verifica-registro` prova que o registro esconde uma chave privada. Acusar
     * isso seria acusar a conferência de fazer o trabalho dela.
     */
    if (/verifica-|verify-/.test(arquivo)) continue;
      if (/^\s*(\*|\/\/)/.test(linha)) continue; // comentário
      if (/(secret|segredo|api_?key|private_?key|senha|password)\s*[:=]\s*['"][^'"]{12,}['"]/i.test(linha)) {
        achados.push(`${arquivo.replace(RAIZ, '')}:${i + 1}`);
      }
      if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(linha)) achados.push(`${arquivo.replace(RAIZ, '')}:${i + 1} (chave privada!)`);
    }
  }
  confere('nenhum segredo literal no código', achados.length === 0, achados.join(', '));

  const main = ler(join(RAIZ, 'main.ts'));
  confere('o servidor não sobe sem JWT_SECRET', main.includes("!process.env.JWT_SECRET") && main.includes('throw new Error'));
}

console.log('\n--- 5. as rotas abertas são as que devem estar abertas ---');
{
  /*
   * O PADRÃO É FECHADO: o guard global exige token, e `@Publico()` é a exceção. Esta
   * conferência existe pra que uma rota nova marcada como pública seja uma DECISÃO, e não
   * um copiar-e-colar — a lista abaixo é o combinado, e qualquer coisa fora dela reprova.
   */
  const esperadas = new Set([
    'auth.controller.ts', 'legal.controller.ts', 'tournaments.controller.ts', 'store.controller.ts',
    'bac-bo.controller.ts', 'banca-francesa.controller.ts', 'slots.controller.ts', 'blackjack.controller.ts',
    'baccarat.controller.ts', 'roulette.controller.ts', 'stock-market.controller.ts', 'site.controller.ts',
    'versao.controller.ts', 'roadmap.controller.ts', 'niveis.controller.ts', 'lobby.controller.ts',
  ]);
  const inesperados: string[] = [];
  for (const arquivo of ARQUIVOS) {
    const nome = arquivo.split('/').pop()!;
    if (nome === 'auth.guard.ts' || nome === 'verifica-seguranca.ts') continue;
    /*
     * Procura o DECORADOR, e não a palavra: `@Publico()` aparece em comentário explicando
     * a regra (no `app.module.ts`, por exemplo), e contar comentário como rota aberta
     * transformaria a conferência num alarme que toca sozinho.
     */
    const temDecorador = ler(arquivo)
      .split('\n')
      .some((linha) => !/^\s*(\*|\/\/)/.test(linha) && linha.includes('@Publico()'));
    if (temDecorador && !esperadas.has(nome)) inesperados.push(nome);
  }
  confere('nenhuma rota pública fora do combinado', inesperados.length === 0, inesperados.join(', '));

  // E o webhook de pagamento, que é público, tranca pela assinatura.
  const porta = ler(join(RAIZ, 'modules/store/porta-revenuecat.ts'));
  confere('o webhook de compra confere assinatura HMAC', porta.includes('createHmac') && porta.includes('timingSafeEqual'));
  confere('e compara em tempo constante, não com ===', !/recebida\s*===\s*esperada/.test(porta));
}

console.log('\n--- 6. sessão: o token é assinado, fixado e tem prazo ---');
{
  const auth = ler(join(RAIZ, 'modules/auth/auth.service.ts'));
  /*
   * SEM `algorithms`, a biblioteca aceita o que o PRÓPRIO TOKEN declarar — e um token que
   * declara `none` abre a confusão de algoritmo clássica.
   */
  confere('o algoritmo do token é fixado na verificação', /jwt\.verify\([^)]*algorithms:\s*\['HS256'\]/s.test(auth));
  confere('e na assinatura', /algorithm:\s*'HS256'/.test(auth));
  confere('o token tem prazo de validade', auth.includes('expiresIn'));
  confere('a senha é guardada com scrypt e sal por conta', auth.includes('scrypt') && auth.includes('randomBytes(16)'));
  confere('a conferência de senha é em tempo constante', auth.includes('timingSafeEqual'));

  const guard = ler(join(RAIZ, 'modules/auth/auth.guard.ts'));
  confere('o guard põe o userId na requisição, e não lê do corpo', guard.includes('req.userId = this.auth.verificarToken'));

  const gateway = ler(join(RAIZ, 'modules/rooms/rooms.gateway.ts'));
  confere('o socket decide a identidade pelo token, uma vez', gateway.includes('this.auth.verificarToken(body?.token'));
  confere('e nenhum evento de mesa lê identidade do corpo', !/@MessageBody\(\)[^)]*\buserId\b/.test(gateway));
  confere('o socket não aceita mais qualquer origem', !gateway.includes("cors: { origin: '*' }"));
}

console.log('\n--- 7. limite de tentativas nas portas que custam caro ---');
{
  const authCtl = ler(join(RAIZ, 'modules/auth/auth.controller.ts'));
  confere('login tem limite', /@Limite\([^)]*\)\s*\n\s*@Post\('entrar'\)/.test(authCtl));
  confere('e ele também conta por e-mail, não só por IP', /tambemPor:\s*'email'/.test(authCtl));
  confere('cadastro tem limite', /@Limite\([^)]*\)\s*\n\s*@Post\('cadastrar'\)/.test(authCtl));
  confere('entrar com provedor tem limite', /@Limite\([^)]*\)\s*\n\s*@Post\('entrar-com-provedor'\)/.test(authCtl));

  const app = ler(join(RAIZ, 'app.module.ts'));
  /*
   * A ORDEM IMPORTA: o limite roda ANTES da autenticação. Ao contrário, cada tentativa
   * errada ainda pagaria o scrypt inteiro antes de ser recusada — que é exatamente o custo
   * que o atacante quer impor.
   */
  const posLimite = app.indexOf('LimiteDeTentativasGuard');
  const posAuth = app.indexOf('useClass: AuthGuard');
  confere('o limite roda antes da autenticação', posLimite > 0 && posLimite < posAuth);

  const main = ler(join(RAIZ, 'main.ts'));
  /*
   * OS DOIS ANALISADORES, e não "algum com teto". A primeira versão desta linha procurava
   * `useBodyParser` e `64kb` em qualquer lugar do arquivo — e passava com um dos dois
   * capado e o outro solto, que é exatamente o buraco que ela deveria achar.
   */
  confere('o corpo JSON tem teto', /useBodyParser\('json',\s*\{\s*limit:\s*'\d+kb'/.test(main));
  confere('o corpo de formulário tem teto', /useBodyParser\('urlencoded',\s*\{\s*limit:\s*'\d+kb'/.test(main));
  confere('os cabeçalhos de segurança estão postos', main.includes('X-Content-Type-Options') && main.includes('X-Frame-Options'));
}

console.log(falhas === 0 ? '\nOK: a segurança do aplicativo passou nas conferências que dá pra fazer aqui.' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
