# Guia de implementação para computador, tablet e celular

## Estrutura de componentes

```text
CasinoGameShell
├── AppHeader: marca, nome da mesa, conexão, saldo e perfil
├── LiveStage: vídeo/3D e estado da rodada
├── BettingSurface: campos, fichas e apostas ativas
├── ContextPanel: histórico, estatísticas, regras e chat
├── ActionTray: limpar, desfazer, repetir, confirmar e ações da mão
└── ResponsibleGaming: sessão, limites e saída
```

## Pontos de quebra

| Faixa | Composição | Regra prática |
|---|---|---|
| 1440 px ou mais | Desktop em três colunas | Vídeo à esquerda, mesa ao centro, contexto à direita; bandeja fixa embaixo. |
| 768–1439 px | Tablet vertical | Vídeo acima, mesa completa no centro, recursos em painel recolhível e bandeja fixa. |
| 360–767 px | Celular | Vídeo compacto, mesa com zoom/rolagem controlados, recursos em bottom sheet e ações no polegar. |

As imagens têm 1920×1080, 1536×2048 e 1080×1920. Elas indicam proporção e hierarquia; a implementação deve usar CSS fluido e não posições absolutas copiadas pixel a pixel.

## Regras de interação

- Área tocável mínima: 48×48 px; manter 8 px entre alvos vizinhos.
- Aposta selecionada precisa de cor, contorno e valor. Nunca depender somente da cor.
- Botão Confirmar/Apostar deve mostrar o total e ficar desativado sem aposta válida.
- Desfazer remove a última ação; Limpar remove todas; Repetir restaura a rodada anterior respeitando limites atuais.
- Estados mínimos: carregando, apostas abertas, apostas encerradas, resultado, pagamento, desconectado e reconectando.
- Vídeo deve aceitar modo econômico; a mesa nunca pode desaparecer se o vídeo falhar.
- Em rotação de tela, preservar apostas e estado local sem reenviar transações.

## Acessibilidade

- Contraste WCAG AA para texto e controles.
- Nome acessível completo: “Apostar 5 euros no vermelho”, não “botão vermelho”.
- Ordem de foco acompanha a ordem visual.
- Resultado anunciado em região `aria-live`, sem repetir animações decorativas.
- Respeitar `prefers-reduced-motion`.

## Performance

- WebP/AVIF responsivo para fundos; ícones e mesas em SVG/Canvas/HTML conforme a necessidade.
- Não usar a captura inteira como interface. Isso impede acessibilidade, localização e atualização de valores.
- Carregar o vídeo após o shell; manter poster otimizado durante a conexão.
- Meta: interação inicial < 2,5 s em 4G; animações a 60 fps; sem bloquear a thread principal durante resultado.

## Arquitetura de estado recomendada

O servidor deve ser autoritativo para janela de aposta, aceitação, resultado e pagamento. O cliente pode animar a previsão, mas nunca decidir o resultado. Use IDs idempotentes nas apostas, relógio sincronizado e reconciliação após reconexão.

Eventos sugeridos: `ROUND_OPEN`, `BET_ACCEPTED`, `BET_REJECTED`, `NO_MORE_BETS`, `DEAL_OR_SPIN`, `RESULT`, `PAYOUT`, `ROUND_CLOSED`.

