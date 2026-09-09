/**
 * PROPRIEDADES DA BANCA FRANCESA — testadas com entradas SORTEADAS, não escolhidas.
 *
 * A diferença em relação às outras conferências deste projeto é o tipo de erro que cada
 * uma pega. Um teste com casos escritos à mão prova que os casos que EU PENSEI estão
 * certos — e o erro que sobra é sempre o caso que eu não pensei. O `fast-check` sorteia
 * milhares de entradas dentro do domínio e, quando acha uma que quebra, ENCOLHE a
 * entrada até o menor exemplo possível: em vez de "falhou com aposta 7.834.291 em
 * linha-grande", ele diz "falhou com aposta 1".
 *
 * As propriedades abaixo são invariantes: valem pra QUALQUER entrada válida, não pra um
 * caso específico. É por isso que dá pra sortear.
 */
import fc from 'fast-check';
import {
  BET_TYPES,
  BancaFrancesaBetType,
  TETO_EM_MINIMOS,
  ehApostaDeLinha,
  limitesDaCasa,
  problemaComApostaDaBanca,
  riscoDaAposta,
} from './banca-francesa.config';
import { classificar, resolveBets } from './banca-francesa.engine';

let falhas = 0;
const RODADAS = { numRuns: 2000 };

function propriedade(titulo: string, executar: () => void) {
  try {
    executar();
    console.log(`ok   ${titulo}`);
  } catch (e) {
    falhas += 1;
    const msg = e instanceof Error ? e.message.split('\n').slice(0, 4).join(' | ') : String(e);
    console.log(`FALHA ${titulo}\n      ${msg}`);
  }
}

/** Uma aposta válida qualquer, numa mesa de mínimo qualquer. */
const mesaEAposta = fc
  .record({
    minimo: fc.constantFrom(50, 500, 5_000, 500_000, 5_000_000, 500_000_000),
    tipo: fc.constantFrom(...BET_TYPES),
    passos: fc.integer({ min: 0, max: 199 }),
  })
  .map(({ minimo, tipo, passos }) => {
    const { minimo: piso, maximo } = limitesDaCasa(tipo, minimo);
    /* Um valor dentro da faixa, e par quando for linha (a linha é dividida ao meio). */
    const bruto = Math.min(maximo, piso + passos * minimo);
    const valor = ehApostaDeLinha(tipo) ? bruto - (bruto % 2) : bruto;
    return { minimo, tipo, valor: Math.max(piso, valor) };
  });

console.log('--- as regras de aposta ---');

propriedade('toda aposta dentro da faixa da casa é aceita', () => {
  fc.assert(
    fc.property(mesaEAposta, ({ minimo, tipo, valor }) => {
      const problema = problemaComApostaDaBanca(tipo, valor, minimo);
      if (problema !== null) throw new Error(`${tipo} ${valor} em mesa de ${minimo}: ${problema}`);
    }),
    RODADAS,
  );
});

propriedade('nenhum valor acima do teto passa, em nenhuma casa', () => {
  fc.assert(
    fc.property(
      fc.constantFrom(50, 500, 5_000_000),
      fc.constantFrom(...BET_TYPES),
      fc.integer({ min: 1, max: 10_000 }),
      (minimo, tipo, excesso) => {
        const { maximo } = limitesDaCasa(tipo, minimo);
        /* Par, pra que a recusa seja pelo TETO e não pela regra do valor par. */
        const valor = maximo + excesso * 2;
        if (problemaComApostaDaBanca(tipo, valor, minimo) === null) {
          throw new Error(`${tipo} aceitou ${valor} com teto ${maximo}`);
        }
      },
    ),
    RODADAS,
  );
});

propriedade('nenhum valor abaixo do piso passa, em nenhuma casa', () => {
  fc.assert(
    fc.property(
      fc.constantFrom(50, 500, 5_000_000),
      fc.constantFrom(...BET_TYPES),
      fc.integer({ min: 1, max: 1000 }),
      (minimo, tipo, falta) => {
        const { minimo: piso } = limitesDaCasa(tipo, minimo);
        const valor = piso - falta * 2;
        if (valor <= 0) return;
        if (problemaComApostaDaBanca(tipo, valor, minimo) === null) {
          throw new Error(`${tipo} aceitou ${valor} com piso ${piso}`);
        }
      },
    ),
    RODADAS,
  );
});

