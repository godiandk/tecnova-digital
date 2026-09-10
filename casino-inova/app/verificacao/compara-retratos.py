#!/usr/bin/env python3
"""
COMPARA DOIS RETRATOS E DIZ O QUE MUDOU.

Existe porque conferência de layout por olho não escala: dez jogos, dois tamanhos, e
ninguém percebe que a placa do bacará andou três pixels — até alguém perceber, seis
semanas depois, e não saber qual mudança fez aquilo.

TRÊS DECISÕES QUE DECIDEM SE ISSO SERVE OU VIRA RUÍDO:

1. COMPARA COR COMO O OLHO VÊ, não como o arquivo guarda. Dois tons de verde com a mesma
   distância em RGB podem ser indistinguíveis num caso e óbvios no outro. A conta é em
   CIELAB, com dE76, que é a mesma régua que o resto do projeto já usa para cor.

2. TEM MÁSCARA. Saldo, relógio e nome de jogador mudam a cada execução e não são layout.
   Sem poder apagá-los antes de comparar, todo retrato acusaria diferença e a conferência
   seria desligada na primeira semana — que é o pior desfecho possível.

3. NÃO É "IGUAL OU DIFERENTE". Devolve QUANTOS por cento dos pixels mudaram e ONDE, e
   grava uma imagem do diagnóstico. Um por cento espalhado é reamostragem de fonte; um por
   cento concentrado num canto é um elemento que andou. São coisas diferentes e o número
   sozinho não separa as duas — a imagem separa.

    python3 compara-retratos.py base.png atual.png diff.png [--mascara x,y,w,h ...]
"""
import sys

import numpy as np
from PIL import Image

#: Distância de cor (dE76) a partir da qual dois pixels contam como diferentes.
#: 2,3 é o limiar clássico de "diferença apenas perceptível"; abaixo disso é ruído de
#: compressão e de reamostragem, e contar isso encheria o relatório de falso positivo.
LIMIAR_DE_COR = 2.3


def para_lab(imagem: np.ndarray) -> np.ndarray:
    """sRGB 0-255 para CIELAB. A conversão inteira, sem atalho de biblioteca."""
    v = imagem.astype(np.float64) / 255.0
    v = np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4)
    m = np.array([
        [0.4124564, 0.3575761, 0.1804375],
        [0.2126729, 0.7151522, 0.0721750],
        [0.0193339, 0.1191920, 0.9503041],
    ])
    xyz = v @ m.T
    branco = np.array([0.95047, 1.00000, 1.08883])
    t = xyz / branco
    d = 6.0 / 29.0
    f = np.where(t > d ** 3, np.cbrt(t), t / (3 * d * d) + 4.0 / 29.0)
    fx, fy, fz = f[..., 0], f[..., 1], f[..., 2]
    return np.stack([116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)], axis=-1)


def comparar(caminho_base: str, caminho_atual: str, mascaras=()):
    """Devolve (por_cento_mudado, mapa_de_diferenca, aviso_ou_None)."""
    base = Image.open(caminho_base).convert('RGB')
    atual = Image.open(caminho_atual).convert('RGB')

    if base.size != atual.size:
        # Tamanho diferente NÃO é comparável, e fingir que é (redimensionando) esconderia
        # justamente a mudança mais grave: a tela inteira mudou de forma.
        return 100.0, None, f'tamanho mudou: base {base.size}, atual {atual.size}'

    a = np.asarray(base)
    b = np.asarray(atual)
    distancia = np.sqrt(np.sum((para_lab(a) - para_lab(b)) ** 2, axis=-1))

    # A máscara zera a região ANTES de contar: ali a diferença é esperada.
    considerar = np.ones(distancia.shape, dtype=bool)
    for (x, y, largura, altura) in mascaras:
        considerar[y:y + altura, x:x + largura] = False

    mudou = (distancia > LIMIAR_DE_COR) & considerar
    olhados = int(considerar.sum())
    por_cento = (100.0 * int(mudou.sum()) / olhados) if olhados else 0.0
    return por_cento, mudou, None


def gravar_diagnostico(caminho_atual: str, mudou: np.ndarray, saida: str, mascaras=()) -> None:
    """A imagem de diagnóstico: o retrato apagado, o que mudou em vermelho, a máscara em azul."""
    atual = np.asarray(Image.open(caminho_atual).convert('RGB')).astype(np.float64)
    cinza = atual.mean(axis=-1, keepdims=True).repeat(3, axis=-1) * 0.35
    cinza[mudou] = [255, 40, 40]
    for (x, y, largura, altura) in mascaras:
        faixa = cinza[y:y + altura, x:x + largura]
        # Azul por cima, translúcido: dá pra ver o que estava lá e que foi ignorado.
        cinza[y:y + altura, x:x + largura] = faixa * 0.5 + np.array([20, 60, 160]) * 0.5
    Image.fromarray(cinza.astype(np.uint8)).save(saida)


def main() -> int:
    argumentos = sys.argv[1:]
    mascaras = []
    while '--mascara' in argumentos:
        i = argumentos.index('--mascara')
        mascaras.append(tuple(int(n) for n in argumentos[i + 1].split(',')))
        del argumentos[i:i + 2]

    if len(argumentos) < 2:
        print(__doc__)
        return 2

    base, atual = argumentos[0], argumentos[1]
    saida = argumentos[2] if len(argumentos) > 2 else None

    por_cento, mudou, aviso = comparar(base, atual, mascaras)
    if aviso:
        print(f'{por_cento:.3f} {aviso}')
        return 1
    if saida is not None and mudou is not None and por_cento > 0:
        gravar_diagnostico(atual, mudou, saida, mascaras)
    print(f'{por_cento:.3f}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
