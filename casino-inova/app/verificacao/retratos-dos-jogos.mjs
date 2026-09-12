/**
 * RETRATOS DOS DEZ JOGOS, no tamanho de um iPhone.
 *
 *   BASE=http://localhost:3000 CONTA=… SENHA=… node verificacao/retratos-dos-jogos.mjs <pasta>
 *
 * Não é conferência: é EVIDÊNCIA. A frente GAME PRESENTATION REBUILD precisa de antes e
 * depois lado a lado, e "antes" tem que ser uma imagem, não uma lembrança.
 *
 * O viewport é 390x844 @3x — iPhone 14/15 —, que é onde o jogo é jogado de verdade.
 */
const SAIDA = process.argv[2] || 'retratos';
const BASE = process.env.BASE || 'http://localhost:3000';
const CONTA = process.env.CONTA || 'retrato@inova.test';
const SENHA = process.env.SENHA || 'senha-de-teste-123';

const { mkdir, readFile, writeFile } = await import('node:fs/promises');
/*
 * A SESSÃO É GUARDADA ENTRE RODADAS DESTE SCRIPT.
 *
 * O servidor limita dez entradas por cinco minutos, por IP e por e-mail — trava que
 * existe pra valer e que não se desliga pra tirar foto. Rodando o script três vezes
 * seguidas pra comparar antes e depois, a terceira levava 429 e todos os dez retratos
 * falhavam. Guardar o estado do navegador resolve pelo caminho certo: entra uma vez e
 * reaproveita, que é o que o jogador também faz.
 */
const SESSAO = process.env.SESSAO || '/tmp/retratos-sessao.json';
const pw = await import(process.env.PLAYWRIGHT || 'playwright');
const { chromium } = pw.default ?? pw;

await mkdir(SAIDA, { recursive: true });
const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM || undefined,
  args: ['--no-proxy-server'],
});
const guardada = await readFile(SESSAO, 'utf8').then(JSON.parse).catch(() => undefined);
const contexto = await nav.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  storageState: guardada,
});
const pagina = await contexto.newPage();

/**
 * Os dez jogos, pelo `aria-label` do cartão no lobby.
 *
 * Pelo rótulo VISÍVEL não dá: o lobby escreve "Contra a casa" em cinco cartões e "Mesa com
 * gente" em quatro, e o nome do jogo está na arte. O `aria-label` é o que o leitor de tela
 * anuncia — ele nomeia o jogo, e é por isso que ele serve aqui.
 */
const JOGOS = [
  ['caca-niqueis', 'Caça-Níqueis'],
  ['roleta', 'Roleta'],
  ['blackjack', 'Blackjack'],
  ['bacara', 'Bacará'],
  ['banca-francesa', 'Banca Francesa'],
  ['bac-bo', 'Bac Bo'],
  ['stock-market', 'Stock Market'],
  ['truco', 'Truco'],
  ['domino', 'Dominó'],
  ['poker', 'Poker'],
];

/**
 * O cartão de um jogo, pelo começo do rótulo.
 *
 * O rótulo inteiro não serve: A MESA EM DESTAQUE MUDA. O cartão em destaque ganha um
 * sufixo (", em destaque") e o destaque gira entre os jogos, então uma lista de rótulos
 * exatos acerta hoje e erra amanhã — foi assim que roleta e blackjack começaram a falhar
 * alternadamente, sem ninguém ter mexido em nada.
 */
function cartaoDoJogo(pagina, jogo) {
  return pagina.getByLabel(new RegExp(`^${jogo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} —`)).first();
}

await pagina.goto(BASE, { waitUntil: 'networkidle', timeout: 120000 });
await pagina.waitForTimeout(3000);

/* Entrar. Se já estiver dentro, os campos não existem e o passo é pulado. */
const campos = pagina.locator('input');
if (await campos.count() >= 2) {
  await campos.first().fill(CONTA);
  await campos.nth(1).fill(SENHA);
  await pagina.getByText('Entrar', { exact: true }).last().click();
  await pagina.waitForTimeout(6000);
  await writeFile(SESSAO, JSON.stringify(await contexto.storageState()));
}

