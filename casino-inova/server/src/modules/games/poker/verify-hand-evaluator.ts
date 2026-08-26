import assert from 'node:assert';
import { bestHandOf, compareHandValues, handLabel } from './poker.engine';
import { Card } from './poker.config';

/**
 * Confere o avaliador de mão contra casos conhecidos — rodar depois de qualquer
 * mudança em poker.engine.ts, antes de confiar que ele está julgando certo.
 *
 *   npx ts-node src/modules/games/poker/verify-hand-evaluator.ts
 */
function card(rank: number, suit: Card['suit']): Card {
  return { rank: rank as Card['rank'], suit };
}

const royal = bestHandOf([card(14, 'paus'), card(13, 'paus'), card(12, 'paus'), card(11, 'paus'), card(10, 'paus'), card(2, 'ouros'), card(3, 'espadas')]);
const straightFlush9 = bestHandOf([card(9, 'copas'), card(8, 'copas'), card(7, 'copas'), card(6, 'copas'), card(5, 'copas'), card(2, 'ouros'), card(3, 'espadas')]);
assert.ok(compareHandValues(royal, straightFlush9) > 0, 'royal flush deveria vencer straight flush menor');
assert.strictEqual(handLabel(royal), 'Royal flush');

const quads = bestHandOf([card(9, 'paus'), card(9, 'copas'), card(9, 'espadas'), card(9, 'ouros'), card(2, 'paus'), card(3, 'copas'), card(4, 'espadas')]);
const fullHouse = bestHandOf([card(8, 'paus'), card(8, 'copas'), card(8, 'espadas'), card(5, 'ouros'), card(5, 'paus'), card(2, 'copas'), card(3, 'espadas')]);
assert.ok(compareHandValues(quads, fullHouse) > 0, 'quadra deveria vencer full house');

const flush = bestHandOf([card(2, 'paus'), card(5, 'paus'), card(9, 'paus'), card(11, 'paus'), card(13, 'paus'), card(4, 'copas'), card(6, 'espadas')]);
assert.ok(compareHandValues(fullHouse, flush) > 0, 'full house deveria vencer flush');

const straight = bestHandOf([card(9, 'paus'), card(8, 'copas'), card(7, 'espadas'), card(6, 'ouros'), card(5, 'paus'), card(2, 'copas'), card(3, 'espadas')]);
assert.ok(compareHandValues(flush, straight) > 0, 'flush deveria vencer sequência');

// Sequência "do bebê" (A-2-3-4-5) vale sequência de topo 5, não Ás-alto.
const wheel = bestHandOf([card(14, 'paus'), card(2, 'copas'), card(3, 'espadas'), card(4, 'ouros'), card(5, 'paus'), card(9, 'copas'), card(10, 'espadas')]);
assert.strictEqual(handLabel(wheel), 'Sequência');
const sixHighStraight = bestHandOf([card(2, 'paus'), card(3, 'copas'), card(4, 'espadas'), card(5, 'ouros'), card(6, 'paus'), card(9, 'copas'), card(10, 'espadas')]);
assert.ok(compareHandValues(sixHighStraight, wheel) > 0, 'sequência até 6 deveria vencer a sequência do bebê (até 5)');

// Duas mãos com as mesmas cartas por valor (naipes diferentes) devem empatar.
const handA = bestHandOf([card(10, 'paus'), card(10, 'copas'), card(7, 'espadas'), card(4, 'ouros'), card(2, 'paus'), card(9, 'copas'), card(3, 'espadas')]);
const handB = bestHandOf([card(10, 'ouros'), card(10, 'espadas'), card(7, 'copas'), card(4, 'paus'), card(2, 'ouros'), card(9, 'espadas'), card(3, 'paus')]);
assert.strictEqual(compareHandValues(handA, handB), 0, 'mãos com as mesmas cartas por valor deveriam empatar');

console.log('Todas as verificações do avaliador de mão de poker passaram.');
