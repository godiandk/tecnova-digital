#!/usr/bin/env python3
"""
A MATEMÁTICA DO CAÇA-NÍQUEIS, exata — não simulada.

    python3 tools/analisa-slot.py            analisa a configuração de hoje
    python3 tools/analisa-slot.py --alvo 96  procura a calibração pro RTP alvo

O modelo do nosso slot (lido em server/src/modules/games/slots/):

  - 5 rolos x 3 fileiras; cada uma das 15 células é sorteada INDEPENDENTE, com o mesmo
    peso por símbolo (não há strip de rolo com peso por coluna);
  - 5 linhas de pagamento, e toda combinação começa OBRIGATORIAMENTE no rolo 1 e anda
    pra direita até quebrar;
  - o prêmio de cada linha é `aposta x multiplicador` — a aposta NÃO é dividida entre as
    linhas, então o retorno é a soma das cinco.

A média (RTP) sai em fórmula fechada por linearidade da esperança. O resto — frequência
de vitória, distribuição, volatilidade — NÃO sai, porque as cinco linhas compartilham
células (o "vale" e a "montanha" cruzam as fileiras). Então aqui a distribuição é
calculada EXATA por programação dinâmica sobre os rolos, e não por simulação:

  1. o rolo 1 fixa o símbolo exigido por cada linha (as 9^3 = 729 combinações);
  2. a cada rolo seguinte, as linhas que leem a MESMA fileira sobrevivem ou morrem
     juntas — é isso que torna a conta pequena: por fileira há no máximo 4 desfechos
     (o símbolo cair em um dos exigidos, ou em nenhum);
  3. quem morre no rolo k tinha k-1 acertos, e paga se k-1 >= 3;
  4. quem chega vivo ao fim tem 5 acertos.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from fractions import Fraction
from pathlib import Path

CONFIG = Path(__file__).resolve().parent.parent / 'server/src/modules/games/slots/slots.config.ts'

# Qual FILEIRA cada linha lê em cada rolo (0 = de cima, 1 = do meio, 2 = de baixo).
# Vem direto de PAYLINES: central [5,6,7,8,9], superior [0..4], inferior [10..14],
# vale [0,6,12,8,4], montanha [10,6,2,8,14], com célula = fileira*5 + rolo.
LINHAS = {
    'linha-central':   [1, 1, 1, 1, 1],
    'linha-superior':  [0, 0, 0, 0, 0],
    'linha-inferior':  [2, 2, 2, 2, 2],
    'vale':            [0, 1, 2, 1, 0],
    'montanha':        [2, 1, 0, 1, 2],
}
NOMES = list(LINHAS)
MIN_ACERTO = 3


def le_simbolos() -> list[dict]:
    """Lê os símbolos do próprio slots.config.ts — nunca de uma cópia."""
    texto = CONFIG.read_text()
    simbolos = []
    padrao = re.compile(
        r"\{\s*id:\s*'([\w-]+)',\s*label:\s*'([^']+)',\s*weight:\s*([\d.]+),\s*"
        r"payout:\s*\{\s*3:\s*([\d.]+),\s*4:\s*([\d.]+),\s*5:\s*([\d.]+)\s*\}"
    )
    for m in padrao.finditer(texto):
        simbolos.append({
            'id': m.group(1), 'label': m.group(2),
            'peso': Fraction(m.group(3)),
            'paga': {3: Fraction(m.group(4)), 4: Fraction(m.group(5)), 5: Fraction(m.group(6))},
        })
    if len(simbolos) != 9:
        sys.exit(f'esperava 9 símbolos em {CONFIG}, achei {len(simbolos)}')
    return simbolos


def rtp_de_formula(simbolos) -> Fraction:
    """
    O MESMO cálculo que theoreticalRtp() faz no motor, em fração exata.

    Para um símbolo de probabilidade p, numa linha de 5 rolos:
        P(exatamente 3) = p^3 (1-p)   — os três primeiros batem e o quarto quebra
        P(exatamente 4) = p^4 (1-p)
        P(exatamente 5) = p^5         — não há o que quebrar depois
    """
    total = sum(s['peso'] for s in simbolos)
    por_linha = Fraction(0)
    for s in simbolos:
        p = s['peso'] / total
        por_linha += p**3 * (1 - p) * s['paga'][3]
        por_linha += p**4 * (1 - p) * s['paga'][4]
        por_linha += p**5 * s['paga'][5]
    return por_linha * len(LINHAS)


def distribuicao(simbolos) -> dict[Fraction, Fraction]:
    """
    A distribuição EXATA do retorno de um giro, em múltiplos da aposta.

    Devolve {multiplicador: probabilidade}, com tudo em Fraction — sem erro de ponto
    flutuante em lugar nenhum.
    """
    total = sum(s['peso'] for s in simbolos)
    prob = [s['peso'] / total for s in simbolos]
    paga = [s['paga'] for s in simbolos]
    n = len(simbolos)

    resultado: dict[Fraction, Fraction] = defaultdict(Fraction)

    for a in range(n):          # símbolo da fileira de cima no rolo 1
        for b in range(n):      # fileira do meio
            for c in range(n):  # fileira de baixo
                p1 = prob[a] * prob[b] * prob[c]
                # o símbolo que cada linha vai exigir dos rolos 2 a 5
                exigido = {
                    'linha-central': b, 'linha-superior': a, 'linha-inferior': c,
                    'vale': a, 'montanha': c,
                }
                # estado: (linhas vivas em tupla ordenada) -> {acumulado: prob}
                estado = {tuple(NOMES): {Fraction(0): p1}}

                for rolo in range(1, 5):  # rolos 2, 3, 4 e 5
                    novo: dict[tuple, dict[Fraction, Fraction]] = defaultdict(lambda: defaultdict(Fraction))
                    for vivas, acumulados in estado.items():
                        if not vivas:
                            for acc, pr in acumulados.items():
                                novo[vivas][acc] += pr
                            continue
                        # por fileira, quais símbolos as linhas vivas exigem
                        por_fileira: dict[int, dict[int, list[str]]] = defaultdict(lambda: defaultdict(list))
                        for nome in vivas:
                            por_fileira[LINHAS[nome][rolo]][exigido[nome]].append(nome)

                        # desfechos de cada fileira: cai num exigido, ou em nenhum
                        opcoes_por_fileira = []
                        for fileira, exigidos in por_fileira.items():
                            opcoes = [(prob[sim], set(nomes)) for sim, nomes in exigidos.items()]
                            resto = 1 - sum(o[0] for o in opcoes)
                            if resto > 0:
                                opcoes.append((resto, set()))
                            opcoes_por_fileira.append(opcoes)

                        # produto cartesiano dos desfechos das (no máximo 3) fileiras
                        combos = [(Fraction(1), set())]
                        for opcoes in opcoes_por_fileira:
                            combos = [
                                (pa * pb, sa | sb) for pa, sa in combos for pb, sb in opcoes
                            ]

                        for pcombo, sobreviventes in combos:
                            if pcombo == 0:
                                continue
                            mortas = [nome for nome in vivas if nome not in sobreviventes]
                            acertos = rolo  # quem morre agora acertou `rolo` (1-indexado: rolo 1..k)
                            ganho = Fraction(0)
                            if acertos >= MIN_ACERTO:
                                for nome in mortas:
                                    ganho += paga[exigido[nome]][acertos]
                            chave = tuple(sorted(sobreviventes, key=NOMES.index))
                            for acc, pr in acumulados.items():
                                novo[chave][acc + ganho] += pr * pcombo
                    estado = {k: dict(v) for k, v in novo.items()}

                # quem chegou viva ao fim tem 5 acertos
                for vivas, acumulados in estado.items():
                    ganho = sum(paga[exigido[nome]][5] for nome in vivas)
                    for acc, pr in acumulados.items():
                        resultado[acc + ganho] += pr

    return dict(resultado)


def relatorio(simbolos, dist, titulo):
    total = sum(s['peso'] for s in simbolos)
    soma_prob = sum(dist.values())
    media = sum(m * p for m, p in dist.items())
    segundo = sum(m * m * p for m, p in dist.items())
    variancia = segundo - media * media
    desvio = float(variancia) ** 0.5
    zero = dist.get(Fraction(0), Fraction(0))
    maior = max(dist)

    print(f'\n=== {titulo} ===')
    print(f'  soma das probabilidades   {float(soma_prob):.12f}   (tem que ser 1)')
    print(f'  RTP                       {float(media)*100:.4f}%')
    print(f'  margem da casa            {float(1-media)*100:.4f}%')
    print(f'  frequência de vitória     {float(1-zero)*100:.4f}%   (1 em {1/float(1-zero):.1f} giros)')
    print(f'  frequência de zero        {float(zero)*100:.4f}%')
    print(f'  desvio padrão do retorno  {desvio:.3f} x a aposta')
    print(f'  volatilidade              {classifica(desvio)}')
    print(f'  maior prêmio possível     {float(maior):.0f} x a aposta')
    pmaior = dist[maior]
    print(f'  frequência do maior       {float(pmaior):.3e}   (1 em {1/float(pmaior):,.0f} giros)')

    print('\n  distribuição do retorno (multiplicador da aposta):')
    faixas = [(0, 0), (0, 1), (1, 2), (2, 5), (5, 10), (10, 50), (50, 200), (200, 1000), (1000, 10**9)]
    for lo, hi in faixas:
        if lo == hi == 0:
            sel = [(m, p) for m, p in dist.items() if m == 0]
            rotulo = 'nada'
        else:
            sel = [(m, p) for m, p in dist.items() if lo < m <= hi]
            rotulo = f'{lo}x < ganho <= {hi}x' if hi < 10**9 else f'acima de {lo}x'
        pr = sum(p for _, p in sel)
        contrib = sum(m * p for m, p in sel)
        if pr == 0:
            continue
        print(f'    {rotulo:24s} {float(pr)*100:8.4f}%   contribui {float(contrib)*100:7.3f} pontos de RTP')

    print('\n  contribuição de cada símbolo pro RTP (média, exata por linearidade):')
    linhas = len(LINHAS)
    contribs = []
    for s in simbolos:
        p = s['peso'] / total
        c3 = p**3 * (1 - p) * s['paga'][3] * linhas
        c4 = p**4 * (1 - p) * s['paga'][4] * linhas
        c5 = p**5 * s['paga'][5] * linhas
        contribs.append((s, c3, c4, c5, c3 + c4 + c5))
    for s, c3, c4, c5, ctot in sorted(contribs, key=lambda x: -x[4]):
        p = s['peso'] / total
        print(f'    {s["label"]:10s} p={float(p)*100:5.2f}%  '
              f'3={float(c3)*100:6.3f}  4={float(c4)*100:6.3f}  5={float(c5)*100:6.3f}  '
              f'total={float(ctot)*100:6.3f} pontos')
    return {'rtp': float(media), 'zero': float(zero), 'desvio': desvio, 'maior': float(maior)}


def classifica(desvio: float) -> str:
    if desvio < 3: return 'baixa (slot de sessão longa)'
    if desvio < 6: return 'média-baixa'
    if desvio < 12: return 'média'
    if desvio < 25: return 'média-alta'
    return 'alta (prêmio raro e grande)'


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--json', action='store_true')
    args = ap.parse_args()

    simbolos = le_simbolos()
    formula = rtp_de_formula(simbolos)
    dist = distribuicao(simbolos)
    resumo = relatorio(simbolos, dist, 'CONFIGURAÇÃO DE HOJE')

    media = sum(m * p for m, p in dist.items())
    print(f'\n  fórmula fechada x distribuição exata: {float(formula)*100:.6f}% x {float(media)*100:.6f}%')
    print('  (as duas TÊM que bater — se não baterem, uma das duas está errada)')
    if args.json:
        print(json.dumps(resumo))
