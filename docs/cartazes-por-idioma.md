# Os cartazes do carrossel em três idiomas

## O problema que isto resolve

O texto dos destaques está **desenhado dentro da imagem**. Nenhum
dicionário o traduz: quando o visitante trocava para inglês, os botões
mudavam de língua e o cartaz continuava em português.

A solução são três jogos de quinze cartazes — português, inglês e
espanhol — e uma ligação entre o idioma escolhido e o jogo que se mostra.

---

## COMO ESTÃO ARRUMADOS

```
img/carrossel/
  pt/  1-telemovel-480.webp … 5-computador-3840.webp    70 ficheiros
  en/  1-telemovel-480.webp … 5-computador-3840.webp    70 ficheiros
  es/  1-telemovel-480.webp … 5-computador-3840.webp    70 ficheiros
  originais/
    pt/  1-telemovel.webp … 5-computador.webp           cópia de arquivo
    en/  …
    es/  …
```

**O nome do ficheiro é igual nas três línguas.** Só muda a pasta. É isso
que faz a ligação ser uma coisa só: trocar `img/carrossel/pt/` por
`img/carrossel/en/` no caminho, e mais nada.

O padrão do nome é `<destaque>-<formato>-<largura>.webp`:

| Pedaço | Valores |
|---|---|
| destaque | 1 a 5 |
| formato | `telemovel`, `tablet`, `computador` |
| largura | telemóvel 480/720/960/1200/1440 · tablet 768/1024/1400/1800 · computador 1280/1600/1920/2560/3840 |

---

## COMO A LIGAÇÃO FUNCIONA

São três peças, e a ordem entre elas é o que interessa.

**1. O idioma decide-se no cabeçalho, antes de tudo.**
`index.html` tem um script no `<head>` que põe `window.TECNOVA_LING`.
Escolhe pela mesma ordem de sempre: `?lang=` do endereço → o que ficou
guardado no navegador → a língua do próprio navegador → português.

Tem de ser ali. Se só se soubesse quando o `i18n.js` corre, o navegador
já tinha ido buscar o cartaz português e via-se a troca a acontecer no
ecrã.

**2. O caminho troca-se logo a seguir ao carrossel.**
Um segundo script, poucos bytes depois do `</section>`, substitui
`img/carrossel/pt/` pela pasta do idioma em todos os `srcset`, `src`,
`data-srcset` e `data-src` dos cinco destaques.

O HTML traz os caminhos em português de propósito: quem tenha o
JavaScript desligado vê o cartaz português em vez de um palco vazio.

**3. Trocar de idioma com a página aberta.**
O `i18n.js` já dispara `document.dispatchEvent(new CustomEvent(
'tecnova:idioma', { detail: 'en' }))` sempre que muda. O `site.js` ouve
esse evento e refaz a mesma substituição — incluindo nos destaques que
ainda estão à espera em `data-srcset`.

---

## PARA ACRESCENTAR OU REFAZER UM IDIOMA

1. Pedir os quinze cartazes nas medidas do costume: 1440×2400 (telemóvel),
   1800×1440 (tablet), 3840×1920 (computador). Ver
   `tamanhos-carrossel.md`.
2. Correr `python3 scripts/carrossel15.py <idioma> <pasta-com-os-PNG>`.
   O guião confere as dimensões e a assinatura SHA-256 de cada ficheiro
   antes de converter, faz as variantes WebP e guarda a cópia de arquivo.
3. Subir a versão da cache (`?v=` nas páginas e `CACHE_NAME` no `sw.js`).

Para um idioma novo, além disso: acrescentá-lo em `IDIOMAS` no `i18n.js`,
criar `idiomas/<código>.js`, e pôr o código nas três listas de validação
— no script do `<head>` do `index.html`, no script a seguir ao carrossel,
e na expressão `CAMINHO_LING` do `site.js`.

---

## OS PNG ORIGINAIS

Não estão no repositório. Quarenta e cinco PNG de 5 MB são 156 MB que
toda a gente descarrega e o GitHub Pages volta a publicar a cada mudança.

O que está guardado é uma cópia em WebP de qualidade 95, à resolução
completa, em `img/carrossel/originais/<idioma>/` — 0,4 MB cada, sem
diferença visível, e serve para voltar a gerar as variantes.

**Os PNG a sério ficam nos ZIP que o cliente guarda.** Vale a pena não
os perder.
