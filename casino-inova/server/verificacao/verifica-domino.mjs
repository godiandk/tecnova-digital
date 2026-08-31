/**
 * Confere a regra de abertura do dominó contra o servidor de verdade: quem tem a maior
 * dupla abre, e não dá pra abrir com outra peça.
 */
const BASE = 'http://localhost:3000';
const post = async (rota, corpo, token) => {
  const r = await fetch(`${BASE}${rota}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(corpo ?? {}),
  });
  const t = await r.text();
  return { ok: r.ok, status: r.status, corpo: JSON.parse(t) };
};

const conta = await post('/auth/cadastrar', { email: `dm-${Date.now()}@teste.local`, senha: 'senha-de-teste-123', nome: 'Auditor DM' });
const token = conta.corpo.token ?? conta.corpo.accessToken;

let abriuJogador = 0, abriuBot = 0, recusas = 0, problemas = 0;
const falhar = (m) => { problemas += 1; console.log(`FALHOU: ${m}`); };
const soma = (t) => t.a + t.b;
const nota = (t) => (t.a === t.b ? 100 + t.a : soma(t));

for (let i = 0; i < 20; i += 1) {
  const nova = await post('/games/domino/nova-partida', { buyIn: 100 }, token);
  if (!nova.ok) break;
  const m = nova.corpo;

  if (m.aberturaObrigatoria) {
    abriuJogador += 1;
    const obr = m.aberturaObrigatoria;
    // A peça indicada tem que ser a melhor da MINHA mão...
    const melhorMinha = m.playerHand.reduce((a, b) => (nota(b) > nota(a) ? b : a));
    if (nota(obr) !== nota(melhorMinha)) falhar(`mandou abrir com ${obr.a}-${obr.b}, mas a melhor da mão é ${melhorMinha.a}-${melhorMinha.b}`);
    // ...e o tabuleiro tem que estar vazio.
    if (m.boardTiles.length !== 0) falhar('o jogador vai abrir mas a mesa já tem peça');

    // Tentar abrir com outra peça tem que ser recusado.
    const outra = m.playerHand.find((t) => !(t.a === obr.a && t.b === obr.b));
    if (outra) {
      const tentativa = await post('/games/domino/jogar-peca', { tile: outra }, token);
      if (tentativa.ok) falhar(`deixou abrir com ${outra.a}-${outra.b} em vez de ${obr.a}-${obr.b}`);
      else recusas += 1;
    }
  } else {
    abriuBot += 1;
    // O bot abriu: tem que haver exatamente uma peça na mesa, e nenhuma da minha mão
    // pode ser melhor do que ela.
    if (m.boardTiles.length !== 1) falhar(`o bot abriu mas a mesa tem ${m.boardTiles.length} peças`);
    else {
      const naMesa = m.boardTiles[0];
      const melhorMinha = m.playerHand.reduce((a, b) => (nota(b) > nota(a) ? b : a));
      if (nota(melhorMinha) > nota(naMesa)) falhar(`o bot abriu com ${naMesa.a}-${naMesa.b} mas eu tinha ${melhorMinha.a}-${melhorMinha.b}`);
    }
  }
  // Encerra a partida pra poder começar outra. Precisa reler o estado depois da
  // abertura, senão a mão em memória fica velha e a jogada seguinte não encaixa.
  let estado = m;
  if (m.aberturaObrigatoria) {
    const depois = await post('/games/domino/jogar-peca', { tile: m.aberturaObrigatoria }, token);
    if (depois.ok) estado = depois.corpo;
  }
  for (let v = 0; v < 60 && !estado.finished; v += 1) {
    const mao = estado.playerHand ?? [];
    const jogavel = mao.find(
      (t) => t.a === estado.leftEnd || t.b === estado.leftEnd || t.a === estado.rightEnd || t.b === estado.rightEnd,
    );
    const r = jogavel
      ? await post('/games/domino/jogar-peca',
          { tile: jogavel, end: (jogavel.a === estado.leftEnd || jogavel.b === estado.leftEnd) ? 'esquerda' : 'direita' }, token)
      : await post('/games/domino/passar', null, token);
    if (!r.ok) { console.log('  (parou de jogar:', JSON.stringify(r.corpo).slice(0, 90), ')'); break; }
    estado = r.corpo;
  }
  if (!estado.finished) falhar('não consegui terminar a partida — a próxima não vai começar');
}

console.log(`\npartidas: ${abriuJogador + abriuBot}  ·  abriu o jogador: ${abriuJogador}  ·  abriu o bot: ${abriuBot}`);
console.log(`tentativas de abrir com a peça errada, recusadas: ${recusas}`);
console.log(problemas === 0 ? '\nOK: abre quem tem a maior peça, e só com ela.' : `\n${problemas} problema(s).`);
process.exit(problemas === 0 ? 0 : 1);
