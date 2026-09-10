#!/usr/bin/env python3
"""
O ATLAS DOS SÍMBOLOS DO CAÇA-NÍQUEIS.

Nove PNG de 512x512 viram UMA imagem com nove quadros, mais um JSON dizendo onde cada
um está. Não é economia de disco — é economia de TROCA DE TEXTURA na GPU.

Um rolo girando com símbolos em nove texturas diferentes obriga a placa a trocar de
textura a cada símbolo desenhado, e cada troca quebra o lote: 30 símbolos viram 30
chamadas de desenho. Com um atlas, os 30 saem numa chamada só, porque todos leem pedaços
da MESMA textura. É a diferença entre um slot que roda a 60 quadros num celular e um que
engasga — e é o mesmo motivo por que todo motor de jogo 2D tem atlas.

    python3 tools/gera-atlas-do-slot.py

Escreve poc-renderizacao/atlas/simbolos.png e simbolos.json.
"""
import json
import os

from PIL import Image

ORIGEM = 'app/assets/images/slots/simbolos'
SAIDA = 'poc-renderizacao/atlas'
# 192 é o suficiente: numa tela de 400 de largura, um símbolo ocupa ~70 pontos, e num
# monitor de 1920 ocupa ~150. O dobro da maior ocupação cobre tela de alta densidade.
LADO = 192
COLUNAS = 3

# A ordem é a da tabela de prêmios: do mais comum ao mais raro. Assim o índice do quadro
# no atlas é o mesmo índice do símbolo na configuração, e não existe tabela de-para.
SIMBOLOS = ['ferradura', 'sino', 'barras', 'estrela', 'moeda', 'coroa', 'diamante', 'sete', 'jackpot']

if __name__ == '__main__':
    os.makedirs(SAIDA, exist_ok=True)
    linhas = (len(SIMBOLOS) + COLUNAS - 1) // COLUNAS
    atlas = Image.new('RGBA', (COLUNAS * LADO, linhas * LADO), (0, 0, 0, 0))
    quadros = {}

    for i, nome in enumerate(SIMBOLOS):
        caminho = os.path.join(ORIGEM, f'simbolo-{nome}.png')
        im = Image.open(caminho).convert('RGBA').resize((LADO, LADO), Image.LANCZOS)
        x = (i % COLUNAS) * LADO
        y = (i // COLUNAS) * LADO
        atlas.paste(im, (x, y))
        quadros[nome] = {'x': x, 'y': y, 'w': LADO, 'h': LADO, 'indice': i}
        print(f'  {nome:10s} -> ({x:4d}, {y:4d})')

    atlas.save(os.path.join(SAIDA, 'simbolos.png'), optimize=True)
    with open(os.path.join(SAIDA, 'simbolos.json'), 'w') as f:
        json.dump({'imagem': 'simbolos.png', 'lado': LADO, 'quadros': quadros}, f, indent=2)

    tamanho = os.path.getsize(os.path.join(SAIDA, 'simbolos.png')) / 1024
    solto = sum(
        os.path.getsize(os.path.join(ORIGEM, f'simbolo-{n}.png')) for n in SIMBOLOS
    ) / 1024
    print(f'\natlas: {atlas.size[0]}x{atlas.size[1]}, {tamanho:.0f} KB')
    print(f'os nove soltos, no tamanho original: {solto:.0f} KB em 9 requisições')
