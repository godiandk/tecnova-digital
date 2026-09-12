/**
 * AS REGRAS DE APRESENTAÇÃO DOS JOGOS — as que dá pra conferir lendo o código.
 *
 *   cd ../server && npx ts-node ../app/verificacao/verifica-apresentacao.ts
 *
 * A frente GAME PRESENTATION REBUILD produziu um diagnóstico
 * (`docs/por-que-os-jogos-nao-parecem-jogos.md`) com cinco defeitos estruturais. Alguns
 * deles voltam sozinhos: é mais rápido empilhar mais um `<Text>` num `ScrollView` do que
 * desenhar a coisa na mesa, e ninguém faz por mal — faz por ser o caminho curto.
 *
 * Então o que já foi consertado fica guardado aqui, e o que ainda não foi vira ORÇAMENTO
 * QUE SÓ PODE CAIR. A lista de telas que ainda rolam é dívida escrita com nome: ela pode
 * encolher sem tocar nesta conferência, e não pode crescer sem alguém explicar por quê.
 *
 * O QUE ISTO NÃO MEDE, e é bom dizer: se a mesa está bonita. Isso é retrato
 * (`verificacao/retratos-dos-jogos.mjs`) e olho humano. Aqui ficam só as regras que têm
 * forma no código.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const TELAS = join(__dirname, '..', 'src', 'screens', 'games');
const COMPONENTES = join(__dirname, '..', 'src', 'components');

let passaram = 0;
let falharam = 0;
function confere(oQue: string, problema: string | null): void {
  if (problema === null) {
    passaram += 1;
    console.log(`  ok   ${oQue}`);
  } else {
    falharam += 1;
    console.log(`  FALHOU  ${oQue}`);
    console.log(`         ${problema}`);
  }
}

const telas = readdirSync(TELAS).filter((n) => n.endsWith('.tsx'));
const ler = (pasta: string, nome: string) => readFileSync(join(pasta, nome), 'utf8');

console.log('\n=== APRESENTAÇÃO DOS JOGOS ===\n');
console.log('--- 1. a mesa não rola ---\n');

/*
 * O ORÇAMENTO DA ROLAGEM.
 *
 * Rolar é o gesto de um documento. Uma mesa cabe na tela ou não é uma mesa. Estas são as
 * telas que ainda rolam, com o motivo — e a regra é que a lista só encolhe. Quem tirar
 * uma daqui tira também da lista; quem quiser pôr uma nova precisa explicar numa revisão,
 * porque a conferência reprova sozinha.
 */
const AINDA_ROLAM = new Set([
  'RouletteScreen.tsx',          // o pano de 37 casas mais o histórico
  'BlackjackScreen.tsx',         // mãos divididas empilham até quatro
  'BaccaratScreen.tsx',          // o placar (roadmap) embaixo do pano
  'StockMarketScreen.tsx',       // o gráfico, as ordens e o extrato da rodada
  'BancaFrancesaMesaScreen.tsx', // a lista de mesas públicas antes de sentar
  'BacBoMesaScreen.tsx',         // idem
  'BacBoScreen.tsx',             // a versão sem mesa, que o lobby não abre mais
  'DominoMesaScreen.tsx',        // a sala: lista de mesas, amigos e código de entrada
  'TrucoMesaScreen.tsx',         // idem
]);

const rolandoAgora = telas.filter((nome) => /<ScrollView/.test(ler(TELAS, nome)));
const novas = rolandoAgora.filter((nome) => !AINDA_ROLAM.has(nome));
confere(
  `nenhuma tela de jogo NOVA passou a rolar (${rolandoAgora.length} de ${telas.length} ainda rolam)`,
  novas.length === 0 ? null : `passaram a rolar: ${novas.join(', ')}`,
);

const saíramDaLista = [...AINDA_ROLAM].filter((nome) => !rolandoAgora.includes(nome));
confere(
  'o orçamento de rolagem está em dia com a realidade',
  saíramDaLista.length === 0
    ? null
    : `${saíramDaLista.join(', ')} não rola(m) mais — tire da lista AINDA_ROLAM, o orçamento só encolhe`,
);

