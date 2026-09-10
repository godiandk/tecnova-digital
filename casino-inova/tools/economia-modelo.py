"""Modelo da economia do Casino Inova, com as constantes reais do projeto."""
import math

# ---- degraus de mesa (niveis-de-mesa.ts) ----
NOMES = ['Bronze','Prata','Ouro','Diamante','Rubi','Safira','Esmeralda','Ônix','Platina','Titânio','Cristal','Eclipse']
DEGRAUS = [{'nome':'Bronze','entrada':0,'minimo':50}]
for i in range(1, 12):
    entrada = 5 * 10 ** (i + 3)
    DEGRAUS.append({'nome': NOMES[i], 'entrada': entrada, 'minimo': entrada // 100})

def degrau_por_saldo(saldo):
    escolhido = DEGRAUS[0]
    for d in DEGRAUS:
        if saldo >= d['entrada']:
            escolhido = d
    return escolhido

# ---- XP (progressao/niveis.ts) ----
XP_TETO_POR_RODADA = 50
def xp_da_rodada(aposta):
    if aposta <= 0: return 0
    return min(1 + math.isqrt(int(aposta) // 10), XP_TETO_POR_RODADA)
def xp_do_nivel(n):
    return 500 + max(0, n - 1) * 250
def xp_acumulado_ate(n):
    # soma de xp_do_nivel(1..n-1)
    m = n - 1
    if m <= 0: return 0
    return 500 * m + 250 * m * (m - 1) // 2

# ---- recompensa diária de HOJE (recompensas/calendario.ts) ----
MARCOS_HOJE = {7: 60, 14: 120, 21: 200, 30: 500}
def mult_do_dia_hoje(dia):
    return MARCOS_HOJE.get(dia, 8 + 2 * dia)
SOMA_MES_HOJE = sum(mult_do_dia_hoje(d) for d in range(1, 31))   # 1874

# ---- loja de hoje (store.service.ts) ----
PACOTES_HOJE = [('R$ 9,90', 5_000), ('R$ 24,90', 15_000), ('R$ 59,90', 40_000), ('R$ 149,90', 120_000)]

# ---- casa ----
RTP_SLOT = 0.9599224
MARGEM_SLOT = 1 - RTP_SLOT
SALDO_INICIAL = 10_000

def fmt(n):
    n = float(n)
    for lim, suf in [(1e15,'qua'),(1e12,'tri'),(1e9,'bi'),(1e6,'mi'),(1e3,'mil')]:
        if abs(n) >= lim:
            return f'{n/lim:,.1f} {suf}'.replace(',', 'X').replace('.', ',').replace('X', '.')
    return f'{n:,.0f}'.replace(',', '.')
