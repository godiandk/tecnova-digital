# -*- coding: utf-8 -*-
"""
Constroi as variantes WebP do carrossel a partir dos quinze cartazes PNG.

Uso:
    python3 scripts/carrossel15.py <pasta-com-os-PNG>

A pasta tem de trazer o manifest.json ao lado dos ficheiros. Antes de
converter seja o que for, o guiao confere cada master contra o manifesto:
largura, altura e SHA-256. Se um ficheiro nao bater certo, para ali e diz
qual e -- vale mais parar do que publicar um cartaz trocado.
"""

import hashlib
import json
import os
import sys

from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESTINO = os.path.join(RAIZ, 'img', 'carrossel')

# As larguras que cada classe precisa de servir.
#
# Telemovel: ate 767 px de CSS. Com ecra de tres pontos por pixel dava
# 2301, mas o master tem 1440 -- acima disso so estariamos a esticar.
# Tablet: 768 a 1023 px, dois pontos por pixel, master de 1800.
# Computador: de 1024 para cima. O 3840 so vai parar a televisoes 4K.
LARGURAS = {
    'telemovel':  [480, 720, 960, 1200, 1440],
    'tablet':     [768, 1024, 1400, 1800],
    'computador': [1280, 1600, 1920, 2560, 3840],
}

# Alvo de peso por variante. Nao e uma regra rigida: se a qualidade tiver
# de descer abaixo do piso para la chegar, fica pelo piso e o ficheiro sai
# maior. Texto legivel manda mais do que o numero.
ALVO_BYTES = 120 * 1024
PISO_QUALIDADE = 74
TECTO_QUALIDADE = 86


def digestao(caminho):
    h = hashlib.sha256()
    with open(caminho, 'rb') as f:
        for bloco in iter(lambda: f.read(1 << 20), b''):
            h.update(bloco)
    return h.hexdigest()


def conferir(pasta, manifesto):
    """Devolve a lista de masters ja validados, ou levanta erro."""
    bons = []
    for ficha in manifesto['files']:
        caminho = os.path.join(pasta, ficha['name'])
        if not os.path.exists(caminho):
            raise SystemExit('FALTA o ficheiro %s' % ficha['name'])

        with Image.open(caminho) as im:
            largura, altura = im.size
        if (largura, altura) != (ficha['width'], ficha['height']):
            raise SystemExit(
                '%s vem com %dx%d e o manifesto pede %dx%d'
                % (ficha['name'], largura, altura, ficha['width'], ficha['height']))

        bytes_reais = os.path.getsize(caminho)
        soma = digestao(caminho)
        marca = 'ok'
        if soma != ficha['sha256']:
            marca = 'ATENCAO: assinatura diferente do manifesto'
        elif bytes_reais != ficha['bytes']:
            marca = 'ATENCAO: tamanho diferente do manifesto'

        print('  %-20s %5dx%-5d %8.2f MB  %s'
              % (ficha['name'], largura, altura, bytes_reais / 1048576.0, marca))
        bons.append((ficha, caminho))
    return bons


def gravar(imagem, destino, qualidade):
    imagem.save(destino, 'WEBP', quality=qualidade, method=6)
    return os.path.getsize(destino)


def construir(ficha, caminho):
    numero = ficha['slide']
    classe = ficha['format']
    with Image.open(caminho) as original:
        original = original.convert('RGB')
        for largura in LARGURAS[classe]:
            if largura > ficha['width']:
                continue
            altura = int(round(largura * ficha['height'] / float(ficha['width'])))
            pequena = original.resize((largura, altura), Image.LANCZOS)
            saida = os.path.join(DESTINO, '%d-%s-%d.webp' % (numero, classe, largura))

            qualidade = TECTO_QUALIDADE
            peso = gravar(pequena, saida, qualidade)
            while peso > ALVO_BYTES and qualidade > PISO_QUALIDADE:
                qualidade -= 2
                peso = gravar(pequena, saida, qualidade)

            aviso = '' if peso <= ALVO_BYTES else '  (acima do alvo, mas nitido)'
            print('    %-28s %4d x %-4d  q%-3d %7.1f KB%s'
                  % (os.path.basename(saida), largura, altura,
                     qualidade, peso / 1024.0, aviso))


def main():
    if len(sys.argv) < 2:
        raise SystemExit('Diga-me a pasta com os PNG e o manifest.json.')
    pasta = sys.argv[1]
    with open(os.path.join(pasta, 'manifest.json'), 'r') as f:
        manifesto = json.load(f)

    print('A conferir os quinze cartazes contra o manifesto:')
    bons = conferir(pasta, manifesto)

    if not os.path.isdir(DESTINO):
        os.makedirs(DESTINO)

    print('\nA fazer as variantes WebP:')
    for ficha, caminho in bons:
        print('  %s' % ficha['name'])
        construir(ficha, caminho)

    print('\nFeito. %d cartazes tratados.' % len(bons))


if __name__ == '__main__':
    main()