console.log('\n--- 2. peça de jogo é desenhada, não escrita ---\n');

/*
 * A PEÇA DE DOMINÓ ERA A STRING "3|5". Este é o formato exato do defeito que foi
 * consertado, e é o formato que voltaria se alguém precisasse mostrar uma peça com pressa.
 */
const comPecaEscrita = telas.filter((nome) => /\$\{\s*\w+\.a\s*\}\s*\|\s*\$\{\s*\w+\.b\s*\}/.test(ler(TELAS, nome)));
confere(
  'nenhuma tela desenha peça de dominó como texto "a|b"',
  comPecaEscrita.length === 0 ? null : `${comPecaEscrita.join(', ')} — use PecaDeDomino`,
);

console.log('\n--- 3. o degradê não mata a mesa ---\n');

/*
 * O DEFEITO MEDIDO NO RETRATO: o degradê ia até COR SÓLIDA em 80% da altura, e os
 * controles de todas as dez telas ficam abaixo dessa linha. Um quinto da tela virava laje
 * preta, e a foto da mesa virava enfeite de topo.
 */
const backdrop = ler(COMPONENTES, 'GameBackdrop.tsx');
const paradaAntesDaBorda = /locations=\{apagarAMesa \? \[0, 1\] : \[[^\]]*0\.(?:[0-8]\d?)\]\}/.test(backdrop);
confere(
  'o degradê da mesa vai até a borda de baixo, em vez de fechar antes',
  paradaAntesDaBorda ? 'o último ponto do degradê está antes de 1 — a mesa acaba no meio da tela' : null,
);
confere(
  'e ele termina translúcido, deixando o pano aparecer',
  /rgba\(11,15,13,0\.9[0-5]\)'\]/.test(backdrop)
    ? null
    : 'o degradê deveria terminar num preto translúcido (0,90–0,95), não em cor sólida',
);

console.log('\n--- 4. a aposta acontece no pano ---\n');

/*
 * O BACARÁ ERA TRÊS PÍLULAS DE TEXTO em cima de um pano que já tinha PLAYER, BANKER e TIE
 * impressos. Trocar isso por um pano desenhado foi o primeiro piloto da frente; a
 * conferência guarda que ele não volta a ser uma lista de opções.
 */
const bacara = ler(TELAS, 'BaccaratScreen.tsx');
confere(
  'o bacará aposta num pano, e não numa lista de pílulas',
  /PanoDoBacara/.test(bacara) ? null : 'BaccaratScreen deixou de usar PanoDoBacara',
);
confere(
  'e não sobrou lista de tipos de aposta em texto',
  /BET_OPTIONS/.test(bacara) ? 'BET_OPTIONS voltou — a aposta virou formulário de novo' : null,
);

console.log('\n--- 5. erro técnico não chega no jogador ---\n');

/*
 * `mensagemParaOJogador` separa a frase escrita pra ser lida do detalhe que só serve pro
 * console. A exceção é `SocketError`, que carrega regra de mesa ("não é sua vez") e passa
 * inteira — e ela é declarada, não implícita.
 */
const cruas: string[] = [];
for (const nome of telas) {
  const fonte = ler(TELAS, nome);
  for (const [i, linha] of fonte.split('\n').entries()) {
    if (!/\.message\b/.test(linha)) continue;
    if (/SocketError/.test(linha)) continue;
    if (/^\s*(\*|\/\/)/.test(linha)) continue;
    cruas.push(`${nome}:${i + 1}`);
  }
}
confere(
  'nenhuma tela joga `erro.message` na cara do jogador',
  cruas.length === 0 ? null : `${cruas.join(', ')} — passe por mensagemParaOJogador`,
);

console.log(`\n${passaram} passaram, ${falharam} falharam\n`);
if (falharam > 0) process.exit(1);