/*
 * A RECOMPENSA DIÁRIA ABRE POR CIMA DO SALÃO no primeiro acesso do dia, e ela cobre os
 * cartões. Fechar com "Agora não" é o que um jogador faria — e sem isso o retrato é do
 * modal, e não do jogo.
 */
async function fecharORecado() {
  const agoraNao = pagina.getByText('Agora não', { exact: false }).first();
  if ((await agoraNao.count()) > 0 && (await agoraNao.isVisible().catch(() => false))) {
    await agoraNao.click().catch(() => undefined);
    await pagina.waitForTimeout(1500);
  }
}
await fecharORecado();

const capturados = [];
for (const [arquivo, rotulo] of JOGOS) {
  try {
    /* Volta pro lobby entre um jogo e outro. */
    await pagina.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
    await pagina.waitForTimeout(2500);
    await fecharORecado();

    /*
     * DUAS TENTATIVAS, com o recado fechado entre elas.
     *
     * O salão sobe modal sozinho (recompensa diária, subida de nível), e nem sempre no
     * mesmo instante: com a sessão reaproveitada entre rodadas, ele aparecia DEPOIS do
     * primeiro `fecharORecado` e engolia o toque no cartão. Roleta e blackjack falhavam
     * assim, alternadamente. Fechar de novo e repetir o toque resolve sem esconder nada.
     */
    const cartao = cartaoDoJogo(pagina, rotulo);
    try {
      await cartao.click({ timeout: 8000 });
    } catch {
      await fecharORecado();
      await cartao.click({ timeout: 12000 });
    }
    await pagina.waitForTimeout(2500);

    /*
     * A TELA DE MODO, quando existe. Truco, dominó, pôquer e banca francesa passam por
     * ela — e o retrato tem que ser do JOGO, não do menu que leva a ele.
     *
     * O caminho escolhido é sempre o PRIMEIRO modo da lista, que é o mais simples de
     * cada jogo (1x1 contra o computador, sozinho contra a casa). É o que abre mais
     * rápido e é o que o jogador destrava primeiro.
     */
    const modos = ['Sozinho', 'Contra o computador', '1 x 1', 'Cara a cara', 'Contra a casa'];
    for (const modo of modos) {
      const opcao = pagina.getByLabel(new RegExp(modo, 'i')).first();
      if ((await opcao.count()) > 0 && (await opcao.isVisible().catch(() => false))) {
        await opcao.click().catch(() => undefined);
        await pagina.waitForTimeout(3500);
        break;
      }
    }

    /*
     * O TUTORIAL ABRE SOZINHO na primeira vez de cada jogo, e ele cobre a mesa inteira.
     * Fechar é o que o jogador faz — e sem isso o retrato é do tutorial, não do jogo.
     */
    const entendi = pagina.getByText('Entendi, quero jogar', { exact: false }).first();
    if ((await entendi.count()) > 0 && (await entendi.isVisible().catch(() => false))) {
      await entendi.click().catch(() => undefined);
      await pagina.waitForTimeout(2500);
    }

    /*
     * ENTRA NA PARTIDA, quando o jogo tem uma porta antes da mesa.
     *
     * Truco, dominó e pôquer abrem numa tela de entrada — escolher o buy-in e começar. O
     * retrato dessa tela é o retrato do vestíbulo, não do jogo: as peças de dominó, as
     * cartas e a corrente só existem depois. Um toque em "Começar partida" põe a mesa em
     * jogo, que é o que precisa ser olhado.
     */
    const comecar = pagina.getByText('Começar partida', { exact: false }).first();
    if ((await comecar.count()) > 0 && (await comecar.isVisible().catch(() => false))) {
      await comecar.click().catch(() => undefined);
      await pagina.waitForTimeout(4000);
    }

    await pagina.screenshot({ path: `${SAIDA}/${arquivo}.png` });
    capturados.push(arquivo);
    console.log(`  ok   ${rotulo}`);
  } catch (erro) {
    console.log(`  FALHOU  ${rotulo} — ${String(erro).split('\n')[0].slice(0, 120)}`);
  }
}

await nav.close();
console.log(`\n${capturados.length} de ${JOGOS.length} retratos em ${SAIDA}/\n`);
