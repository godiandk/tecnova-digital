# POC de renderização — como rodar

A mesma cena de caça-níqueis, desenhada por dois motores diferentes, para a decisão de
renderer sair de número medido e não de preferência.

A cena está em `comum/cena.js` e é **uma só**: tempos, resultado sorteado, quantidade de
partículas e coreografia são idênticos nos dois braços. O que muda é apenas quem põe pixel
na tela. E, como manda a regra da casa, **a cena não sorteia nada** — o resultado chega
pronto, do jeito que o `AdaptadorDeJogo` entregaria.

## Rodar a medição automática

```
PLAYWRIGHT=/opt/node22/lib/node_modules/playwright/index.js \
CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
node medir.mjs
```

Sai `resultados/medidas.json` e os retratos ao lado. Duas passadas: uma mede desempenho
com o tempo correndo de verdade, outra tira os retratos com o tempo da cena **congelado**,
para as imagens serem do mesmo instante nos dois braços.

## Rodar no aparelho — que é o que realmente decide

O contêiner onde isto foi medido **não tem GPU**. O número que vale tem que vir de um
telefone. Sirva a pasta e abra no aparelho:

```
npx serve -l 8080 .        # ou qualquer servidor de arquivos
# no iPhone/Android, na mesma rede: http://<ip-da-maquina>:8080/
```

A página inicial diz, na hora, se aquele aparelho está desenhando por hardware ou por
software, e cada braço mostra os próprios números no rodapé quando termina. Não precisa de
ferramenta nenhuma no telefone.

**Rode cada braço três vezes**, e anote quadro típico, p95 e pior quadro. Depois repita
alternando de aba, bloqueando e desbloqueando a tela, e com o aparelho já morno. É na
terceira execução com o telefone quente que a diferença aparece.

## Chaves da barra de endereço

| Chave | O que faz |
|---|---|
| `?aa=0` | desliga o MSAA do Pixi |
| `?texto=bitmap` | contador em `BitmapText` em vez de `Text` |
| `?t=5600` | **congela** a cena naquele instante, para retrato |
| `?sem=mascara,simbolos,linhas,particulas,texto,palco` | desliga pedaços, para achar o custo de cada um |

`?sem=` vale nos dois braços e é como a tabela de custo do relatório foi levantada. Nunca
use `?t=` para medir desempenho: ali o tempo tem que correr.

## Arquivos

| | |
|---|---|
| `comum/cena.js` | a coreografia, uma vez só, para os dois |
| `comum/medidor.js` | distribuição de tempo de quadro (p50/p95/p99), viradas perdidas |
| `pixi/index.html` | braço PixiJS |
| `skia/index.html` | braço Skia (CanvasKit) |
| `medir.mjs` | medição automática + retratos |
| `index.html` | menu para abrir no celular |
| `comparacao-*.png` | as folhas lado a lado, no mesmo instante da cena |
| `atlas/` | os 9 símbolos num atlas só (`tools/gera-atlas-do-slot.py`) |
| `fonte/` | Liberation Sans Bold (SIL OFL 1.1) — o CanvasKit não traz fonte nenhuma |

O relatório com os números e a decisão está em `docs/RENDERING_STRATEGY.md`.
