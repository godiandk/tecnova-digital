/**
 * O REGISTRO — uma linha de JSON por acontecimento.
 *
 * ANTES DISTO, O SERVIDOR NÃO TINHA REGISTRO NENHUM. Cinco `console.log` no código todo,
 * e três deles só dizem em que porta o servidor subiu. Quando alguém escreve "girei e não
 * me pagaram", não havia o que ler: só o extrato, que diz o que aconteceu com o dinheiro
 * e não diz por quê, nem em que pedido, nem se deu erro no caminho.
 *
 * As tabelas do P0.2 (`rodadas` e `eventos_da_rodada`) contam a história de UMA rodada,
 * de dentro. O que falta é a camada de fora: qual pedido, de qual sessão, quanto demorou,
 * o que estourou. Este arquivo é essa camada.
 *
 * POR QUE UMA LINHA DE JSON E NÃO TEXTO BONITO. Porque texto bonito não se filtra. Com
 * uma linha por evento e sempre as mesmas chaves, achar uma reclamação é
 * `grep '"rodada":"abc"' | jq` — e isso funciona no terminal, num arquivo, ou em qualquer
 * coletor que venha depois, sem reescrever nada.
 *
 * A REGRA QUE MANDA NESTE ARQUIVO: registro nunca vaza segredo e nunca quebra o jogo.
 * Ele é atravessado por todo pedido, então um erro aqui derruba tudo — por isso ele nunca
 * lança, nunca modifica o que recebe, e corta o que for grande demais em vez de tentar
 * escrever um objeto de dois megabytes numa linha.
 */

/**
 * Chaves que NUNCA saem, em qualquer profundidade.
 *
 * A comparação é por pedaço do nome, minúsculo: `idToken`, `ID_TOKEN`, `refresh_token` e
 * `tokenDeAcesso` caem todos em `token`. É deliberado que a lista pegue demais — o custo
 * de esconder um campo inofensivo é ler `[escondido]` num registro; o custo de deixar
 * passar um token é uma conta invadida.
 */
const CHAVES_PROIBIDAS = [
  'senha', 'password', 'token', 'authorization', 'auth', 'secret', 'segredo',
  'jwt', 'cookie', 'session_id', 'sessionid', 'apikey', 'api_key', 'chave',
  'credential', 'credencial', 'assinatura', 'signature', 'private', 'privada',
  'email', 'cpf', 'telefone', 'phone', 'nascimento', 'endereco', 'address',
];

/**
 * Valores que se escondem sozinhos, pelo FORMATO, mesmo debaixo de uma chave inocente.
 *
 * Porque a lista de nomes acima só protege contra o que a gente lembrou de listar. Um
 * token guardado em `{ dados: { x: 'eyJhbGciOi...' } }` passaria batido — e é exatamente
 * assim que um segredo vaza: não pela chave chamada `token`, pela chave chamada `x`.
 */
