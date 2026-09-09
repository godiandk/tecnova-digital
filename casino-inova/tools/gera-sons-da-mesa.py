#!/usr/bin/env python3
"""
OS SONS DA MESA — sintetizados aqui, não baixados de lugar nenhum.

Por que sintetizar. O projeto não tem um único arquivo de som, e som de cassino é
justamente o tipo de coisa que se pega "de um pacote qualquer" e vira problema:
licença desconhecida, timbre de outro jogo, e nenhuma relação com o que está
acontecendo na tela. Aqui cada som é gerado por um modelo do que o objeto FAZ, com os
números à vista — do mesmo jeito que o resto da mesa é medido em vez de chutado.

O MODELO. Uma batida é um impulso que excita os modos de vibração de um corpo. Um dado
pequeno, duro, batendo em couro ou vidro soa como:

    s(t) = ruído_de_ataque(t) + Σ Aᵢ · sen(2π fᵢ t) · e^(−t/τᵢ)

onde as fᵢ são os modos do corpo e os τᵢ dizem quanto cada um segura. O que separa o
"dado no couro" do "dado no vidro" não é o volume: é o τ (o couro absorve, o vidro
devolve) e o brilho dos modos altos.

    python3 tools/gera-sons-da-mesa.py

Escreve em app/assets/sons/. Cada arquivo é WAV mono, 44100 Hz, 16 bits, com pico em
−3 dBFS (folga pra não estourar quando dois tocam juntos) e sem componente contínua.
"""
from __future__ import annotations

import math
import os
import struct
import wave

import numpy as np

TAXA = 44100
PICO_ALVO = 10 ** (-3 / 20)  # −3 dBFS
SAIDA = os.path.join(os.path.dirname(__file__), '..', 'app', 'assets', 'sons')

semente = np.random.default_rng(20260909)


def modos(duracao: float, frequencias: list[tuple[float, float, float]]) -> np.ndarray:
    """Soma de senoides amortecidas: (frequência em Hz, amplitude, tempo de queda em s)."""
    t = np.arange(int(duracao * TAXA)) / TAXA
    onda = np.zeros_like(t)
    for f, a, tau in frequencias:
        fase = semente.uniform(0, 2 * math.pi)
        onda += a * np.sin(2 * math.pi * f * t + fase) * np.exp(-t / tau)
    return onda


def ataque(duracao: float, corte: float, tau: float) -> np.ndarray:
    """O estalo do primeiro contato: ruído curto, filtrado, caindo rápido."""
    n = int(duracao * TAXA)
    r = semente.normal(0, 1, n)
    # passa-baixa de um polo: y[n] = y[n−1] + α (x[n] − y[n−1])
    alfa = 1 - math.exp(-2 * math.pi * corte / TAXA)
    y = np.zeros(n)
    for i in range(1, n):
        y[i] = y[i - 1] + alfa * (r[i] - y[i - 1])
    t = np.arange(n) / TAXA
    return y * np.exp(-t / tau)


def soma(*ondas: np.ndarray) -> np.ndarray:
    """Mistura ondas de durações diferentes: o ataque é curto, os modos seguram mais."""
    n = max(len(o) for o in ondas)
    fora = np.zeros(n)
    for o in ondas:
        fora[: len(o)] += o
    return fora


def tira_continua(onda: np.ndarray) -> np.ndarray:
    """
    BLOQUEADOR DE CONTÍNUA de um polo: y[n] = x[n] − x[n−1] + 0,995 y[n−1].

    Subtrair a média não basta. O ataque nasce de ruído passado por um passa-baixa, e
    passa-baixa de ruído tem uma deriva LENTA — a média do arquivo inteiro dá zero e
    mesmo assim o começo fica puxado pra cima e o fim pra baixo. Foi o que a conferência
    pegou nas duas fichas (contínua de ±0,0025). Este filtro tira a deriva, não só a
    média.
    """
    y = np.zeros_like(onda)
    for i in range(1, len(onda)):
        y[i] = onda[i] - onda[i - 1] + 0.995 * y[i - 1]
    return y


def normaliza(onda: np.ndarray) -> np.ndarray:
    onda = tira_continua(onda)
    """
    A RAMPA DE ENTRADA É QUASE NADA — meio milissegundo.

    Com 3 ms de entrada, como estava, a rampa comia o ATAQUE: num som de batida o pico
    está nos primeiros milissegundos, e o resultado foi um dado-com-dado saindo a −10,9
    dBFS em vez de −3. A rampa existe pra evitar clique de borda, e meio milissegundo já
    resolve isso; a saída pode ser longa porque lá o sinal já está caindo.
    """
    onda = onda - float(np.mean(onda))
    pico = float(np.max(np.abs(onda)))
    if pico == 0:
        return onda
    onda = onda / pico * PICO_ALVO
    # A RAMPA VEM POR ÚLTIMO, depois de tirar a média.
    # Na ordem inversa a subtração da média empurrava de volta o que a rampa tinha
    # zerado: a cauda terminava num degrau de 0,011 em vez de em zero, que é clique.
    entrada = int(0.0005 * TAXA)
    saida = int(0.004 * TAXA)
    if len(onda) > entrada + saida:
        onda[:entrada] *= np.linspace(0, 1, entrada)
        onda[-saida:] *= np.linspace(1, 0, saida)
    return onda


