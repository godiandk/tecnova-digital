# -*- coding: utf-8 -*-
"""Selo Contido — os seis selos em falta dos modelos TECNOVA.

Desenhados a 2048px e reduzidos para 512, porque a única prova que conta é
como ficam pequenos. Nada toca a borda; o anel interior é sempre 1/110 do
diâmetro; a letra é centrada opticamente pelo seu próprio contorno, não pela
caixa da fonte.
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os, math

FONTES = '/root/.claude/skills/canvas-design/canvas-fonts'
SAIDA  = '/workspace/tecnova-digital/img/modelos'
G      = 2048                      # grelha de trabalho
FINAL  = 512

def hx(c):
    c = c.lstrip('#')
    return tuple(int(c[i:i+2], 16) for i in (0, 2, 4))

def mistura(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))

def disco(cor_a, cor_b, angulo=52):
    """Gradiente linear contínuo, sempre na mesma diagonal — é isto que faz a
    série parecer iluminada pela mesma janela."""
    g = Image.new('RGB', (G, G))
    px = g.load()
    rad = math.radians(angulo)
    dx, dy = math.cos(rad), math.sin(rad)
    # projecção normalizada de cada ponto sobre o eixo do gradiente
    lo = min(0*dx+0*dy, G*dx+0*dy, 0*dx+G*dy, G*dx+G*dy)
    hi = max(0*dx+0*dy, G*dx+0*dy, 0*dx+G*dy, G*dx+G*dy)
    for y in range(G):
        base = y * dy
        for x in range(G):
            t = ((x * dx + base) - lo) / (hi - lo)
            px[x, y] = mistura(cor_a, cor_b, t)
    return g

def mascara_circulo(margem=0):
    m = Image.new('L', (G*2, G*2), 0)
    ImageDraw.Draw(m).ellipse([margem*2, margem*2, G*2-margem*2, G*2-margem*2], fill=255)
    return m.resize((G, G), Image.LANCZOS)

def desenhar_letra(texto, ficheiro, tamanho, cor, peso_extra=0):
    """Devolve uma camada RGBA só com a letra, já recortada."""
    f = ImageFont.truetype(os.path.join(FONTES, ficheiro), tamanho)
    tmp = Image.new('L', (G, G), 0)
    d = ImageDraw.Draw(tmp)
    d.text((G//2, G//2), texto, font=f, fill=255, anchor='mm',
           stroke_width=peso_extra, stroke_fill=255)
    caixa = tmp.getbbox()
    if not caixa:
        raise ValueError('letra vazia: ' + texto)
    # centragem óptica: pelo contorno real da forma, não pela métrica da fonte
    cx = (caixa[0] + caixa[2]) / 2
    cy = (caixa[1] + caixa[3]) / 2
    tmp = tmp.transform((G, G), Image.AFFINE, (1, 0, cx - G/2, 0, 1, cy - G/2),
                        resample=Image.BICUBIC)
    camada = Image.new('RGBA', (G, G), cor + (0,))
    camada.putalpha(tmp)
    return camada, caixa

def encaixar(texto, ficheiro, cor, largura_alvo, peso_extra=0):
    """Procura o corpo de letra que dá exactamente a largura pedida (fracção do
    diâmetro). É assim que a proporção sobrevive a qualquer redução."""
    baixo, alto = 100, 1900
    melhor = None
    for _ in range(22):
        meio = (baixo + alto) // 2
        camada, caixa = desenhar_letra(texto, ficheiro, meio, cor, peso_extra)
        larg = caixa[2] - caixa[0]
        alt  = caixa[3] - caixa[1]
        medida = max(larg, alt)
        melhor = camada
        if medida < largura_alvo: baixo = meio + 1
        else: alto = meio - 1
    return melhor

def anel(img, cor, raio_frac, espessura_frac, alpha=255):
    """Anel finíssimo — não é contorno, é a promessa de que alguém mediu isto."""
    s = 3
    m = Image.new('L', (G*s, G*s), 0)
    d = ImageDraw.Draw(m)
    r = G * raio_frac
    e = max(1, G * espessura_frac)
    cx = G/2
    d.ellipse([(cx-r)*s, (cx-r)*s, (cx+r)*s, (cx+r)*s], outline=255, width=round(e*s))
    m = m.resize((G, G), Image.LANCZOS)
    if alpha < 255:
        m = m.point(lambda v: v * alpha // 255)
    cap = Image.new('RGBA', (G, G), cor + (0,))
    cap.putalpha(m)
    img.alpha_composite(cap)

def brilho(img, centro=(0.34, 0.26), raio=0.62, forca=34):
    """Luz vinda da mesma janela em todos os selos."""
    m = Image.new('L', (G, G), 0)
    d = ImageDraw.Draw(m)
    cx, cy = centro[0]*G, centro[1]*G
    r = raio*G
    passos = 90
    for i in range(passos, 0, -1):
        t = i/passos
        rr = r*t
        d.ellipse([cx-rr, cy-rr, cx+rr, cy+rr], fill=int(forca*(1-t)**1.7))
    m = m.filter(ImageFilter.GaussianBlur(G*0.05))
    cap = Image.new('RGBA', (G, G), (255, 255, 255, 0))
    cap.putalpha(m)
    img.alpha_composite(cap)


# ---------------------------------------------------------------- os seis selos
# Cada entrada: pasta, dois tons do disco, cor da marca, a marca, a fonte,
# a largura da marca em fracção do diâmetro, e o gesto interior próprio.
SELOS = [
  # Regra do sistema: o disco tem de se destacar do cabeçalho onde vive.
  # Cabeçalho escuro pede disco claro; cabeçalho creme pede disco fundo.
  # A barbearia era oxblood sobre castanho quase preto (1,9:1) e sumia-se;
  # passa a dourado, que é a outra cor da casa — 11,7:1.
  dict(pasta='barbearia',   a='#e3cd86', b='#b8902a', marca='#1a1210',
       letra='I', fonte='Gloock-Regular.ttf', frac=.38, gesto='duplo'),
  # a estética vive sobre creme: rosa pálido dava 1,1:1. Invertido — disco
  # fundo, letra creme — dá 4,3:1 sem sair da paleta.
  dict(pasta='estetica',    a='#a85b78', b='#7d3a55', marca='#fdf6f8',
       letra='B', fonte='Italiana-Regular.ttf', frac=.44, gesto='simples'),
  dict(pasta='restaurante', a='#e79a63', b='#b45c25', marca='#2b1809',
       letra='S', fonte='YoungSerif-Regular.ttf', frac=.40, gesto='prato'),
  dict(pasta='ginasio',     a='#d4ff5c', b='#93bd22', marca='#0a0a0a',
       letra='P', fonte='BigShoulders-Bold.ttf', frac=.48, gesto='disco'),
  dict(pasta='oficina',     a='#7cc0e6', b='#2f7ba6', marca='#08131a',
       letra='A', fonte='Tektur-Medium.ttf', frac=.42, gesto='rebites'),
  dict(pasta='salao',       a='#eec2e4', b='#b76aa6', marca='#2a0f24',
       letra='G', fonte='PoiretOne-Regular.ttf', frac=.46, gesto='duplo'),
]

def gesto_simples(img, cor):
    """um só anel finíssimo — a promessa de que alguém mediu isto"""
    anel(img, cor, .432, 1/135, alpha=125)

def gesto_duplo(img, cor):
    """dois anéis a distância desigual: lê-se como intenção, não como erro"""
    anel(img, cor, .440, 1/150, alpha=110)
    anel(img, cor, .400, 1/95,  alpha=150)

def gesto_prato(img, cor):
    """restaurante — o aro da louça, largo e baixo de contraste"""
    anel(img, cor, .424, .0090, alpha=130)

def gesto_disco(img, cor):
    """ginásio — o aro grosso de um disco de peso, aberto em dois lados"""
    s = 3
    m = Image.new('L', (G*s, G*s), 0); d = ImageDraw.Draw(m)
    r = G*0.425; e = G*0.020
    for ini in (104, 284):
        d.arc([(G/2-r)*s, (G/2-r)*s, (G/2+r)*s, (G/2+r)*s], ini, ini+152,
              fill=255, width=round(e*s))
    m = m.resize((G, G), Image.LANCZOS).point(lambda v: v*150//255)
    cap = Image.new('RGBA', (G, G), cor+(0,)); cap.putalpha(m); img.alpha_composite(cap)

def gesto_rebites(img, cor):
    """oficina — rebites regulares no bordo"""
    s = 3
    m = Image.new('L', (G*s, G*s), 0); d = ImageDraw.Draw(m)
    r = G*0.418; e = G*0.0125
    for i in range(12):
        ang = math.radians(i*30 + 15)
        x, y = G/2 + r*math.cos(ang), G/2 + r*math.sin(ang)
        d.ellipse([(x-e)*s, (y-e)*s, (x+e)*s, (y+e)*s], fill=255)
    m = m.resize((G, G), Image.LANCZOS).point(lambda v: v*165//255)
    cap = Image.new('RGBA', (G, G), cor+(0,)); cap.putalpha(m); img.alpha_composite(cap)

GESTOS = dict(simples=gesto_simples, duplo=gesto_duplo, prato=gesto_prato,
              disco=gesto_disco, rebites=gesto_rebites)


def construir(s):
    margem = round(G*0.012)                       # nada toca a borda
    base = disco(hx(s['a']), hx(s['b'])).convert('RGBA')
    base.putalpha(mascara_circulo(margem))
    brilho(base)

    marca = hx(s['marca'])
    GESTOS[s['gesto']](base, marca)

    letra = encaixar(s['letra'], s['fonte'], marca, G*s['frac'])
    base.alpha_composite(letra)

    fora = base.resize((FINAL, FINAL), Image.LANCZOS)
    pasta = os.path.join(SAIDA, s['pasta'])
    os.makedirs(pasta, exist_ok=True)
    caminho = os.path.join(pasta, 'logo.png')
    fora.save(caminho, optimize=True)
    return caminho, fora


if __name__ == '__main__':
    feitos = []
    for s in SELOS:
        c, im = construir(s)
        print('%-14s %s' % (s['pasta'], c))
        feitos.append((s['pasta'], im))

    # folha de prova: grande em cima, 40px em baixo — a segunda é a que conta
    from PIL import Image as I
    conf = I.open(os.path.join(SAIDA, 'confeitaria', 'logo.png')).convert('RGBA').resize((512, 512), I.LANCZOS)
    todos = feitos + [('confeitaria', conf)]
    lin = len(todos)
    prova = I.new('RGB', (150*lin, 220), (28, 24, 20))
    for i, (nome, im) in enumerate(todos):
        prova.paste(im.resize((110, 110), I.LANCZOS), (150*i+20, 16), im.resize((110, 110), I.LANCZOS))
        p = im.resize((40, 40), I.LANCZOS)
        prova.paste(p, (150*i+55, 150), p)
    prova.save('/tmp/claude-0/-home-user-godiandk/1e2aa493-b0d0-5406-875e-37168533ac6a/scratchpad/prova-selos.png')
    print('prova guardada')
