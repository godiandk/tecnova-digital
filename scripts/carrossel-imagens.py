# -*- coding: utf-8 -*-
"""
Faz as variantes do carrossel a partir dos originais.

PORQUE E QUE ISTO EXISTE
Os originais vem do ChatGPT em 1536x1024 (larga) e 1024x1536 (alta) --
sao os unicos formatos que a ferramenta da. O palco do carrossel, medido
no site a serio, vai de 0,54 (telemovel de 320px) a 4,80 (televisao 4K).
Nenhuma imagem cobre isso tudo com "cover" sem cortar, e o que se
cortava era o titulo e o logotipo.

Por isso mostra-se a imagem inteira e nunca se corta nada. As variantes
servem so para nao mandar 1,8 MB para um telemovel.

Correr:  python3 scripts/carrossel-imagens.py
"""
import os, glob
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIG = os.path.join(RAIZ, 'img', 'carrossel', 'originais')
SAIDA = os.path.join(RAIZ, 'img', 'carrossel')

LARGURAS = {
    'alta':  [480, 768, 1024],
    'larga': [960, 1366, 1536],
}
QUALIDADE = 80

def cor_de_fundo(im):
    w, h = im.size
    px = im.convert('RGB').load()
    pontos = [(2,2), (w-3,2), (2,h-3), (w-3,h-3), (2,h//2), (w-3,h//2)]
    r = sum(px[x,y][0] for x,y in pontos)//len(pontos)
    g = sum(px[x,y][1] for x,y in pontos)//len(pontos)
    b = sum(px[x,y][2] for x,y in pontos)//len(pontos)
    return '#%02x%02x%02x' % (r,g,b)

def main():
    cores = {}
    total = 0
    for f in sorted(glob.glob(os.path.join(ORIG, '*.png'))):
        nome = os.path.basename(f).replace('.png','')
        tipo = nome.split('-')[1]
        im = Image.open(f).convert('RGB')
        cores[nome] = cor_de_fundo(im)
        for larg in LARGURAS[tipo]:
            larg = min(larg, im.width)
            alt = round(im.height * larg / im.width)
            saida = os.path.join(SAIDA, '%s-%d.webp' % (nome, larg))
            im.resize((larg, alt), Image.LANCZOS).save(
                saida, 'WEBP', quality=QUALIDADE, method=6)
            kb = os.path.getsize(saida)//1024
            total += kb
            print('  %-22s %4dx%-4d  %3d KB' % (os.path.basename(saida), larg, alt, kb))
    print('\ntotal das variantes: %d KB' % total)
    print('\ncores de fundo por imagem:')
    for k in sorted(cores): print('  %-10s %s' % (k, cores[k]))

if __name__ == '__main__':
    main()