def grava(nome: str, onda: np.ndarray) -> None:
    onda = normaliza(onda)
    dados = (onda * 32767).astype('<i2')
    caminho = os.path.join(SAIDA, nome)
    with wave.open(caminho, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(TAXA)
        w.writeframes(dados.tobytes())
    print(f'  {nome:22s} {len(onda)/TAXA*1000:6.0f} ms  {os.path.getsize(caminho)/1024:6.1f} KB')


def batida_no_couro() -> np.ndarray:
    """
    O DADO CAINDO NO COURO DA TIGELA.

    Couro sobre madeira absorve: os modos altos somem em menos de 40 ms e sobra um
    corpo grave e curto. É o som mais tocado da mesa (três dados, várias batidas por
    lançamento), então ele é o mais curto de todos — som curto repetido soa como mesa,
    som longo repetido soa como bug.
    """
    return soma(ataque(0.010, 2600, 0.004) * 0.9, modos(0.18, [
        (196, 0.55, 0.045),   # o corpo da madeira embaixo do couro
        (410, 0.35, 0.030),
        (870, 0.22, 0.016),
        (1630, 0.10, 0.008),
    ]))


def batida_no_dado() -> np.ndarray:
    """
    DADO BATENDO EM DADO — mais agudo e mais seco que no couro.

    Dois corpos duros e pequenos: quase só ataque, com um modo alto que some rápido.
    """
    return soma(ataque(0.006, 7000, 0.0025), modos(0.09, [
        (1150, 0.30, 0.014),
        (2400, 0.24, 0.010),
        (3900, 0.14, 0.006),
    ]))


def copo_chacoalhando() -> np.ndarray:
    """
    O COPO ANTES DE DESPEJAR.

    Não é um som: é uma sequência de batidas dos três dados nas paredes do copo, com
    intervalos irregulares. Os intervalos saem de um sorteio, e não de um relógio —
    espaçados por igual, viram metrônomo, e ninguém acredita num copo que marca compasso.
    """
    total = int(0.62 * TAXA)
    onda = np.zeros(total)
    instante = 0.004
    while instante < 0.575:
        golpe = soma(
            ataque(0.005, 5200, 0.0022) * semente.uniform(0.5, 1.0),
            modos(0.07, [(740, 0.22, 0.012), (1580, 0.18, 0.009), (3100, 0.10, 0.005)]),
        )
        i = int(instante * TAXA)
        fim = min(total, i + len(golpe))
        onda[i:fim] += golpe[: fim - i]
        instante += semente.uniform(0.035, 0.085)
    return onda


def ficha_no_pano() -> np.ndarray:
    """
    A FICHA ENCOSTANDO NO FELTRO.

    Feltro não devolve nada: é quase só o baque do disco de argila, sem modos altos.
    """
    return soma(ataque(0.014, 900, 0.006) * 0.8, modos(0.11, [
        (150, 0.5, 0.028),
        (320, 0.28, 0.018),
        (620, 0.12, 0.010),
    ]))


def ficha_na_pilha() -> np.ndarray:
    """A FICHA CAINDO EM CIMA DE OUTRA: o baque do feltro mais o estalo da argila."""
    base = ficha_no_pano()
    estalo = soma(ataque(0.005, 4200, 0.002) * 0.5, modos(0.06, [(1900, 0.2, 0.008)]))
    onda = np.zeros(max(len(base), len(estalo)))
    onda[: len(base)] += base
    onda[: len(estalo)] += estalo
    return onda


def pagou() -> np.ndarray:
    """
    A CASA PAGANDO — duas notas curtas, a segunda uma quinta acima.

    Curto e discreto de propósito. Fanfarra de vitória é o recurso que os jogos usam pra
    fazer perder parecer ganhar; aqui o som só CONFIRMA o que o número já disse, e não
    tenta ser a recompensa. Não existe som de derrota: perder já é claro.
    """
    primeira = modos(0.28, [(587.33, 0.5, 0.10), (1174.66, 0.18, 0.06)])   # ré 5
    segunda = modos(0.34, [(880.00, 0.5, 0.14), (1760.00, 0.16, 0.08)])    # lá 5
    onda = np.zeros(int(0.5 * TAXA))
    onda[: len(primeira)] += primeira
    i = int(0.11 * TAXA)
    onda[i : i + len(segunda)] += segunda
    return onda


if __name__ == '__main__':
    os.makedirs(SAIDA, exist_ok=True)
    print('sons da mesa:')
    grava('batida-no-couro.wav', batida_no_couro())
    grava('batida-no-dado.wav', batida_no_dado())
    grava('copo.wav', copo_chacoalhando())
    grava('ficha-no-pano.wav', ficha_no_pano())
    grava('ficha-na-pilha.wav', ficha_na_pilha())
    grava('pagou.wav', pagou())
