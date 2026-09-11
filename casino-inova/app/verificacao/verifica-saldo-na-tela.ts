/**
 * O SALDO NA TELA NUNCA ANDA PARA TRÁS.
 *
 *   cd ../server && npx ts-node ../app/verificacao/verifica-saldo-na-tela.ts
 *
 * ESTE ARQUIVO EXISTE POR UM DEFEITO RELATADO JOGANDO: ganhar, ver o prêmio, e o saldo
 * não subir. Não era do servidor — o ledger estava certo o tempo todo. Era da tela.
 *
 * A CORRIDA, exatamente:
 *
 *   1. a tela ganha foco e dispara uma busca de saldo (lê o valor de ANTES da aposta);
 *   2. a pessoa aposta, ganha, e o servidor responde com o saldo NOVO;
 *   3. a busca do passo 1 — que saiu primeiro e chegou depois — grava o saldo VELHO por
 *      cima do novo.
 *
 * E a tela ainda tinha uma CÓPIA PRIVADA do saldo, sincronizada com o estado
 * compartilhado por um efeito. Então o passo 3 não só sujava o estado: ele reescrevia o
 * número que a pessoa estava olhando.
 *
 * O que se confere aqui é a REGRA, sem React e sem rede: a resposta mais nova ganha,
 * sempre, mesmo quando a mais velha chega por último. Um teste de interface não pegaria
 * isto de forma confiável — a corrida depende de tempo, e tempo em teste é sorte.
 */
import { strict as assert } from 'node:assert';

let passaram = 0;
let falharam = 0;
function confere(oQue: string, teste: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(teste)
    .then(() => { passaram += 1; console.log(`  ok   ${oQue}`); })
    .catch((erro) => {
      falharam += 1;
      console.log(`  FALHOU  ${oQue}`);
      console.log(`         ${(erro as Error).message.split('\n')[0]}`);
    });
}

/*
 * O ESTADO COMPARTILHADO, reproduzido aqui com a MESMA regra do `usePlayer`: um contador
 * de escritas, anotado quando a busca sai e conferido quando ela volta.
 *
 * Reproduzir em vez de importar é decisão: `usePlayer` arrasta React, navegação e o
 * cliente de rede junto. O que precisa ser provado é a regra de ordenação, e ela cabe
 * aqui inteira — com a conferência de espelho logo abaixo garantindo que as duas não
 * divergem.
 */
class EstadoDoSaldo {
  saldo = 0;
  private escritas = 0;
  private buscaEmVoo: Promise<void> | null = null;

  /** Um saldo que chegou junto de uma resposta de aposta. É sempre o mais novo. */
  chegouDeFora(saldo: number): void {
    this.escritas += 1;
    this.saldo = saldo;
  }

  /** Uma busca ao servidor. `responder` simula a latência e o valor que ela vai trazer. */
  buscar(responder: () => Promise<number>): Promise<void> {
    if (this.buscaEmVoo) return this.buscaEmVoo;
    const escritasQuandoSaiu = this.escritas;
    this.buscaEmVoo = (async () => {
      try {
        const doServidor = await responder();
        if (this.escritas === escritasQuandoSaiu) this.saldo = doServidor;
      } finally {
        this.buscaEmVoo = null;
      }
    })();
    return this.buscaEmVoo;
  }
}

const depois = (ms: number, valor: number) => new Promise<number>((r) => setTimeout(() => r(valor), ms));

