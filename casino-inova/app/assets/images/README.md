# Estrutura de imagens

Estas pastas espelham exatamente a saída pedida em `casino-inova/docs/briefing-imagens-casino-inova.md` — descompacte o `.zip` gerado pelo ChatGPT direto aqui dentro e cada arquivo já cai na pasta certa.

```
images/
  branding/     logo-principal.png, logo-mono.png, app-icon.png, app-icon-adaptive.png
  backgrounds/  splash.png, login-fundo.png, lobby-fundo.png, torneios-fundo.png, loja-fundo.png
  perfil/       molduras-avatar.png, avatares-padrao.png, selo-vip.png
  dealers/      dealer-blackjack.png, dealer-roleta.png, dealer-bacara.png, dealer-poker.png,
                banca-francesa-banqueiro.png, banca-francesa-tirador.png, banca-francesa-apontador.png,
                anfitriao-truco-domino.png, anfitria-slots.png
  mesas/        mesa-blackjack.png, mesa-roleta.png, mesa-bacara.png, mesa-banca-francesa.png,
                mesa-truco.png, mesa-domino.png, mesa-poker.png, caca-niquel-gabinete-fortuna.png
  cartas/       verso-carta.png, naipes-frente.png
  fichas/       fichas-conjunto.png
  dados/        dados-conjunto.png
  roleta/       roda-roleta.png
  slots/        simbolos-slot.png
  icones/       icones-ui.png
  trofeus/      trofeus-ranking.png, podio-3d.png
```

`app.json` já referencia `branding/app-icon.png`, `branding/app-icon-adaptive.png` e `backgrounds/splash.png` — assim que esses três existirem aqui, `npx expo start` já mostra o ícone e a splash reais.

As telas do app (`src/screens/`) ainda usam blocos de cor sólida no lugar dos assets — trocar por `<Image source={require(...)} />` é o próximo passo depois que o pacote de imagens chegar.
