/**
 * Prova que o curinga do site não engoliu nenhuma rota da API.
 *
 * Por que existe: quando o servidor entrega o app web, ele registra um `@Get('*')` que
 * devolve o index.html. O Nest casa rota na ordem de registro, então QUALQUER módulo
 * declarado depois do SiteModule vira inalcançável — e o modo como isso falha é
 * traiçoeiro: a rota responde 200, com HTML, e o app quebra num
 * "Cannot read properties of undefined" longe da causa. Nada aparece no log do servidor.
 *
 * Foi assim que /amigos e /amigos/pendentes pararam de funcionar sem ninguém notar.
 *
 * Como rodar (com o servidor de pé e o site publicado em app/dist):
 *   npx ts-node verificacao/verifica-rotas.ts
 */

const BASE = process.env.API_URL ?? 'http://localhost:3000';

/**
 * Uma rota de cada módulo que fala HTTP. Rota nova de módulo novo entra aqui.
 *
 * Atenção ao escrever: caminho ERRADO também aparece como ENGOLIDA, porque rota que não
 * existe cai no curinga do site por definição. Se acusar, confira primeiro o
 * @Controller/@Get de verdade antes de sair mexendo na ordem dos módulos.
 */
const ROTAS: { caminho: string; publica?: boolean }[] = [
  { caminho: '/games/slots/config', publica: true },
  { caminho: '/games/roleta/config', publica: true },
  { caminho: '/games/blackjack/config', publica: true },
  { caminho: '/games/bacara/config', publica: true },
  { caminho: '/games/banca-francesa/config', publica: true },
  { caminho: '/games/bac-bo/config', publica: true },
  { caminho: '/games/stock-market/config', publica: true },
  { caminho: '/games/truco/config', publica: true },
  { caminho: '/games/domino/config', publica: true },
  { caminho: '/games/poker/config', publica: true },
  { caminho: '/wallet/saldo' },
  { caminho: '/wallet/historico' },
  { caminho: '/lobby/ganhos-recentes' },
  { caminho: '/torneios', publica: true },
  { caminho: '/amigos' },
  { caminho: '/amigos/pendentes' },
  { caminho: '/store/pacotes', publica: true },
];

async function main() {
  let falhas = 0;

  for (const rota of ROTAS) {
    const resposta = await fetch(`${BASE}${rota.caminho}`);
    const corpo = await resposta.text();
    const ehHtml = corpo.trimStart().toLowerCase().startsWith('<!doctype html');

    if (ehHtml) {
      console.log(`ENGOLIDA  ${rota.caminho} → devolveu o index.html (status ${resposta.status})`);
      falhas += 1;
      continue;
    }

    /*
     * Sem token, rota protegida TEM que responder 401. Se responder 200, o curinga não
     * engoliu — mas o guard furou, que é pior ainda.
     */
    const esperado = rota.publica ? 200 : 401;
    if (resposta.status !== esperado) {
      console.log(`STATUS    ${rota.caminho} → ${resposta.status}, esperado ${esperado}`);
      falhas += 1;
      continue;
    }

    console.log(`ok        ${rota.caminho} → ${resposta.status}`);
  }

  console.log(
    falhas === 0
      ? `\n${ROTAS.length} rotas conferidas, nenhuma engolida pelo site.`
      : `\n${falhas} de ${ROTAS.length} rotas com problema.`,
  );
  process.exit(falhas === 0 ? 0 : 1);
}

main();
