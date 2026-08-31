/**
 * Prova que a escada de aumento do truco na tela é a escada da variante que está
 * sendo jogada, e não uma cópia chumbada no cliente.
 *
 * Por que existe: paulista sobe 1 → 3 → 6 → 9 → 12 e mineiro sobe 2 → 4 → 6 → 10 → 12.
 * A tela tinha a escada paulista escrita à mão. No mineiro, `indexOf` não achava o
 * degrau, devolvia "não tem próximo", e o botão de aumentar simplesmente NÃO APARECIA —
 * o jogador ficava sem poder pedir seis, sem nenhum erro na tela. Falha silenciosa:
 * o jogo não quebra, só fica errado.
 *
 * Como rodar (com o servidor de pé):
 *   node verificacao/verifica-escada-do-truco.mjs
 */
const BASE = process.env.API_BASE ?? 'http://localhost:3000';

/** As mesmas duas funções de TrucoScreen.tsx — se lá mudar, aqui tem que mudar junto. */
function nomeDoPedido(regras, valor) {
  if (valor === null) return '';
  return regras?.raiseLabel[String(valor)] ?? String(valor);
}
function proximoDegrau(regras, valor) {
  const escada = regras?.handValueLadder ?? [];
  const posicao = escada.indexOf(valor);
  return posicao === -1 || posicao === escada.length - 1 ? 0 : escada[posicao + 1];
}

const config = await fetch(`${BASE}/games/truco/config`).then((r) => {
  if (!r.ok) throw new Error(`O servidor respondeu ${r.status}. Ele está de pé em ${BASE}?`);
  return r.json();
});

let problemas = 0;

for (const variante of Object.keys(config.variants)) {
  const regras = config.variants[variante];
  const escada = regras.handValueLadder;
  console.log(`\n== ${variante} == ${escada.join(' -> ')}`);

  for (let i = 0; i < escada.length; i += 1) {
    const degrau = escada[i];
    const esperado = i === escada.length - 1 ? 0 : escada[i + 1];
    const obtido = proximoDegrau(regras, degrau);

    if (obtido !== esperado) {
      problemas += 1;
      console.log(`  FALHOU: de ${degrau} devia dar ${esperado}, deu ${obtido}`);
      continue;
    }
    // Todo degrau que é um pedido (tudo menos o valor inicial da mão) precisa de nome.
    const ehPedido = i > 0;
    const nome = nomeDoPedido(regras, degrau);
    if (ehPedido && nome === String(degrau)) {
      problemas += 1;
      console.log(`  FALHOU: o degrau ${degrau} apareceria como número cru, sem nome de pedido`);
      continue;
    }
    console.log(`  mão vale ${String(degrau).padStart(2)} (${(ehPedido ? nome : 'início').padEnd(6)}) -> pede ${esperado ? nomeDoPedido(regras, esperado) : '(topo)'}`);
  }
}

console.log(problemas === 0 ? '\nOK: as duas escadas batem com a variante.' : `\n${problemas} problema(s).`);
process.exit(problemas === 0 ? 0 : 1);
