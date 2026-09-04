import { RelogioDaSala } from './relogio-da-sala';
import { RegistroDeEventos } from './registro-de-eventos';
import { ReconexaoService, JANELA_DE_RECONEXAO_MS } from './reconexao.service';
import { aceitaAposta, podeIrPara, rodadaDecidida } from './fases';

/**
 * Confere o núcleo da sala: fases, relógio, log de eventos e janela de reconexão.
 *
 * São as quatro peças que os dez jogos vão compartilhar, então um erro aqui vira erro
 * em dez lugares — e são justamente peças cujo defeito não aparece jogando: uma
 * transição de fase aceita indevidamente só quebra na rodada em que alguém tentar, e
 * uma reconexão que perde eventos monta a mesa errada sem dar erro nenhum.
 *
 *   npx ts-node src/modules/games/core/verifica-nucleo.ts
 */
let problemas = 0;
const falhar = (m: string) => { problemas += 1; console.log(`FALHOU: ${m}`); };

// --- 1. Máquina de fases: só aceita as transições da tabela ---
{
  if (!podeIrPara('APOSTAS_ABERTAS', 'APOSTAS_FECHADAS')) falhar('fechar apostas devia ser permitido');
  if (podeIrPara('APOSTAS_ABERTAS', 'PAGAMENTO')) falhar('pular direto pro pagamento devia ser proibido');
  if (podeIrPara('RODADA_FECHADA', 'SORTEIO')) falhar('sortear com a rodada fechada devia ser proibido');
  if (!podeIrPara('SORTEIO', 'APURACAO')) falhar('slots/roleta precisam pular ACOES_DOS_JOGADORES');
  if (!podeIrPara('SORTEIO', 'ACOES_DOS_JOGADORES')) falhar('blackjack precisa entrar em ACOES_DOS_JOGADORES');
  // O lançamento nulo da banca francesa: o dado saiu, não decidiu, e a MESMA rodada
  // volta a aceitar aposta. Sem esta transição não existe janela pra aumentar ou desistir.
  if (!podeIrPara('SORTEIO', 'APOSTAS_ABERTAS')) falhar('o lançamento nulo precisa poder reabrir as apostas');
  if (podeIrPara('APOSTAS_FECHADAS', 'APOSTAS_ABERTAS')) falhar('reabrir aposta sem lançar o dado devia ser proibido');

  if (!aceitaAposta('APOSTAS_ABERTAS')) falhar('APOSTAS_ABERTAS devia aceitar aposta');
  for (const fase of ['APOSTAS_FECHADAS', 'SORTEIO', 'APURACAO', 'PAGAMENTO', 'RODADA_FECHADA'] as const) {
    if (aceitaAposta(fase)) falhar(`${fase} não pode aceitar aposta`);
  }
  if (!rodadaDecidida('PAGAMENTO')) falhar('PAGAMENTO já é rodada decidida');
  if (rodadaDecidida('APOSTAS_ABERTAS')) falhar('APOSTAS_ABERTAS não é rodada decidida');
  console.log('fases: só as transições da tabela passam, e aposta só entra em APOSTAS_ABERTAS — ok');
}

// --- 2. Relógio: prazo absoluto, versão subindo, transição inválida recusada ---
{
  const relogio = new RelogioDaSala();
  if (relogio.fase !== 'ESPERANDO_JOGADORES') falhar('a mesa devia nascer esperando jogadores');
  if (relogio.terminaEm !== null) falhar('fase sem prazo devia ter terminaEm nulo');
  if (relogio.expirou()) falhar('fase sem prazo não pode expirar');

  const v0 = relogio.versao;
  relogio.irPara('RODADA_ABERTA');
  relogio.irPara('APOSTAS_ABERTAS', 15_000);
  if (relogio.versao !== v0 + 2) falhar(`a versão foi de ${v0} pra ${relogio.versao}, devia subir 2`);

  const restante = relogio.restanteMs();
  if (restante === null || restante > 15_000 || restante < 14_000) falhar(`restante ${restante}, esperava perto de 15000`);
  if (relogio.expirou()) falhar('acabou de abrir e já expirou');
  // O futuro chega: a mesma checagem, com o relógio adiantado.
  if (!relogio.expirou(Date.now() + 16_000)) falhar('devia ter expirado 16s depois');

  let recusou = false;
  try { relogio.irPara('PAGAMENTO'); } catch { recusou = true; }
  if (!recusou) falhar('deixou pular de APOSTAS_ABERTAS pra PAGAMENTO');
  if (relogio.fase !== 'APOSTAS_ABERTAS') falhar('a fase mudou mesmo com a transição recusada');
  console.log('relógio: prazo absoluto, versão sobe a cada mudança, pulo indevido recusado — ok');
}

