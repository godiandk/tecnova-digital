# TECNOVA Digital — carrossel final em 15 imagens

Este pacote substitui os pacotes anteriores. Contém cinco destaques, cada um composto especificamente para telemóvel, tablet e computador.

## Ficheiros e dimensões obrigatórias

| Destaque | Telemóvel | Tablet | Computador |
|---|---|---|---|
| 1 — Oferta | `1-telemovel.png` — 1440×2400 | `1-tablet.png` — 1800×1440 | `1-computador.png` — 3840×1920 |
| 2 — Necessidade | `2-telemovel.png` — 1440×2400 | `2-tablet.png` — 1800×1440 | `2-computador.png` — 3840×1920 |
| 3 — Preços | `3-telemovel.png` — 1440×2400 | `3-tablet.png` — 1800×1440 | `3-computador.png` — 3840×1920 |
| 4 — Modelos | `4-telemovel.png` — 1440×2400 | `4-tablet.png` — 1800×1440 | `4-computador.png` — 3840×1920 |
| 5 — Aplicação | `5-telemovel.png` — 1440×2400 | `5-tablet.png` — 1800×1440 | `5-computador.png` — 3840×1920 |

Os PNGs são masters de produção. Não os substituir, esticar ou cortar. Gerar derivados WebP/AVIF a partir deles e manter estes originais intactos.

## Regras de apresentação

- Telemóvel, até 767 px: palco com `aspect-ratio: 3 / 5` e ficheiro `N-telemovel`.
- Tablet, de 768 a 1023 px: palco com `aspect-ratio: 5 / 4` e ficheiro `N-tablet`.
- Computador, a partir de 1024 px: palco com `aspect-ratio: 2 / 1` e ficheiro `N-computador`.
- Usar `object-fit: cover` e `object-position: center`.
- O desvio do telemóvel de 320 px é absorvido pela margem segura de 6% já prevista.
- A faixa inferior escura de cada imagem fica reservada aos botões reais. Não colocar o bloco de ações por cima de títulos, números, rosto, telemóveis ou logótipo.

CSS-base:

```css
.hero-slide {
  position: relative;
  overflow: hidden;
  aspect-ratio: 3 / 5;
}

.hero-slide picture,
.hero-slide img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.hero-slide img {
  object-fit: cover;
  object-position: center;
}

@media (min-width: 768px) {
  .hero-slide { aspect-ratio: 5 / 4; }
}

@media (min-width: 1024px) {
  .hero-slide { aspect-ratio: 2 / 1; }
}

.hero-slide__actions {
  position: absolute;
  left: 6%;
  right: 6%;
  bottom: 3%;
  z-index: 2;
}
```

## Carregamento responsivo

O navegador deve descarregar apenas uma das três variantes de cada destaque:

```html
<picture class="hero-slide__media">
  <source media="(max-width: 767px)" srcset="/assets/carrossel/1-telemovel.webp">
  <source media="(max-width: 1023px)" srcset="/assets/carrossel/1-tablet.webp">
  <img
    src="/assets/carrossel/1-computador.webp"
    width="3840"
    height="1920"
    alt=""
    aria-hidden="true"
    decoding="async"
    fetchpriority="high"
  >
</picture>
```

- O primeiro destaque pode carregar imediatamente com `fetchpriority="high"`.
- Nos destaques 2–5, promover `data-srcset`/`data-src` para `srcset`/`src` apenas antes da primeira ativação. Depois manter em cache.
- Criar derivados adequados à densidade e largura reais. O objetivo de 120 KB é válido desde que o texto permaneça nítido; a legibilidade tem prioridade sobre um limite rígido.
- Respeitar `prefers-reduced-motion` e permitir navegação manual por teclado.

## Texto semântico e acessibilidade

O texto visível está dentro dos cartazes. Manter no DOM uma versão semanticamente equivalente usando uma classe `sr-only` acessível. Como esse HTML já anuncia a mensagem, as imagens devem ter `alt=""` e `aria-hidden="true"` para evitar leitura duplicada.

Não usar `display:none`, `visibility:hidden` ou texto transparente para o conteúdo semântico.

## Observações por destaque

- Wesley aparece apenas nos destaques 1 e 2.
- Nos três formatos do destaque 2, o telemóvel mostra a captura real da aplicação TECNOVA Digital fornecida pelo cliente.
- O destaque 4 mostra três modelos de negócio sem texto interno legível.
- O destaque 5 mostra apenas o ícone TECNOVA e o halo de instalação no ecrã.
- Nenhuma imagem tem botões desenhados.

## QA concluído

- 15 PNGs íntegros em sRGB.
- 5 telemóveis exatamente 1440×2400.
- 5 tablets exatamente 1800×1440.
- 5 computadores exatamente 3840×1920.
- Sem corte ou distorção na exportação final.
- Copy, preços, percentagem, acentos e logótipos revistos contra os briefings.
- Margens de segurança e faixa inferior verificadas visualmente.

`briefing-conteudo.md` e `briefing-tamanhos.md` preservam os pedidos recebidos. `manifest.json` contém dimensões, bytes e SHA-256 de cada master.