propriedade('valor fracionário nunca é aceito', () => {
  fc.assert(
    fc.property(
      fc.constantFrom(...BET_TYPES),
      fc.double({ min: 0.01, max: 100_000, noNaN: true }).filter((v) => !Number.isInteger(v)),
      (tipo, valor) => {
        if (problemaComApostaDaBanca(tipo, valor, 50) === null) {
          throw new Error(`${tipo} aceitou ${valor}`);
        }
      },
    ),
    RODADAS,
  );
});

propriedade('na linha, valor ímpar nunca é aceito', () => {
  fc.assert(
    fc.property(
      fc.constantFrom('linha-pequeno' as const, 'linha-grande' as const),
      fc.integer({ min: 1, max: 5_000 }),
      (tipo, k) => {
        const valor = 100 + k * 2 - 1; // sempre ímpar, sempre acima do piso de 100
        if (problemaComApostaDaBanca(tipo, valor, 50) === null) {
          throw new Error(`${tipo} aceitou ${valor}, que é ímpar`);
        }
      },
    ),
    RODADAS,
  );
});

console.log('\n--- o risco e o pagamento ---');

propriedade('o risco da linha é sempre metade, e o do centro é sempre o cheio', () => {
  fc.assert(
    fc.property(fc.constantFrom(...BET_TYPES), fc.integer({ min: 2, max: 10 ** 12 }), (tipo, valor) => {
      const esperado = ehApostaDeLinha(tipo) ? valor / 2 : valor;
      if (riscoDaAposta(tipo, valor) !== esperado) throw new Error(`${tipo} ${valor}`);
    }),
    RODADAS,
  );
});

propriedade('o retorno nunca é negativo, em nenhum resultado', () => {
  fc.assert(
    fc.property(
      fc.constantFrom('ases' as const, 'pequeno' as const, 'grande' as const),
      fc.array(
        fc.record({ type: fc.constantFrom(...BET_TYPES), amount: fc.integer({ min: 2, max: 10 ** 9 }) }),
        { minLength: 1, maxLength: 5 },
      ),
      (resultado, apostas) => {
        for (const r of resolveBets(resultado, apostas)) {
          if (r.totalReturn < 0) throw new Error(`${r.type} devolveu ${r.totalReturn}`);
          if (!Number.isFinite(r.totalReturn)) throw new Error(`${r.type} devolveu ${r.totalReturn}`);
        }
      },
    ),
    RODADAS,
  );
});

propriedade('perdendo na linha, ainda volta exatamente metade', () => {
  fc.assert(
    fc.property(
      fc.constantFrom('linha-pequeno' as const, 'linha-grande' as const),
      fc.integer({ min: 1, max: 10 ** 9 }).map((n) => n * 2),
      (tipo, valor) => {
        /* O resultado que faz esta linha PERDER é o arco oposto. */
        const perdedor = tipo === 'linha-pequeno' ? ('grande' as const) : ('pequeno' as const);
        const r = resolveBets(perdedor, [{ type: tipo, amount: valor }])[0];
        if (r.won) throw new Error(`${tipo} ganhou com ${perdedor}`);
        if (r.totalReturn !== valor / 2) throw new Error(`devolveu ${r.totalReturn}, esperado ${valor / 2}`);
      },
    ),
    RODADAS,
  );
});

propriedade('o pagamento é sempre inteiro — ficha não se parte', () => {
  fc.assert(
    fc.property(
      fc.constantFrom('ases' as const, 'pequeno' as const, 'grande' as const),
      fc.constantFrom(...BET_TYPES),
      fc.integer({ min: 1, max: 10 ** 9 }).map((n) => n * 2),
      (resultado, tipo, valor) => {
        const r = resolveBets(resultado, [{ type: tipo, amount: valor }])[0];
        if (!Number.isInteger(r.totalReturn)) throw new Error(`${tipo} devolveu ${r.totalReturn}`);
      },
    ),
    RODADAS,
  );
});

