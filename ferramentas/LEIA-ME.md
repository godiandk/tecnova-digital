# Ferramentas de verificação

Não fazem parte do site. Servem para o conferir antes de publicar.

## `auditoria.py`
Abre as 45 páginas em 9 aparelhos (do iPhone SE ao Desktop) e procura:
deslize lateral, letra pequena de mais, alvos de toque curtos, imagens
partidas ou sem texto alternativo, botões flutuantes sobrepostos, menu
partido em duas linhas, contraste abaixo do WCAG AA, campos que fazem o
iPhone dar zoom e cabeçalho tapado pela barra de demonstração.

## `contraste.py`
Só o contraste, com mais detalhe: compõe as camadas translúcidas e diz
qual é a cor, o fundo real e a razão obtida em cada caso.

## Como correr

    python3 -m http.server 8899 --bind 127.0.0.1 &
    python3 ferramentas/auditoria.py

Precisa de Playwright com o Chromium instalado.
