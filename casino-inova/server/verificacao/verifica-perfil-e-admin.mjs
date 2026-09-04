/**
 * Confere identidade, perfil, XP e painel de admin contra o servidor de verdade.
 *
 *   node verificacao/verifica-perfil-e-admin.mjs
 *
 * 1. Quem está na lista de donos entra como admin — e mais ninguém entra.
 * 2. Toda conta ganha um código público de 8 dígitos, único, e ele não muda.
 * 3. Dá pra trocar apelido e retrato; retrato inventado é recusado.
 * 4. Jogar dá XP e enche a barra. (Isto não existia: nada somava XP.)
 * 5. O admin acha alguém por e-mail, por id e pelo código, e credita fichas.
 * 6. Jogador comum NÃO alcança nada disso.
 */
const BASE = 'http://localhost:3000';
let problemas = 0;
const falhar = (m) => { problemas += 1; console.log(`FALHOU: ${m}`); };
const ok = (m) => console.log(`ok — ${m}`);

const chamar = async (rota, { metodo = 'GET', corpo, token } = {}) => {
  const r = await fetch(`${BASE}${rota}`, {
    method: metodo,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const txt = await r.text();
  let json; try { json = JSON.parse(txt); } catch { json = txt; }
  return { ok: r.ok, status: r.status, corpo: json };
};
const cadastrar = async (email, nome) =>
  (await chamar('/auth/cadastrar', { metodo: 'POST', corpo: { email, senha: 'senha-de-teste-123', nome } })).corpo;

const marca = Date.now();

// --- 1. o dono entra admin; um qualquer, não ---
const dono = await cadastrar(`wly.vianna+${marca}@gmail.com`, 'Nao Dono');
const donoDeVerdade = await cadastrar('wly.vianna@gmail.com', 'Dono').catch(() => null);
const comum = await cadastrar(`comum-${marca}@teste.local`, 'Comum');

{
  // O e-mail exato da lista vira admin; um parecido, não.
  const eu = donoDeVerdade?.user ?? (await chamar('/users/me', { token: (await chamar('/auth/entrar', { metodo: 'POST', corpo: { email: 'wly.vianna@gmail.com', senha: 'senha-de-teste-123' } })).corpo.token })).corpo;
  if (eu?.role !== 'admin') falhar(`o e-mail da lista entrou como "${eu?.role}", devia ser admin`);
  else ok(`wly.vianna@gmail.com entra como admin (papel "${eu.role}")`);

  if (dono.user.role === 'admin') falhar('um e-mail PARECIDO com o do dono virou admin — a conferência está frouxa');
  else ok(`e-mail parecido (com +${marca}) NÃO vira admin`);
  if (comum.user.role !== 'jogador') falhar(`conta comum nasceu como "${comum.user.role}"`);
}

const tokenAdmin = donoDeVerdade?.token ?? (await chamar('/auth/entrar', { metodo: 'POST', corpo: { email: 'wly.vianna@gmail.com', senha: 'senha-de-teste-123' } })).corpo.token;
const tokenComum = comum.token;

// --- 2. código público ---
let codigoDoComum;
{
  const eu = (await chamar('/users/me', { token: tokenComum })).corpo;
  codigoDoComum = eu.publicCode;
  if (!/^\d{8}$/.test(codigoDoComum ?? '')) falhar(`código público "${codigoDoComum}" não são 8 dígitos`);
  else ok(`código público gerado: ${codigoDoComum.slice(0, 4)}-${codigoDoComum.slice(4)}`);

  const denovo = (await chamar('/users/me', { token: tokenComum })).corpo;
  if (denovo.publicCode !== codigoDoComum) falhar(`o código mudou entre duas leituras: ${codigoDoComum} -> ${denovo.publicCode}`);
  else ok('o código não muda de uma leitura pra outra');

  // Dez contas novas, dez códigos diferentes.
  const codigos = new Set();
  for (let i = 0; i < 10; i += 1) {
    const c = await cadastrar(`codigo-${marca}-${i}@teste.local`, `C${i}`);
    codigos.add((await chamar('/users/me', { token: c.token })).corpo.publicCode);
  }
  if (codigos.size !== 10) falhar(`10 contas novas geraram ${codigos.size} códigos diferentes`);
  else ok('10 contas novas, 10 códigos diferentes');
}

// --- 3. apelido e retrato ---
{
  const avatares = (await chamar('/users/avatares', { token: tokenComum })).corpo;
  if (!Array.isArray(avatares) || avatares.length === 0) falhar('a lista de retratos veio vazia');

  const mudou = await chamar('/users/me', { metodo: 'PATCH', token: tokenComum, corpo: { name: 'Apelido Novo', avatar: avatares[2] } });
  if (!mudou.ok) falhar(`não deu pra mudar o perfil: ${JSON.stringify(mudou.corpo)}`);
  else if (mudou.corpo.name !== 'Apelido Novo' || mudou.corpo.avatar !== avatares[2]) {
    falhar(`o perfil voltou "${mudou.corpo.name}" / "${mudou.corpo.avatar}"`);
  } else ok(`apelido e retrato mudados: "${mudou.corpo.name}", retrato "${mudou.corpo.avatar}"`);

  const inventado = await chamar('/users/me', { metodo: 'PATCH', token: tokenComum, corpo: { avatar: 'retrato-que-nao-existe' } });
  if (inventado.ok) falhar('aceitou um retrato que não existe');
  else ok('retrato inventado é recusado');

  const vazio = await chamar('/users/me', { metodo: 'PATCH', token: tokenComum, corpo: { name: ' ' } });
  if (vazio.ok) falhar('aceitou apelido vazio');
  else ok('apelido vazio é recusado');

  const gigante = await chamar('/users/me', { metodo: 'PATCH', token: tokenComum, corpo: { name: 'x'.repeat(300) } });
  if (gigante.ok && gigante.corpo.name.length > 20) falhar(`apelido de ${gigante.corpo.name.length} letras passou`);
  else ok('apelido gigante é cortado');
}

// --- 4. jogar dá XP ---
{
  const antes = (await chamar('/users/me', { token: tokenComum })).corpo;
  for (let i = 0; i < 12; i += 1) {
    await chamar('/games/banca-francesa/apostar', {
      metodo: 'POST', token: tokenComum,
      corpo: { bets: [{ type: 'grande', amount: 500 }], actionId: `xp-${marca}-${i}` },
    });
  }
  const depois = (await chamar('/users/me', { token: tokenComum })).corpo;
  const ganho = (depois.level - antes.level) * antes.xpToNextLevel + (depois.xp - antes.xp);
  console.log(`  XP: ${antes.xp} (nível ${antes.level}) -> ${depois.xp} (nível ${depois.level}) em 12 rodadas de 500`);
  if (depois.xp === antes.xp && depois.level === antes.level) falhar('jogou 12 rodadas e o XP não mexeu — a barra continua parada');
  else ok(`jogar dá XP: subiu ${ganho} em 12 rodadas`);
  if (typeof depois.xpToNextLevel !== 'number' || depois.xpToNextLevel <= 0) falhar('o servidor não disse quanto falta pro próximo nível');
  else ok(`o servidor diz a curva: ${depois.xpToNextLevel} XP pro nível ${depois.level + 1}`);
}

// --- 5. o admin acha e credita ---
{
  const eu = (await chamar('/users/me', { token: tokenComum })).corpo;
  for (const [comoChamam, termo] of [['e-mail', `comum-${marca}@teste.local`], ['id', eu.id], ['código', `${codigoDoComum.slice(0,4)}-${codigoDoComum.slice(4)}`]]) {
    const achou = await chamar(`/admin/usuarios/procurar?termo=${encodeURIComponent(termo)}`, { token: tokenAdmin });
    if (!achou.ok || achou.corpo.usuario?.id !== eu.id) falhar(`procurar por ${comoChamam} ("${termo}") não achou a pessoa certa: ${JSON.stringify(achou.corpo).slice(0,150)}`);
    else ok(`procurar por ${comoChamam} acha (saldo ${achou.corpo.balance})`);
  }

  const saldoAntes = (await chamar(`/admin/usuarios/procurar?termo=${encodeURIComponent(`comum-${marca}@teste.local`)}`, { token: tokenAdmin })).corpo.balance;
  const deu = await chamar('/admin/suporte/conceder-fichas', {
    metodo: 'POST', token: tokenAdmin,
    corpo: { targetUserId: `comum-${marca}@teste.local`, chips: 25_000, reason: 'teste do painel' },
  });
  if (!deu.ok) falhar(`não deu pra creditar por e-mail: ${JSON.stringify(deu.corpo)}`);
  else if (deu.corpo.newBalance !== saldoAntes + 25_000) falhar(`saldo ficou ${deu.corpo.newBalance}, esperava ${saldoAntes + 25_000}`);
  else ok(`creditou 25.000 usando só o e-mail: ${saldoAntes} -> ${deu.corpo.newBalance}`);

  const quebrado = await chamar('/admin/suporte/conceder-fichas', { metodo: 'POST', token: tokenAdmin, corpo: { targetUserId: eu.id, chips: 10.5 } });
  if (quebrado.ok) falhar('aceitou creditar meia ficha');
  else ok('meia ficha é recusada');
}

// --- 6. jogador comum não alcança o painel ---
{
  for (const rota of ['/admin/usuarios', `/admin/usuarios/procurar?termo=${encodeURIComponent('wly.vianna@gmail.com')}`]) {
    const r = await chamar(rota, { token: tokenComum });
    if (r.ok) falhar(`jogador comum conseguiu ler ${rota}`);
  }
  const r = await chamar('/admin/suporte/conceder-fichas', { metodo: 'POST', token: tokenComum, corpo: { targetUserId: 'u1', chips: 1_000_000 } });
  if (r.ok) falhar('JOGADOR COMUM CONSEGUIU SE DAR FICHAS');
  else ok('jogador comum não alcança o painel nem consegue se dar fichas');
}

console.log(problemas === 0 ? '\nTUDO OK' : `\n${problemas} PROBLEMA(S).`);
process.exit(problemas === 0 ? 0 : 1);
