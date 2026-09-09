#!/usr/bin/env python3
"""
Gera os TRÊS dados da Banca Francesa — azul, verde e vermelho — a partir de um molde.

    python3 tools/gera-dados-coloridos.py \
        app/assets/images/dados/marca \
        app/assets/images/dados/banca-francesa

POR QUE GERAR EM VEZ DE DESENHAR TRÊS CONJUNTOS. Na Banca Francesa os três dados são
iguais em tudo, menos na cor — mesmo tamanho, mesmo canto arredondado, mesma marca dos
pontos, mesma luz. É essa igualdade que faz a mesa ler: quando os três param, quem olha
compara TRÊS NÚMEROS, e qualquer diferença de feitio entre eles vira ruído.

Dezoito desenhos separados (três cores x seis faces) nunca ficam iguais nesse nível de
detalhe. Três cores do mesmo desenho ficam iguais por construção.

POR QUE TRÊS CORES, E NÃO TRÊS DADOS BRANCOS. A cor é o que amarra o dado ao placar: o
lançamento é guardado como `dice: [azul, verde, vermelho]`, sempre nessa ordem, e a tela
do resultado mostra "azul 4, verde 5, vermelho 6". Sem cor, a ordem não teria como ser
conferida a olho — o jogador leria três números soltos e teria que confiar.

O QUE MUDA E O QUE NÃO MUDA. Muda a MATIZ do corpo do dado. Não mudam os pontos (são
claros e de baixa saturação, e ficam de fora do remapeamento), nem o BRILHO de nenhum
pixel — o relevo, o reflexo do canto e a sombra continuam sendo os da arte original.

A CONFERÊNCIA NO FIM. O script mede a distância de cor (CIELAB dE76) entre os três
corpos. Dois dados na mesma mesa precisam ser distinguíveis num relance; abaixo de dE 25
não são. Se alguém mexer na tabela CORES, a saída avisa na hora.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

# (matiz alvo em graus, quanto multiplicar a saturação). A matiz do molde é medida.
CORES = {
    'azul':     (212, 1.00),
    'verde':    (None, 1.00),   # None = fica como está: o molde já é verde
    'vermelho': (  2, 1.05),
}

#: Abaixo desta saturação o pixel é reflexo, borda clara ou sombra — não se tinge.
SATURACAO_DO_CORPO = 0.22

#: A faixa de matiz do CORPO do dado no molde, em graus.
#:
#: Medida no próprio arquivo, varrendo o histograma de matiz da face 5: o corpo verde
#: ocupa de 120 a 160 graus (32.726 pixels) e os PONTOS ocupam de 20 a 60 (2.223 pixels,
#: e mais claros). São duas coisas separadas, e a primeira versão deste script tratava as
#: duas como uma só — o dado azul saía com pontos azuis e o vermelho com pontos
#: vermelhos, perdendo justamente o contraste que faz o número ser lido de longe.
#:
#: Os pontos dourados ficam iguais nas três cores, e isso é o certo: eles são a marca da
#: casa, como o brasão da ficha. O que muda entre os dados é a cor do corpo, e só.
MATIZ_DO_CORPO = (90, 180)


def rgb_para_hsv(a):
    """a em 0..1, forma (..., 3). Devolve (matiz 0..1, saturação 0..1, valor 0..1)."""
    maximo = a.max(axis=-1)
    minimo = a.min(axis=-1)
    delta = maximo - minimo
    v = maximo
    s = np.where(maximo == 0, 0, delta / np.maximum(maximo, 1e-9))

    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    h = np.zeros_like(maximo)
    seguro = delta > 1e-9
    with np.errstate(invalid='ignore'):
        h = np.where(seguro & (maximo == r), ((g - b) / np.maximum(delta, 1e-9)) % 6, h)
        h = np.where(seguro & (maximo == g), (b - r) / np.maximum(delta, 1e-9) + 2, h)
        h = np.where(seguro & (maximo == b), (r - g) / np.maximum(delta, 1e-9) + 4, h)
    return (h / 6) % 1.0, s, v


def hsv_para_rgb(h, s, v):
    i = np.floor(h * 6).astype(int)
    f = h * 6 - i
    p, q, t = v * (1 - s), v * (1 - f * s), v * (1 - (1 - f) * s)
    i = i % 6
    r = np.select([i == 0, i == 1, i == 2, i == 3, i == 4, i == 5], [v, q, p, p, t, v])
    g = np.select([i == 0, i == 1, i == 2, i == 3, i == 4, i == 5], [t, v, v, q, p, p])
    b = np.select([i == 0, i == 1, i == 2, i == 3, i == 4, i == 5], [p, p, t, v, v, q])
    return np.stack([r, g, b], axis=-1)


def para_lab(rgb):
    """sRGB 0..255 -> CIELAB. Só pra medir se duas cores são distinguíveis."""
    c = np.asarray(rgb, float) / 255
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.array([116 * f[1] - 16, 500 * (f[0] - f[1]), 200 * (f[1] - f[2])])


def tingir(imagem: Image.Image, matiz_alvo, ganho_de_saturacao):
    a = np.array(imagem.convert('RGBA')).astype(float)
    rgb, alfa = a[..., :3] / 255, a[..., 3]

    h, s, v = rgb_para_hsv(rgb)
    graus = h * 360
    corpo = (
        (s >= SATURACAO_DO_CORPO)
        & (alfa > 8)
        & (graus >= MATIZ_DO_CORPO[0])
        & (graus <= MATIZ_DO_CORPO[1])
    )

    if matiz_alvo is not None:
        h = np.where(corpo, matiz_alvo / 360.0, h)
        s = np.where(corpo, np.clip(s * ganho_de_saturacao, 0, 1), s)

    novo = hsv_para_rgb(h, s, v) * 255
    saida = a.copy()
    saida[..., :3] = np.where(corpo[..., None], novo, a[..., :3])
    return Image.fromarray(np.clip(saida, 0, 255).astype('uint8'), 'RGBA'), corpo


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        return 1
    molde, destino = Path(sys.argv[1]), Path(sys.argv[2])
    destino.mkdir(parents=True, exist_ok=True)

    corpos = {}
    for cor, (matiz, ganho) in CORES.items():
        pasta = destino / cor
        pasta.mkdir(exist_ok=True)
        for face in range(1, 7):
            origem = molde / f'face-{face}.png'
            im = Image.open(origem)
            tingida, corpo = tingir(im, matiz, ganho)
            tingida.save(pasta / f'face-{face}.png')
            if face == 1:
                a = np.array(tingida)
                corpos[cor] = a[..., :3][corpo].mean(axis=0)
        print(f'{cor:9s} -> {pasta}/face-1..6.png   corpo RGB {corpos[cor].round().astype(int)}')

    print('\ndistância de cor entre os três corpos (CIELAB dE76; abaixo de 25 confunde):')
    nomes = list(corpos)
    pior = 1e9
    for i in range(len(nomes)):
        for j in range(i + 1, len(nomes)):
            d = float(np.linalg.norm(para_lab(corpos[nomes[i]]) - para_lab(corpos[nomes[j]])))
            pior = min(pior, d)
            print(f'  {nomes[i]:9s} x {nomes[j]:9s}  dE {d:6.1f}  {"ok" if d >= 25 else "PERTO DEMAIS"}')
    print(f'\n{"OK" if pior >= 25 else "PROBLEMA"}: a menor distância é dE {pior:.1f}.')
    return 0 if pior >= 25 else 1


if __name__ == '__main__':
    sys.exit(main())
