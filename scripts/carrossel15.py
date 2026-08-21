# -*- coding: utf-8 -*-
"""
Constroi as variantes WebP do carrossel a partir dos quinze cartazes de
cada lingua.

Uso:
    python3 scripts/carrossel15.py <lingua> <pasta-com-os-PNG>

    python3 scripts/carrossel15.py pt /caminho/TECNOVA_carrossel_PT
    python3 scripts/carrossel15.py en /caminho/TECNOVA_carrossel_EN
    python3 scripts/carrossel15.py es /caminho/TECNOVA_carrossel_ES

A pasta tem de trazer o manifest.json ou o SHA256SUMS.txt ao lado dos
ficheiros. Antes de converter seja o que for, o guiao confere cada master:
largura, altura e -- quando ha por onde -- a assinatura SHA-256. Se um
ficheiro nao bater certo, para ali e diz qual e; vale mais parar do que
publicar um cartaz trocado ou de outra lingua.

Sai daqui:
  img/carrossel/<lingua>/<n>-<classe>-<largura>.webp   o que o site serve
  img/carrossel/originais/<lingua>/<n>-<classe>.webp   copia de arquivo
"""

import hashlib
import json
import os
import sys

from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LINGUAS = ('pt', 'en', 'es')

FORMAS = {
    'telemovel':  (1440, 2400),
    'tablet':     (1800, 1440),
    'computador': (3840, 1920),
}

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
TECTO_QUALIDADE = 86

# O piso sobe nas larguras grandes. Um cartaz de 3840 so vai parar a
# ecras 2K e 4K, onde o texto aparece ao tamanho a que foi desenhado --
# se a qualidade cair a 74 para caber nos 120 KB, e ai que a letra
# comeca a esfarelar. Nesses vale mais o ficheiro pesar o dobro.

# A copia de arquivo. Os PNG originais pesam 5 MB cada e quarenta e cinco
# deles seriam 156 MB no repositorio, que toda a gente descarrega e o
# GitHub Pages volta a publicar a cada mudanca. A q95 sao 0,4 MB e nao ha
# forma de distinguir os dois a olho, nem depois de reduzir. Os PNG a
# serio ficam nos ZIP que o cliente guarda.
QUALIDADE_ARQUIVO = 95


def digestao(caminho):
    h = hashlib.sha256()
    with open(caminho, 'rb') as f:
        for bloco in iter(lambda: f.read(1 << 20), b''):
            h.update(bloco)
    return h.hexdigest()


def assinaturas(pasta):
    """Le o manifest.json ou o SHA256SUMS.txt, o que la estiver."""
    m = os.path.join(pasta, 'manifest.json')
    if os.path.exists(m):
        with open(m) as f:
            return dict((x['name'], x['sha256']) for x in json.load(f)['files'])
    s = os.path.join(pasta, 'SHA256SUMS.txt')
    if os.path.exists(s):
        fora = {}
        for linha in open(s):
            partes = linha.split()
            if len(partes) == 2:
                fora[partes[1].lstrip('*')] = partes[0]
        return fora
    return {}


def conferir(pasta):
    somas = assinaturas(pasta)
    if not somas:
        print('  (sem manifesto nem SHA256SUMS: so se conferem as dimensoes)')
    bons = []
    for n in range(1, 6):
        for classe in ('telemovel', 'tablet', 'computador'):
            nome = '%d-%s.png' % (n, classe)
            caminho = os.path.join(pasta, nome)
            if not os.path.exists(caminho):
                raise SystemExit('FALTA o ficheiro %s' % nome)

            with Image.open(caminho) as im:
                tamanho = im.size
            if tamanho != FORMAS[classe]:
                raise SystemExit('%s vem com %dx%d e devia ser %dx%d'
                                 % ((nome,) + tamanho + FORMAS[classe]))

            marca = 'ok'
            if nome in somas and digestao(caminho) != somas[nome]:
                raise SystemExit('%s nao bate certo com a assinatura' % nome)
            if nome not in somas:
                marca = 'dimensao ok, sem assinatura para conferir'

            print('  %-20s %5dx%-5d %8.2f MB  %s'
                  % (nome, tamanho[0], tamanho[1],
                     os.path.getsize(caminho) / 1048576.0, marca))
            bons.append((n, classe, caminho))
    return bons


def gravar(imagem, destino, qualidade):
    imagem.save(destino, 'WEBP', quality=qualidade, method=6)
    return os.path.getsize(destino)


def construir(lingua, n, classe, caminho):
    destino = os.path.join(RAIZ, 'img', 'carrossel', lingua)
    arquivo = os.path.join(RAIZ, 'img', 'carrossel', 'originais', lingua)
    for pasta in (destino, arquivo):
        if not os.path.isdir(pasta):
            os.makedirs(pasta)

    largura_mestre, altura_mestre = FORMAS[classe]
    with Image.open(caminho) as original:
        original = original.convert('RGB')
        gravar(original, os.path.join(arquivo, '%d-%s.webp' % (n, classe)),
               QUALIDADE_ARQUIVO)

        for largura in LARGURAS[classe]:
            if largura > largura_mestre:
                continue
            altura = int(round(largura * altura_mestre / float(largura_mestre)))
            pequena = original.resize((largura, altura), Image.LANCZOS)
            saida = os.path.join(destino, '%d-%s-%d.webp' % (n, classe, largura))

            piso = 82 if largura >= 2560 else 74
            qualidade = TECTO_QUALIDADE
            peso = gravar(pequena, saida, qualidade)
            while peso > ALVO_BYTES and qualidade > piso:
                qualidade -= 2
                peso = gravar(pequena, saida, qualidade)

            aviso = '' if peso <= ALVO_BYTES else '  (acima do alvo, mas nitido)'
            print('    %-28s %4d x %-4d  q%-3d %7.1f KB%s'
                  % (os.path.basename(saida), largura, altura,
                     qualidade, peso / 1024.0, aviso))


def main():
    if len(sys.argv) < 3 or sys.argv[1] not in LINGUAS:
        raise SystemExit('Uso: carrossel15.py <%s> <pasta-com-os-PNG>'
                         % '|'.join(LINGUAS))
    lingua, pasta = sys.argv[1], sys.argv[2]

    print('A conferir os quinze cartazes em %s:' % lingua.upper())
    bons = conferir(pasta)

    print('\nA fazer as variantes WebP:')
    for n, classe, caminho in bons:
        print('  %d-%s.png' % (n, classe))
        construir(lingua, n, classe, caminho)

    print('\nFeito. %d cartazes em %s.' % (len(bons), lingua.upper()))


if __name__ == '__main__':
    main()
