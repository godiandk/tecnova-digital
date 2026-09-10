"""A economia PROPOSTA do Casino Inova — a conta que sustenta docs/economia.md.

Nada aqui está implementado no jogo: é o modelo que produziu as tabelas do documento,
guardado pra que os números possam ser refeitos e contestados.

    python3 tools/economia-proposta.py
"""
import importlib.util, math, os

# O arquivo ao lado se chama `economia-modelo.py`, com hífen, como todo script do projeto —
# e hífen não é nome de módulo válido em Python.
_aqui = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('economia_modelo', os.path.join(_aqui, 'economia-modelo.py'))
_m = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(_m)
globals().update({k: v for k, v in vars(_m).items() if not k.startswith('__')})

ANCORA = DEGRAUS[0]['minimo']   # 50 — a aposta mínima da mesa de entrada

# ---------- a régua estrutural que explica TUDO ----------
# entrada(d) = 100 x minimo(d)  e  minimo(d+1) = 10 x minimo(d)
# logo: subir um degrau custa ~900 apostas mínimas de receita.
LARGURA_DO_DEGRAU_EM_MINIMOS = 900

# ---------- curva de XP recalibrada ----------
XP_BASE, XP_PASSO = 500, 17.2
def xp_do_nivel_novo(n): return round(XP_BASE + XP_PASSO * max(0, n - 1))

# ---------- bônus de nível: +0,5x a cada década de nível, teto 3x ----------
def bonus_de_nivel(nivel): return min(3.0, 1 + 0.5 * math.log10(max(1, nivel)))

# ---------- o degrau que o NÍVEL libera ----------
NIVEL_POR_DEGRAU = 85
def degrau_liberado(nivel): return min(len(DEGRAUS) - 1, int(nivel) // NIVEL_POR_DEGRAU)

def degrau_da_loja(saldo, nivel):
    """O menor entre o degrau do saldo e o que o nível liberou. É o `economicTier`."""
    i_saldo = DEGRAUS.index(degrau_por_saldo(saldo))
    return DEGRAUS[min(i_saldo, degrau_liberado(nivel))]

K_DO_PACOTE = {'R$ 9,90': 100, 'R$ 24,90': 300, 'R$ 59,90': 800, 'R$ 149,90': 2400}
def pacote(preco, saldo, nivel):
    return round(K_DO_PACOTE[preco] * degrau_da_loja(saldo, nivel)['minimo'] * bonus_de_nivel(nivel))

def mult_do_dia(dia, dias_do_mes):
    if dia == dias_do_mes: return 500
    return {7: 60, 14: 120, 21: 200}.get(dia, 8 + 2 * dia)

def recompensa(dia, nivel, dias_do_mes=30):
    """Ancorada no BRONZE — nunca no saldo. É o que corta a catraca de graça."""
    return round(ANCORA * mult_do_dia(dia, dias_do_mes) * bonus_de_nivel(nivel))

def degrau_economico(saldo, nivel):
    """
    O `economicTier` do pedido: UM conceito que manda em mesa, apostas, loja e recompensa.

    É o MENOR entre o degrau que o saldo banca e o degrau que a progressão liberou.
    Precisa dos dois: ninguém senta numa mesa que não pode pagar, e ninguém compra
    passagem pra uma mesa que não jogou pra alcançar.
    """
    i_saldo = DEGRAUS.index(degrau_por_saldo(saldo))
    return DEGRAUS[min(i_saldo, degrau_liberado(nivel))]


if __name__ == '__main__':
    print('bônus de nível:')
    for L in [1, 10, 50, 100, 250, 500, 1000, 10000]:
        print(f'   nível {L:>6}: {bonus_de_nivel(L):.2f}x   ·   degrau liberado: {DEGRAUS[degrau_liberado(L)]["nome"]}')
    print('\nlargura de um degrau, em apostas mínimas:', LARGURA_DO_DEGRAU_EM_MINIMOS)
    print('recompensa mensal no nível 1, em mínimos do Bronze:',
          round(sum(recompensa(d, 1) for d in range(1, 31)) / ANCORA))
