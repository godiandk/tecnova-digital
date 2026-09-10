#!/usr/bin/env python3
"""
PROVA QUE O COMPARADOR DE RETRATOS CONTA CERTO.

Um comparador frouxo deixa passar o defeito que ele existe pra pegar; um severo demais
acusa toda execução e é desligado na primeira semana. As duas falhas terminam no mesmo
lugar — ninguém confere layout — e nenhuma das duas aparece sozinha.

Por isso aqui as imagens são CONSTRUÍDAS, com a resposta certa conhecida de antemão.

    python3 verificacao/verifica-comparador.py
"""
import importlib.util
import os
import tempfile

import numpy as np
from PIL import Image

# O arquivo se chama `compara-retratos.py`, com hífen, como todo script do projeto — e
# hífen não é nome de módulo válido em Python. Carregar pelo caminho evita ter que
# renomear o script só pra este teste conseguir importá-lo.
_aqui = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('compara_retratos', os.path.join(_aqui, 'compara-retratos.py'))
_modulo = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_modulo)
comparar, gravar_diagnostico = _modulo.comparar, _modulo.gravar_diagnostico

passaram = 0
falharam = 0


def confere(o_que, teste):
    global passaram, falharam
    try:
        teste()
        passaram += 1
        print(f'  ok   {o_que}')
    except AssertionError as erro:
        falharam += 1
        print(f'  FALHOU  {o_que}')
        print(f'         {erro}')


PASTA = tempfile.mkdtemp()


def grava(nome, matriz):
    caminho = os.path.join(PASTA, nome)
    Image.fromarray(matriz.astype(np.uint8)).save(caminho)
    return caminho


def tela(cor=(18, 39, 24), largura=200, altura=300):
    return np.tile(np.array(cor, dtype=np.uint8), (altura, largura, 1))


print('\nO COMPARADOR DE RETRATOS\n')

print('O básico')


def identicas():
    a = grava('a.png', tela())
    b = grava('b.png', tela())
    por_cento, _, aviso = comparar(a, b)
    assert aviso is None, aviso
    assert por_cento == 0.0, f'duas imagens iguais acusaram {por_cento}%'


confere('duas imagens iguais dão 0%', identicas)


def tamanho_diferente():
    a = grava('a1.png', tela(largura=200))
    b = grava('b1.png', tela(largura=300))
    por_cento, _, aviso = comparar(a, b)
    assert aviso is not None, 'tamanho diferente passou como se fosse comparável'
    assert por_cento == 100.0
    # Redimensionar pra comparar esconderia justamente a mudança mais grave.
    assert 'tamanho' in aviso


confere('tamanho diferente é recusado, não redimensionado', tamanho_diferente)


def um_retangulo_mudou():
    base = tela()
    atual = tela()
    atual[100:130, 50:90] = [255, 217, 138]   # 30 x 40 = 1200 pixels de 60000 = 2%
    a, b = grava('a2.png', base), grava('b2.png', atual)
    por_cento, _, _ = comparar(a, b)
    assert abs(por_cento - 2.0) < 0.01, f'esperava 2%, deu {por_cento}%'


confere('um retângulo de 2% da tela acusa 2%', um_retangulo_mudou)

print('\nA sensibilidade — nem cego nem histérico')


def diferenca_invisivel():
    """
    Um degrau de 1 em cada canal é ruído de compressão, não mudança de layout. Se isso
    contasse, toda execução acusaria diferença e a conferência seria desligada.
    """
    base = tela()
    atual = tela() + np.array([1, 1, 1], dtype=np.uint8)
    a, b = grava('a3.png', base), grava('b3.png', atual)
    por_cento, _, _ = comparar(a, b)
    assert por_cento == 0.0, f'ruído de 1/255 acusou {por_cento}%'


confere('diferença invisível a olho não conta', diferenca_invisivel)


def diferenca_visivel():
    """Um cinza claramente diferente TEM que contar, mesmo sem ser gritante."""
    base = tela(cor=(120, 120, 120))
    atual = tela(cor=(132, 132, 132))
    a, b = grava('a4.png', base), grava('b4.png', atual)
    por_cento, _, _ = comparar(a, b)
    assert por_cento > 99.0, f'uma mudança visível de cinza acusou só {por_cento}%'


