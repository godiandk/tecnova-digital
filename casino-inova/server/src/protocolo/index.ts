/**
 * O contrato compartilhado entre o app e o servidor.
 *
 * Mora dentro do servidor, e o app importa daqui por caminho relativo. Parece estranho
 * o app depender de uma pasta do servidor, mas é o arranjo certo: o contrato é do
 * servidor, que é quem o impõe, e assim existe UMA definição em vez de duas que podem
 * divergir sem ninguém perceber até quebrar em produção.
 *
 * Regra desta pasta: SÓ TIPO, sem nenhum valor em tempo de execução e sem nenhuma
 * dependência. É o que deixa o app importar com `import type` — o TypeScript confere
 * que os dois lados falam a mesma língua, e o empacotador do app nunca precisa resolver
 * o arquivo, porque `import type` some na compilação.
 *
 * Uma tentativa anterior colocou isto numa pasta irmã (casino-inova/protocolo). O tsc
 * do servidor passou a enxergar um rootDir acima de src/, e o build inteiro saiu em
 * dist/server/src/ — main.js sumiu do lugar. Daí estar aqui dentro.
 */
export type { FaseDaRodada } from './fases';
export type {
  AcaoDoCliente,
  EventoDoServidor,
  CodigoDeRecusa,
  NomeDaAcao,
  NomeDoEvento,
  Acao,
  Evento,
} from './mensagens';
