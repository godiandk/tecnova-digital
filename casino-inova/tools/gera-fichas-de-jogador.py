#!/usr/bin/env python3
"""
Gera as quinze fichas de JOGADOR a partir de UMA ficha.

    python3 tools/gera-fichas-de-jogador.py \
        app/assets/images/fichas/valores/ficha-verde.png \
        app/assets/images/fichas

POR QUE GERAR EM VEZ DE DESENHAR QUINZE. Num cassino as fichas de uma mesa saem todas do
mesmo molde: mesmo relevo, mesmas casas brancas na borda, mesmo brasao no meio. Muda so
a cor do corpo, e e justamente por isso que da pra saber de quem e cada pilha num olhar.
Quinze desenhos separados nunca ficam iguais nesse nivel de detalhe; quinze cores do
mesmo desenho ficam iguais por construcao.

E os arquivos que existiam antes provavam o problema: eram recortes tortos de uma folha
de contato, com o disco ocupando de 56% a 96% do quadro conforme o arquivo, varios com
pedaco da ficha vizinha no canto e alguns cortados na borda. Na tela, fichas do mesmo
trilho apareciam em tamanhos diferentes, todas menores do que o codigo pedia, com um
farelo colorido embaixo.

O QUE MUDA E O QUE NAO MUDA. O corpo (a matiz verde, medida no histograma da ficha de
origem) vira a cor do jogador. O dourado do brasao nao e tocado: e a marca da casa, e e
igual em todas. O BRILHO de cada pixel e remapeado, nao multiplicado, entao o relevo, o
reflexo da borda e a textura continuam sendo os da foto original.

A NOTA DE ACESSIBILIDADE. O script termina medindo a distancia de cor (CIELAB dE76)
entre todos os 105 pares e imprime os mais parecidos. Duas fichas na mesma mesa precisam
ser distinguiveis; abaixo de dE 20 nao sao. Se alguem mexer na tabela CORES, essa saida
diz na hora se quebrou.
"""
import numpy as np, sys
from PIL import Image

# (matiz em graus, saturacao, piso de brilho, teto de brilho). matiz None = acromatica.
# A ordem e os nomes tem que bater com PLAYER_COLORS em
# server/src/modules/rooms/player-colors.ts: e o servidor que da a cor a quem senta.
CORES = {
    'branco':       (None, 0.05, 0.72, 0.99),
    'cinza-claro':  (None, 0.04, 0.40, 0.64),
    'vermelho':     (   2, 0.88, 0.30, 0.72),
    'vinho':        ( 346, 0.86, 0.11, 0.32),
    'coral':        (  12, 0.60, 0.54, 0.94),
    'laranja':      (  26, 0.94, 0.42, 0.86),
    'marrom':       (  30, 0.60, 0.22, 0.48),
    'amarelo':      (  48, 0.92, 0.60, 0.99),
    'verde-limao':  (  88, 0.82, 0.42, 0.84),
    'ciano':        ( 186, 0.78, 0.46, 0.88),
    'azul':         ( 210, 0.88, 0.34, 0.74),
    'azul-marinho': ( 224, 0.88, 0.11, 0.33),
    'roxo':         ( 282, 0.82, 0.26, 0.62),
    'lilas':        ( 278, 0.40, 0.60, 0.96),
    'rosa':         ( 332, 0.52, 0.62, 0.97),
}

def hsv(rgb):
    mx, mn = rgb.max(2), rgb.min(2); dif = mx - mn
    s = np.divide(dif, mx, out=np.zeros_like(mx), where=mx > 1e-6)
    h = np.zeros_like(mx); m = dif > 1e-6
    r, g, b = rgb[:,:,0], rgb[:,:,1], rgb[:,:,2]
    with np.errstate(invalid='ignore', divide='ignore'):
        i = m & (mx == r); h[i] = (60 * ((g - b) / dif)[i]) % 360
        i = m & (mx == g); h[i] = (60 * (2 + (b - r) / dif))[i]
        i = m & (mx == b); h[i] = (60 * (4 + (r - g) / dif))[i]
    return h, s, mx

def para_rgb(h, s, v):
    c = v * s
    x = c * (1 - np.abs(((h / 60.0) % 2) - 1))
    m = v - c; z = np.zeros_like(h)
    f = (h / 60).astype(int) % 6
    sel = lambda a: np.select([f==0,f==1,f==2,f==3,f==4,f==5], a)
    return np.dstack([sel([c,x,z,z,x,c]) + m, sel([x,c,c,x,z,z]) + m, sel([z,z,x,c,c,x]) + m])

def lab(rgb):
    r = np.where(rgb > 0.04045, ((rgb + 0.055) / 1.055) ** 2.4, rgb / 12.92)
    X = r[...,0]*0.4124 + r[...,1]*0.3576 + r[...,2]*0.1805
    Y = r[...,0]*0.2126 + r[...,1]*0.7152 + r[...,2]*0.0722
    Z = r[...,0]*0.0193 + r[...,1]*0.1192 + r[...,2]*0.9505
    f = lambda t: np.where(t > 0.008856, np.cbrt(t), 7.787*t + 16/116)
    fx, fy, fz = f(X/0.95047), f(Y), f(Z/1.08883)
    return np.stack([116*fy - 16, 500*(fx-fy), 200*(fy-fz)], -1)

base = np.asarray(Image.open(sys.argv[1]).convert('RGBA')).astype(np.float32) / 255
rgb, alfa = base[:,:,:3], base[:,:,3]
h, s, v = hsv(rgb)
CORPO = (h >= 90) & (h <= 175) & (s > 0.20)

# O brilho do corpo é remapeado de [p05, p95] pra [piso, teto] da cor. Assim cada ficha
# tem uma CLAREZA escolhida — é isso que separa branco de cinza — em vez de um
# multiplicador que satura e achata as claras todas no mesmo lugar.
lo, hi = np.percentile(v[CORPO], 5), np.percentile(v[CORPO], 95)
t = np.clip((v - lo) / (hi - lo), 0, 1)

medias = {}
for nome, (matiz, satur, piso, teto) in CORES.items():
    nh, ns, nv = h.copy(), s.copy(), v.copy()
    if matiz is not None: nh[CORPO] = matiz
    ns[CORPO] = satur
    nv[CORPO] = piso + t[CORPO] * (teto - piso)
    saida = np.clip(para_rgb(nh, ns, nv), 0, 1)
    Image.fromarray(np.dstack([(saida*255).astype(np.uint8), (alfa*255).astype(np.uint8)]), 'RGBA') \
         .save(f'{sys.argv[2]}/ficha-{nome}.png')
    medias[nome] = lab(saida[CORPO].reshape(-1,1,3)).reshape(-1,3).mean(0)

nomes = list(CORES)
pares = sorted(
    ((float(np.linalg.norm(medias[a] - medias[b])), a, b)
     for i, a in enumerate(nomes) for b in nomes[i+1:]),
)
print(f"{len(nomes)} fichas. Distancia de cor (CIELAB dE76) entre os pares mais parecidos:")
for d, a, b in pares[:8]:
    marca = '  <-- PERTO DEMAIS' if d < 20 else ''
    print(f"  {d:6.1f}  {a:14s} x {b}{marca}")
print(f"  ...\n  {pares[-1][0]:6.1f}  {pares[-1][1]} x {pares[-1][2]}  (o par mais distante)")
