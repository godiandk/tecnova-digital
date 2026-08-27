# Imagens

Pacote completo recebido (as 38 imagens do briefing) e já otimizado pra mobile: as
imagens sem transparência foram convertidas de PNG pra JPEG (qualidade 88) — foram
128MB de PNG bruto do ChatGPT para 55MB. Só continuam `.png` as que precisam de
transparência (ícones, logo, cartas, roda da roleta, molduras) e as três que o
`app.json` referencia pelo nome exato (`branding/app-icon.png`,
`branding/app-icon-adaptive.png`, `backgrounds/splash.png`).

```
branding/     logo-principal.png, logo-mono.png, app-icon.png, app-icon-adaptive.png
backgrounds/  lobby-fundo.jpg, login-fundo.jpg, loja-fundo.jpg, torneios-fundo.jpg, splash.png
perfil/       molduras-avatar.png, avatares-padrao.jpg, selo-vip.png
dealers/      dealer-blackjack.jpg, dealer-roleta.jpg, dealer-bacara.jpg, dealer-poker.jpg,
              banca-francesa-banqueiro.jpg, banca-francesa-tirador.jpg, banca-francesa-apontador.jpg,
              anfitriao-truco-domino.jpg, anfitria-slots.png
mesas/        mesa-blackjack.jpg, mesa-roleta.jpg, mesa-bacara.jpg, mesa-banca-francesa.jpg,
              mesa-truco.jpg, mesa-domino.jpg, mesa-poker.jpg, caca-niquel-gabinete-fortuna.jpg
cartas/       verso-carta.png, naipes-frente.png
fichas/       fichas-conjunto.jpg
dados/        dados-conjunto.jpg
roleta/       roda-roleta.png
slots/        simbolos-slot.png
icones/       icones-ui.png
trofeus/      trofeus-ranking.jpg, podio-3d.jpg
```

### Lobby (lote de agosto/2026)

```
cartazes/            cartaz-slots.png, cartaz-roleta.png, cartaz-blackjack.png, cartaz-bacara.png,
                     cartaz-banca-francesa.png, cartaz-bac-bo.png, cartaz-stock-market.png,
                     cartaz-truco.png, cartaz-domino.png, cartaz-poker.png
cartazes/variantes/  truco-paulista.png, truco-mineiro.png, modo-1x1.png, modo-2x2.png,
                     modo-sozinho.png, modo-mesa-online.png
interface/           hud-fichas.png, hud-barra-nivel.png, hud-barra-nivel-preenchimento.png,
                     selo-bloqueado.png, selo-novo.png, fundo-selecao-modo.png,
                     moldura-cartaz.png, moldura-cartaz-destaque.png
interface/icones/    mesa-online.png, contra-a-casa.png, atualizar.png, favoritar.png
```

Duas observações sobre este lote:

**As duas molduras não são usadas.** Os cartazes já vêm com moldura dourada e o emblema da marca desenhados na própria arte, então sobrepor `moldura-cartaz.png` deixaria a borda dobrada e comeria um pedaço do cartaz. Ficam guardadas caso um cartaz sem moldura apareça algum dia — `src/data/lobbyAssets.ts` explica isso no comentário do arquivo.

**A grade `icones-lobby.png` foi fatiada** nas quatro células de `interface/icones/` e removida, do mesmo jeito que as outras grades deste projeto. As frações usadas pra escrever o número de fichas por cima da cápsula e o nível por cima do brasão estão medidas na própria arte e anotadas em `ChipStack.tsx` e `LevelBar.tsx` — se a arte dessas duas peças mudar, remeça lá.

Já ligado no código:

- `app.json` (ícone e splash do app) — não precisou de nenhuma mudança, os arquivos só tinham que existir com esses nomes.
- `src/data/games.ts` → `tableImageKey` de cada jogo bate com o nome do arquivo em `mesas/` (sem extensão) — é o que `GameTableScreen` e as telas dedicadas (Slots, Roleta, Blackjack, Bacará) usam pra mostrar o fundo de mesa certo.
- `LobbyScreen` usa `backgrounds/lobby-fundo.jpg`, os cartazes de `cartazes/` (via `GameTile`), a cápsula de fichas e a barra de nível de `interface/`.
- `GameModeScreen` usa `interface/fundo-selecao-modo.png` de fundo e os cartazes de `cartazes/variantes/` como opção clicável.
- `ProfileScreen` usa a mesma barra de nível do lobby.

Ainda não ligado: telas de perfil/loja/torneios/login (não têm layout de fundo ainda), o verso/frente de carta (blackjack e bacará ainda desenham as cartas como texto, não como imagem), fichas e dados (ainda são formas simples), e os avatares de perfil.

Se quiser comprimir mais ainda antes de submeter pra loja (`icones-ui.png`, `naipes-frente.png` e `roda-roleta.png` são os arquivos mais pesados que sobraram), um passe de quantização de paleta (pngquant/tinypng) reduz mais — não fiz isso aqui pra não arriscar banding visível sem poder comparar visualmente.