console.log('\n--- a classificação da soma ---');

propriedade('toda soma de três dados é ases, pequeno, grande ou nula — e só uma', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 6 }),
      fc.integer({ min: 1, max: 6 }),
      fc.integer({ min: 1, max: 6 }),
      (a, b, c) => {
        const soma = a + b + c;
        const r = classificar(soma);
        const valido = r === null || r === 'ases' || r === 'pequeno' || r === 'grande';
        if (!valido) throw new Error(`soma ${soma} deu ${r}`);
        /* E a classificação depende SÓ da soma, não de qual dado deu o quê. */
        if (classificar(soma) !== r) throw new Error(`soma ${soma} classificou diferente duas vezes`);
      },
    ),
    RODADAS,
  );
});

propriedade('Pequeno e Grande são espelhos: a soma s e a soma 21−s trocam de lado', () => {
  fc.assert(
    /*
     * Trocar cada face por 7 menos ela (a face oposta) leva a soma s para 21−s. Pequeno
     * e Grande são espelhos um do outro, então a classificação tem que espelhar junto.
     *
     * O 3 E O 18 FICAM DE FORA, e não é detalhe: o fast-check os encontrou na quarta
     * tentativa e encolheu o contraexemplo até "soma 3". A propriedade que eu tinha
     * escrito dizia que TODA soma espelha — e ela é falsa, porque ASES É A ÚNICA SOMA
     * DECISIVA SEM ESPELHO DECISIVO. O espelho do 3 é o 18, que é nulo.
     *
     * Isso é do jogo, não do código: a mesa portuguesa paga a soma mínima (três uns) e
     * não paga a máxima (três seis). É uma assimetria de verdade, e vale estar escrita
     * aqui — ninguém olhando a tabela de somas percebe sozinho.
     */
    fc.property(fc.integer({ min: 4, max: 17 }), (soma) => {
      const r = classificar(soma);
      const espelhado = classificar(21 - soma);
      const esperado = r === 'pequeno' ? 'grande' : r === 'grande' ? 'pequeno' : r;
      if (espelhado !== esperado) throw new Error(`soma ${soma} é ${r}, mas ${21 - soma} é ${espelhado}`);
    }),
    RODADAS,
  );
});

propriedade('Ases é a única soma decisiva sem espelho decisivo', () => {
  if (classificar(3) !== 'ases') throw new Error('a soma 3 não é Ases');
  if (classificar(18) !== null) throw new Error('a soma 18 não é nula');
  /* E é a única: toda outra soma decisiva tem espelho decisivo. */
  for (let s = 4; s <= 17; s += 1) {
    if (classificar(s) !== null && classificar(21 - s) === null) {
      throw new Error(`a soma ${s} decide mas o espelho ${21 - s} é nulo`);
    }
  }
});

console.log('\n--- os limites acompanham o degrau ---');

propriedade('o teto de uma casa é sempre o múltiplo dela vezes o mínimo, em qualquer mesa', () => {
  fc.assert(
    fc.property(
      fc.constantFrom(...BET_TYPES),
      fc.integer({ min: 1, max: 10 ** 9 }),
      (tipo: BancaFrancesaBetType, minimo) => {
        const { maximo } = limitesDaCasa(tipo, minimo);
        if (maximo !== minimo * TETO_EM_MINIMOS[tipo]) throw new Error(`${tipo} em mesa de ${minimo}`);
      },
    ),
    RODADAS,
  );
});

propriedade('o teto de Ases é sempre menor que o dos arcos — ele paga 61 por 1', () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 10 ** 9 }), (minimo) => {
      if (limitesDaCasa('ases', minimo).maximo >= limitesDaCasa('grande', minimo).maximo) {
        throw new Error(`em mesa de ${minimo}, Ases não é mais apertado que Grande`);
      }
    }),
    RODADAS,
  );
});

console.log(
  falhas === 0
    ? '\nOK: as propriedades valem pra qualquer aposta, não só pras que eu pensei.'
    : `\n${falhas} PROPRIEDADE(S) QUEBRADA(S)`,
);
process.exit(falhas === 0 ? 0 : 1);