async function main() {
  console.log('A corrida que fazia o saldo voltar atrás\n');

  await confere('busca lenta que sai ANTES da aposta não apaga o prêmio', async () => {
    const estado = new EstadoDoSaldo();
    estado.chegouDeFora(10_000);

    // A busca sai agora e vai demorar: ela vai trazer o saldo de ANTES da aposta.
    const busca = estado.buscar(() => depois(30, 10_000));
    // No meio do caminho, a aposta liquida: apostou 1.000, ganhou 3.000.
    estado.chegouDeFora(12_000);
    await busca;

    assert.equal(estado.saldo, 12_000, `o saldo voltou pra ${estado.saldo}`);
  });

  await confere('busca que sai DEPOIS da última aposta manda, como deve', async () => {
    const estado = new EstadoDoSaldo();
    estado.chegouDeFora(12_000);
    // Nada acontece no meio: aqui a resposta do servidor É a mais nova, e vale.
    await estado.buscar(() => depois(5, 15_000));
    assert.equal(estado.saldo, 15_000);
  });

  await confere('empate (o saldo não muda) ainda conta como resposta mais nova', async () => {
    const estado = new EstadoDoSaldo();
    estado.chegouDeFora(10_000);
    const busca = estado.buscar(() => depois(30, 10_000));
    /*
     * Uma aposta que empatou devolve o MESMO saldo. Se o contador só subisse quando o
     * número muda, esta busca velha ganharia — e o caso do empate é justamente onde ela
     * tem mais chance de estar errada, porque houve movimento no ledger.
     */
    estado.chegouDeFora(10_000);
    await busca;
    assert.equal(estado.saldo, 10_000);
  });

  await confere('dez apostas seguidas com uma busca lenta atravessando todas', async () => {
    const estado = new EstadoDoSaldo();
    estado.chegouDeFora(10_000);
    const busca = estado.buscar(() => depois(50, 10_000));
    let saldo = 10_000;
    for (let i = 0; i < 10; i += 1) {
      saldo += 500; // ganhou de novo
      estado.chegouDeFora(saldo);
    }
    await busca;
    assert.equal(estado.saldo, 15_000, `ficou em ${estado.saldo}`);
  });

  await confere('sem a trava, o defeito volta — é isto que estava no ar', async () => {
    /*
     * A MESMA SEQUÊNCIA, com a regra antiga (a busca escreve sempre). Se isto NÃO
     * reproduzir o defeito, a conferência acima não está provando nada.
     */
    class ComoEraAntes {
      saldo = 0;
      chegouDeFora(s: number) { this.saldo = s; }
      async buscar(responder: () => Promise<number>) { this.saldo = await responder(); }
    }
    const antigo = new ComoEraAntes();
    antigo.chegouDeFora(10_000);
    const busca = antigo.buscar(() => depois(30, 10_000));
    antigo.chegouDeFora(12_000);
    await busca;
    assert.equal(antigo.saldo, 10_000, 'a regra antiga deveria perder o prêmio, e não perdeu');
  });

  console.log('\nO espelho: a regra daqui é a mesma do usePlayer\n');

  await confere('usePlayer anota as escritas antes de sair e confere na volta', () => {
    const fonte = readFileSync(join(__dirname, '..', 'src', 'data', 'usePlayer.ts'), 'utf8');
    assert.ok(fonte.includes('const escritasQuandoSaiu = escritasDeSaldo;'), 'não anota antes de sair');
    assert.ok(fonte.includes('escritasDeSaldo === escritasQuandoSaiu'), 'não confere na volta');
    assert.ok(/escritasDeSaldo \+= 1;/.test(fonte), 'não conta as escritas');
  });

  await confere('nenhuma tela guarda cópia privada do saldo', () => {
    /*
     * PROCURA A FORMA, E NÃO O NOME. A primeira versão desta linha procurava `setBalance`,
     * e a tela de Bac Bo online escapou porque chamava a cópia dela de `saldo`. O padrão
     * agora é o EFEITO DE ESPELHO — `if (jogador) setX(jogador.chipBalance)` —, que é o que
     * de fato caracteriza a cópia, seja qual for o nome que ela tenha.
     */
    const telas = listar(join(__dirname, '..', 'src', 'screens')).filter((f) => f.endsWith('.tsx'));
    const comCopia = telas.filter((f) => /set\w+\(\s*jogador\.chipBalance\s*\)/.test(readFileSync(f, 'utf8')));
    assert.equal(
      comCopia.length,
      0,
      `espelham o saldo numa cópia: ${comCopia.map((f) => f.split('/').pop()).join(', ')}`,
    );
  });

  await confere('toda tela que recebe o PRÓPRIO saldo o entrega ao estado compartilhado', () => {
    /*
     * O PAINEL DE ADMINISTRAÇÃO É A EXCEÇÃO, e ela é real: lá o `newBalance` é o saldo de
     * OUTRA PESSOA — a que acabou de receber fichas do suporte. Gravá-lo no estado
     * compartilhado poria o saldo do jogador auxiliado no topo da tela de quem administra.
     *
     * A exceção está escrita aqui, e não num `catch` silencioso, porque é assim que ela
     * continua sendo uma decisão: uma tela nova que apareça nesta lista vai ter que
     * explicar por quê.
     */
    const DE_OUTRA_PESSOA = new Set(['AdminScreen.tsx']);
    const telas = listar(join(__dirname, '..', 'src', 'screens')).filter((f) => f.endsWith('.tsx'));
    const esquecidas = telas.filter((f) => {
      if (DE_OUTRA_PESSOA.has(f.split('/').pop()!)) return false;
      const s = readFileSync(f, 'utf8');
      return /newBalance/.test(s) && !/saldoChegouDeFora/.test(s);
    });
    assert.equal(
      esquecidas.length,
      0,
      `recebem e não entregam: ${esquecidas.map((f) => f.split('/').pop()).join(', ')}`,
    );
  });

  console.log(`\n${passaram} passaram, ${falharam} falharam\n`);
  process.exit(falharam > 0 ? 1 : 0);
}

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function listar(pasta: string, ate: string[] = []): string[] {
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) listar(caminho, ate);
    else ate.push(caminho);
  }
  return ate;
}

void main();