const FORMATOS_PROIBIDOS: Array<[RegExp, string]> = [
  [/^ey[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\./, '[jwt escondido]'],
  [/^Bearer\s+\S+/i, '[bearer escondido]'],
  [/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/, '[email escondido]'],
  [/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, '[cpf escondido]'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, '[chave privada escondida]'],
];

/** Limites, pra uma linha de registro nunca virar um problema por si só. */
const LIMITE_DE_TEXTO = 500;
const LIMITE_DE_LISTA = 50;
const PROFUNDIDADE_MAXIMA = 6;

export type NivelDoRegistro = 'debug' | 'info' | 'aviso' | 'erro';

/**
 * O contexto padrão de toda linha.
 *
 * São estas quatro chaves que fazem o registro servir pra alguma coisa: com `rodada` se
 * puxa a rodada inteira das tabelas do P0.2; com `pedido` se juntam todas as linhas de
 * uma requisição; com `usuario` se acha a reclamação de uma pessoa; com `jogo` se
 * compara um jogo com outro.
 */
export interface ContextoDoRegistro {
  jogo?: string;
  rodada?: string;
  usuario?: string;
  sessao?: string;
  pedido?: string;
  ms?: number;
  [extra: string]: unknown;
}

/** Pra onde as linhas vão. Trocável, e é o que permite a verificação ler o que saiu. */
let escrever: (linha: string) => void = (linha) => process.stdout.write(`${linha}\n`);

/** Redireciona a saída — usado pela verificação. Devolve como estava. */
export function desviarOndeEscreve(destino: (linha: string) => void): () => void {
  const antes = escrever;
  escrever = destino;
  return () => { escrever = antes; };
}

/**
 * Esconde o que não pode sair, sem NUNCA tocar no objeto original.
 *
 * A cópia não é preciosismo: este objeto costuma ser o estado da rodada, e um registro
 * que apagasse o token de dentro dele estaria estragando o jogo pra escrever um log. Vale
 * também pra referência circular — um objeto que aponta pra si mesmo derrubaria o
 * `JSON.stringify` e, com ele, o pedido inteiro.
 */
export function esconderSegredos(valor: unknown, profundidade = 0, vistos = new Set<object>()): unknown {
  if (valor === null || valor === undefined) return valor;

  if (typeof valor === 'string') {
    for (const [formato, aviso] of FORMATOS_PROIBIDOS) {
      if (formato.test(valor)) return aviso;
    }
    return valor.length > LIMITE_DE_TEXTO
      ? `${valor.slice(0, LIMITE_DE_TEXTO)}… [+${valor.length - LIMITE_DE_TEXTO} caracteres]`
      : valor;
  }

  if (typeof valor === 'number' || typeof valor === 'boolean') return valor;
  if (typeof valor === 'bigint') return valor.toString();
  if (typeof valor === 'function') return '[função]';
  if (valor instanceof Date) return valor.toISOString();

  if (valor instanceof Error) {
    return {
      erro: valor.name,
      mensagem: esconderSegredos(valor.message, profundidade + 1, vistos),
      /* A pilha vai cortada: as três primeiras linhas dizem onde, o resto é ruído. */
      onde: (valor.stack ?? '').split('\n').slice(1, 4).map((l) => l.trim()),
    };
  }

  if (typeof valor !== 'object') return String(valor);
  if (profundidade >= PROFUNDIDADE_MAXIMA) return '[fundo demais]';

  /*
   * `vistos` guarda o CAMINHO até aqui, e não tudo que já foi visitado.
   *
   * A diferença aparece em `{ a: mesmoObjeto, b: mesmoObjeto }` — dois irmãos apontando
   * pro mesmo objeto, que é coisa comum (a mesma aposta referida em dois lugares). Sem
   * tirar da lista na volta, o segundo irmão sairia como "[referência circular]", e o
   * registro estaria mentindo sobre a forma do dado. Ciclo de verdade é o objeto aparecer
   * DENTRO DE SI MESMO, e é só isso que esta lista precisa pegar.
   */
  if (vistos.has(valor as object)) return '[referência circular]';
  vistos.add(valor as object);
  try {
    if (Array.isArray(valor)) {
      const cortada: unknown[] = valor.slice(0, LIMITE_DE_LISTA)
        .map((item) => esconderSegredos(item, profundidade + 1, vistos));
      if (valor.length > LIMITE_DE_LISTA) cortada.push(`[+${valor.length - LIMITE_DE_LISTA} itens]`);
      return cortada;
    }

    const saida: Record<string, unknown> = {};
    for (const [chave, dentro] of Object.entries(valor as Record<string, unknown>)) {
      const minuscula = chave.toLowerCase();
      if (CHAVES_PROIBIDAS.some((proibida) => minuscula.includes(proibida))) {
        saida[chave] = '[escondido]';
        continue;
      }
      saida[chave] = esconderSegredos(dentro, profundidade + 1, vistos);
    }
    return saida;
  } finally {
    vistos.delete(valor as object);
  }
}

/**
 * Escreve uma linha.
 *
 * Não lança NUNCA. Se escrever o registro falhar, o pedido tem que seguir: um jogo que
 * cai porque o log caiu trocou um problema pequeno por um grande.
 */
export function registrar(
  nivel: NivelDoRegistro,
  onde: string,
  mensagem: string,
  contexto: ContextoDoRegistro = {},
): void {
  try {
    const doPedido = contextoDoPedidoAgora();
    const linha = {
      em: new Date().toISOString(),
      nivel,
      onde,
      mensagem,
      /* O contexto do pedido entra primeiro pra a chamada poder sobrescrever. */
      ...(esconderSegredos(doPedido) as Record<string, unknown>),
      ...(esconderSegredos(contexto) as Record<string, unknown>),
    };
    escrever(JSON.stringify(linha));
  } catch (erro) {
    try {
      escrever(JSON.stringify({
        em: new Date().toISOString(), nivel: 'erro', onde: 'registro',
        mensagem: 'não consegui escrever uma linha de registro',
        detalhe: String(erro).slice(0, 200),
      }));
    } catch { /* aqui não dá pra fazer mais nada, e desistir é melhor que derrubar. */ }
  }
}

export const registro = {
  debug: (onde: string, msg: string, ctx?: ContextoDoRegistro) => registrar('debug', onde, msg, ctx),
  info: (onde: string, msg: string, ctx?: ContextoDoRegistro) => registrar('info', onde, msg, ctx),
  aviso: (onde: string, msg: string, ctx?: ContextoDoRegistro) => registrar('aviso', onde, msg, ctx),
  erro: (onde: string, msg: string, ctx?: ContextoDoRegistro) => registrar('erro', onde, msg, ctx),
};

/*
 * Ligado em `contexto-do-pedido.ts` na subida. Fica como função trocável pra este arquivo
 * não depender daquele — quem registra não precisa saber que existe um pedido em volta,
 * e a verificação consegue exercitar os dois separados.
 */
let contextoDoPedidoAgora: () => ContextoDoRegistro = () => ({});
export function ligarContextoDoPedido(lerAgora: () => ContextoDoRegistro): void {
  contextoDoPedidoAgora = lerAgora;
}