confere('diferença que o olho vê conta inteira', diferenca_visivel)


def elemento_que_andou():
    """Um elemento deslocado em 3 px acusa NOS DOIS lugares: de onde saiu e onde chegou."""
    base = tela()
    base[100:140, 50:90] = [255, 217, 138]
    atual = tela()
    atual[103:143, 50:90] = [255, 217, 138]
    a, b = grava('a5.png', base), grava('b5.png', atual)
    por_cento, _, _ = comparar(a, b)
    # 3 linhas saíram e 3 chegaram: 6 x 40 = 240 pixels de 60000 = 0,4%
    assert abs(por_cento - 0.4) < 0.02, f'esperava 0,4%, deu {por_cento}%'


confere('elemento deslocado 3 px é detectado', elemento_que_andou)

print('\nA máscara — sem ela isto não sobrevive a uma semana')


def mascara_esconde():
    base = tela()
    atual = tela()
    atual[10:30, 10:60] = [200, 30, 30]   # como se fosse o saldo mudando
    a, b = grava('a6.png', base), grava('b6.png', atual)

    sem_mascara, _, _ = comparar(a, b)
    assert sem_mascara > 0, 'sem máscara, a mudança tem que aparecer'

    com_mascara, _, _ = comparar(a, b, mascaras=[(10, 10, 50, 20)])
    assert com_mascara == 0.0, f'a máscara não segurou: {com_mascara}%'


confere('a máscara zera a região onde a mudança é esperada', mascara_esconde)


def mascara_nao_esconde_o_resto():
    """
    O teste que separa uma máscara útil de uma máscara perigosa: ela não pode virar
    desculpa pra não olhar o resto da tela.
    """
    base = tela()
    atual = tela()
    atual[10:30, 10:60] = [200, 30, 30]      # dentro da máscara
    atual[200:230, 100:140] = [200, 30, 30]  # FORA da máscara
    a, b = grava('a7.png', base), grava('b7.png', atual)
    por_cento, _, _ = comparar(a, b, mascaras=[(10, 10, 50, 20)])
    esperado = 100.0 * (30 * 40) / (200 * 300 - 50 * 20)
    assert abs(por_cento - esperado) < 0.02, f'esperava {esperado:.2f}%, deu {por_cento}%'


confere('a máscara não esconde mudança fora dela', mascara_nao_esconde_o_resto)


def por_cento_e_da_area_olhada():
    """Com metade da tela mascarada, a porcentagem é sobre a metade que sobrou."""
    base = tela()
    atual = tela()
    atual[150:300, :] = [255, 217, 138]   # a metade de baixo inteira mudou
    a, b = grava('a8.png', base), grava('b8.png', atual)
    por_cento, _, _ = comparar(a, b, mascaras=[(0, 0, 200, 150)])
    assert abs(por_cento - 100.0) < 0.01, f'esperava 100% da área olhada, deu {por_cento}%'


confere('a porcentagem é sobre a área olhada, não sobre a tela toda', por_cento_e_da_area_olhada)

print('\nA imagem de diagnóstico')


def diagnostico():
    base = tela()
    atual = tela()
    atual[100:140, 50:90] = [255, 217, 138]
    a, b = grava('a9.png', base), grava('b9.png', atual)
    _, mudou, _ = comparar(a, b)
    saida = os.path.join(PASTA, 'diff.png')
    gravar_diagnostico(b, mudou, saida, mascaras=[(0, 0, 30, 30)])
    assert os.path.exists(saida), 'não gravou a imagem'
    img = np.asarray(Image.open(saida).convert('RGB'))
    # O que mudou fica vermelho, e é isso que faz a imagem responder "onde".
    assert tuple(img[120, 70]) == (255, 40, 40), f'a marca do que mudou saiu {tuple(img[120, 70])}'
    # O que estava mascarado fica azulado, pra ninguém confundir "ignorado" com "igual".
    assert img[10, 10][2] > img[10, 10][0], 'a máscara não ficou marcada na imagem'


confere('a imagem de diagnóstico mostra onde mudou e o que foi ignorado', diagnostico)

print(f'\n{passaram} passaram, {falharam} falharam\n')
raise SystemExit(1 if falharam else 0)
