# O que a V3 muda, e por que o caminho anterior estava errado

## O que o pacote diz, em uma frase

> "Este pacote não é uma coleção de fundos para colocar botões invisíveis por cima. As
> imagens são especificações visuais de composição. Recrie cada área como componente
> real, com texto, estado, limite, valor e ação vindos da API."

E, mais adiante: *"a implementação deve usar CSS fluido e não posições absolutas
copiadas pixel a pixel"* e *"não usar a captura inteira como interface — isso impede
acessibilidade, localização e atualização de valores"*.

## Por que isso derruba o que eu tinha feito

O commit anterior usava a arte de mesa da V2 como FUNDO e punha carta e ficha em
posições absolutas medidas em cima dela, em pixel de 1600x900. É exatamente o que o
guia proíbe, e as razões dele são boas:

- **Leitor de tela não lê texto pintado.** "BLACKJACK PAGA 3 POR 2" estava dentro do
  JPEG. Quem usa leitor de tela não recebe nada.
- **Não dá pra traduzir.** O mesmo texto pintado impede qualquer outro idioma.
- **Valor pintado não muda.** A arte trazia "BALANCE 10,000.00" desenhado.
- **Casa de aposta pintada não é tocável.** Os sete círculos do arco eram desenho; não
  dá pra apostar em nenhum deles, nem dar nome acessível a cada um.
- **Posição absoluta não reflui.** Em tela de proporção diferente, a mesa só encolhe.

Também errei na orientação. A V2 era 16:9 deitada e eu travei a tela em paisagem. A V3
traz composição própria pra celular EM PÉ (1080x1920) — e forçar rotação tira do jogador
o controle do aparelho. O travamento saiu.

## O caminho certo

O guia dá a estrutura, e é ela que passa a valer:

```
CasinoGameShell
├── AppHeader      marca, nome da mesa, conexão, saldo, perfil
├── LiveStage      vídeo/3D e estado da rodada
├── BettingSurface campos, fichas e apostas ativas
├── ContextPanel   histórico, estatísticas, regras, chat
├── ActionTray     limpar, desfazer, repetir, confirmar, ações da mão
└── ResponsibleGaming
```

Com três faixas: celular até 767, tablet até 1439, computador de 1440 pra cima.

A mesa da V3 é desenhada de forma simples — feltro chapado com contorno dourado e as
casas como círculos rotulados. É de propósito: assim ela PODE ser reconstruída como
componente de verdade, com cada casa tocável, nomeada e com estado.

## O que continua valendo do que já foi feito

- **A ordem física da roda da roleta.** A auditoria da V3 traz a sequência europeia
  validada, e é a mesma que já está implementada e coberta por teste.
- **A Banca Francesa.** Três dados, Pequeno 5/6/7, Grande 14/15/16, Ases só com 1+1+1
  pagando 61, e os demais totais nulos exigindo novo lançamento — tudo já implementado.
- **A física de carta e dado.** Trajetória, quique e sombra continuam certos; o que muda
  é onde o objeto pousa, que passa a vir do layout e não de pixel medido.
- **A mesa com gente.** MesaComLugares e CorrenteDeDomino batem com a composição da V3.

## O que entrou agora

- `docs/referencia-v3/` — as 30 composições (computador, tablet, celular) como
  referência de hierarquia. Não são arte embarcada.
- `docs/guia-responsivo.md` e `docs/auditoria-jogo-a-jogo.md`.
- `app/src/theme/tokens-v3.json` — cores, raios, espaçamentos, pontos de quebra e
  tempos de animação oficiais.
- `docs/configuracao-dos-jogos.json` — quais apostas e ações cada mesa liga.

## Ordem de trabalho

1. O shell responsivo, com os tokens da V3.
2. As casas de aposta como componentes tocáveis e nomeadas, começando pelo blackjack.
3. Bandeja de fichas, com limpar, repetir e confirmar mostrando o total.
4. Painel de contexto: histórico, regras e chat.
5. Uma mesa por vez, conferindo contra a composição da V3 nas três larguras.
