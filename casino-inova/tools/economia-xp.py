"""A CURVA DE XP e a economia conectada — a conta que sustenta docs/economia.md §H a §J.

Nada aqui está implementado no jogo. É o modelo que produziu as tabelas, guardado pra que
os números possam ser refeitos e contestados.

    python3 tools/economia-xp.py
"""
import importlib.util, math, os

_aqui = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('economia_modelo', os.path.join(_aqui, 'economia-modelo.py'))
_m = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(_m)
globals().update({k: v for k, v in vars(_m).items() if not k.startswith('__')})

ANCORA = DEGRAUS[0]['minimo']

# ---------------- XP ----------------
XP_NA_FICHA_MAIOR, R_REF, TETO_RODADA, TETO_DIA = 50, 20, 60, 60_000
def xp_da_rodada(aposta, minimo_do_tier):
    if aposta <= 0 or minimo_do_tier <= 0: return 0
    r = aposta / minimo_do_tier
    return int(min(TETO_RODADA, XP_NA_FICHA_MAIOR * math.log(1 + r) / math.log(1 + R_REF)))
A_CUSTO, EXPO = 197.0, 0.5
def custo_do_nivel(n): return round(A_CUSTO * (max(1, n) ** EXPO))

# ---------------- degraus liberados pelo nível ----------------
# Geométrico, e o Eclipse fica no 10.000: o topo da escada é o topo da progressão.
NIVEL_DO_DEGRAU = [1, 20, 50, 100, 200, 400, 700, 1200, 2000, 3500, 6000, 10000]
def degrau_liberado(nivel):
    i = 0
    for k, exigido in enumerate(NIVEL_DO_DEGRAU):
        if nivel >= exigido: i = k
    return i

def degrau_economico(saldo, nivel):
    return DEGRAUS[min(DEGRAUS.index(degrau_por_saldo(saldo)), degrau_liberado(nivel))]

# ---------------- bônus, loja, recompensa ----------------
def bonus_de_nivel(nivel): return min(3.0, 1 + 0.5 * math.log10(max(1, nivel)))
K_PACOTE = {'R$ 9,90': 100, 'R$ 24,90': 300, 'R$ 59,90': 800, 'R$ 149,90': 2400}
def pacote(preco, saldo, nivel):
    return round(K_PACOTE[preco] * degrau_economico(saldo, nivel)['minimo'] * bonus_de_nivel(nivel))
def mult_do_dia(dia, dias_do_mes):
    if dia == dias_do_mes: return 500
    return {7: 60, 14: 120, 21: 200}.get(dia, 8 + 2 * dia)
def recompensa(dia, nivel, dias_do_mes=30):
    return round(ANCORA * mult_do_dia(dia, dias_do_mes) * bonus_de_nivel(nivel))

PERFIS = {'casual': (200, 2), 'regular': (600, 5), 'ativo': (1200, 10), 'hardcore': (2400, 20)}


if __name__ == '__main__':
    acum, T = 0, {}
    for n in range(1, 10001):
        T[n] = acum; acum += custo_do_nivel(n)

    def xp_por_dia(p):
        rod, r = PERFIS[p]
        return min(TETO_DIA, rod * xp_da_rodada(r, 1))

    def humano(d):
        if d < 1: return f'{d*24:.0f} h'
        if d < 60: return f'{d:.0f} dias'
        if d < 730: return f'{d/30.4:.1f} meses'
        return f'{d/365:.1f} anos'

    print('XP por rodada, em múltiplos do mínimo da mesa:')
    for mult in [1, 2, 5, 10, 25, 50, 100, 1000]:
        print(f'   {mult:>5}x → {xp_da_rodada(mult, 1):>3} XP')
    print(f'\nteto por rodada {TETO_RODADA} · teto por dia {TETO_DIA:,}'.replace(',', '.'))

    print('\nprogressão:')
    print(f"   {'nível':>7}" + ''.join(f'{p:>12}' for p in PERFIS))
    for n in [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000]:
        print(f'   {n:>7}' + ''.join(f'{humano(T[n]/xp_por_dia(p)):>12}' for p in PERFIS))

    print('\ndegraus abertos pelo nível:')
    for i, d in enumerate(DEGRAUS):
        print(f'   {d["nome"]:>10} a partir do nível {NIVEL_DO_DEGRAU[i]:>6}')