// --- 3. Log de eventos: numeração e recuperação por "vi até o N" ---
{
  const log = new RegistroDeEventos();
  const mesa = 'mesa-1';
  for (let i = 1; i <= 5; i += 1) log.anotar(mesa, 'r1', 'APOSTA', { i });

  if (log.seqAtual(mesa) !== 5) falhar(`seq atual ${log.seqAtual(mesa)}, esperava 5`);

  const faltando = log.desde(mesa, 2);
  if (!faltando || faltando.length !== 3) falhar(`quem viu até 2 devia receber 3 eventos, recebeu ${faltando?.length}`);
  if (faltando && faltando[0].seq !== 3) falhar(`o primeiro que falta é o 3, veio ${faltando[0].seq}`);

  const nada = log.desde(mesa, 5);
  if (!nada || nada.length !== 0) falhar('quem está em dia não devia receber nada');

  // Mesas diferentes têm numeração própria.
  log.anotar('mesa-2', 'r1', 'APOSTA', {});
  if (log.seqAtual('mesa-2') !== 1) falhar('a numeração devia ser por mesa');

  // Pedaço velho demais: devolve null pra o jogo mandar o estado inteiro.
  const muitoVelho = log.desde(mesa, -1);
  if (muitoVelho !== null) falhar('pedido inválido devia devolver null');
  console.log('log de eventos: numeração por mesa, recupera só o que faltou, avisa quando não dá — ok');
}

// --- 4. Reconexão: segura o assento na janela, solta depois ---
{
  const reconexao = new ReconexaoService();
  reconexao.registrarQueda('mesa-1', 'u1', 3, 42);

  if (!reconexao.estaAusente('mesa-1', 'u1')) falhar('quem caiu devia constar como ausente');
  if (reconexao.estaAusente('mesa-1', 'u2')) falhar('quem não caiu não pode constar como ausente');

  const voltou = reconexao.reassumir('mesa-1', 'u1');
  if (!voltou) falhar('devia conseguir reassumir dentro da janela');
  if (voltou && voltou.assento !== 3) falhar(`voltou pro assento ${voltou.assento}, era o 3`);
  if (voltou && voltou.ultimoEventoVisto !== 42) falhar('perdeu a marca de até onde a pessoa tinha visto');
  if (reconexao.reassumir('mesa-1', 'u1')) falhar('reassumir duas vezes devia falhar na segunda');

  // Janela estourada: o assento é liberado e o jogo é avisado.
  reconexao.registrarQueda('mesa-1', 'u9', 1, 10);
  const daquiAPouco = Date.now() + JANELA_DE_RECONEXAO_MS + 1_000;
  const perdidos = reconexao.expirados(daquiAPouco);
  if (perdidos.length !== 1 || perdidos[0].userId !== 'u9') falhar('quem estourou a janela devia aparecer em expirados');
  if (reconexao.reassumir('mesa-1', 'u9')) falhar('depois de expirar não pode mais reassumir');
  console.log(`reconexão: assento guardado por ${JANELA_DE_RECONEXAO_MS / 1000}s, com o assento e a marca de leitura — ok`);
}

console.log(problemas === 0 ? '\nOK: o núcleo de sala está de pé.' : `\n${problemas} problema(s).`);
process.exit(problemas === 0 ? 0 : 1);
