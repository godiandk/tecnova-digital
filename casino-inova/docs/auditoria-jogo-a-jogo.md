# Auditoria pesada das mesas

## 1. Caça-Níqueis

Obrigatório: rolos/grade completos, saldo, aposta total, ganho, girar, autoplay, turbo, tabela de pagamentos, áudio e estado de bônus. Linhas, cluster, Megaways, jackpot e compra de bônus são configurações de produtos distintos.

## 2. Roleta europeia

Obrigatório: roda e pano com 0–36; vermelho e preto corretos; apostas internas (pleno, cavalo, rua, trio, canto e linha); colunas; dúzias; 1–18, Par, Vermelho, Preto, Ímpar e 19–36. A pista de Voisins/Tiers/Orphelins/Vizinhos complementa o pano e nunca substitui as apostas externas. Manter fichas, total, desfazer, limpar, repetir, favoritos, resultados e estatísticas.

Sequência europeia validada: `0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26`.

## 3. Blackjack

Desktop mostra sete posições e exemplos de cartas. Campos laterais: Perfect Pairs e 21+3. O Perfect Pairs avalia as duas cartas iniciais; 21+3 usa as duas cartas do jogador e a carta aberta da banca. Hot 3, Bust It, Lucky Ladies e Bet Behind ficam como módulos por variante. Ações: pedir, parar, dobrar, dividir, seguro e rendição somente quando válidas. Exibir total de cada mão após split.

## 4. Bacará

Obrigatório: Jogador, Banca, Empate, Par do Jogador e Par da Banca; cartas e totais; terceira carta automática; shoe; resultados e roadmaps. Incluídos como módulos: Perfect Pair, Either Pair, Player/Banker Bonus e variantes Squeeze/Lightning/Peek/Golden Wealth. Roadmaps previstos: Bead Road, Big Road, Big Eye Boy, Small Road e Cockroach Pig. Não usar todos os módulos na mesma mesa sem contrato de regras e tabela de pagamento.

## 5. Bac Bo

Quatro agitadores individuais: dois dados azuis do Jogador e dois vermelhos da Banca. Empates mostrados: 2/12 = 88:1; 3/11 = 25:1; 4/10 = 10:1; 5/9 = 6:1; 6/7/8 = 4:1. O produto final deve carregar pagamentos do servidor porque podem variar por operador/jurisdição.

## 6. Stock Market

Tratar como game show, não como investimento real. Exibir gráfico -100% a +100%, UP, DOWN, portfólio, pontos de entrada, variação, cash out e comissão de 1%. Há variantes com/sem apresentador, com/sem reaposta e com cash out automático; cada uma deve ter configuração separada.

## 7. Banca Francesa

Três dados. Pequeno vence com soma 5, 6 ou 7; Grande com 14, 15 ou 16; Ases somente com 1+1+1 e paga 61 vezes a parada segundo o Casino Lisboa. Outros totais são nulos e exigem novo lançamento. A mesa precisa manter as três áreas visíveis e sem espaço vago artificial.

## 8. Truco

Quatro assentos em duplas e placar fora dos lugares. Cada jogador recebe três cartas. Paulista: vira define a manilha; mão 1→3→6→9→12. Mineiro: manilhas fixas 4♣, 7♥, A♠ e 7♦; mão 2→4→6→10→12. Não misturar pontuação. Exibir vazas, mão, turno, pedir, aceitar, aumentar e correr.

## 9. Dominó

Modo duplas: conjunto duplo-seis com 28 peças únicas, quatro jogadores e sete peças para cada um, sem monte. Peças só conectam extremidades iguais; duplas ficam transversais. Modo 1×1 com compra é separado. Exibir turno, extremidades válidas, passar/comprar conforme modo, rodada bloqueada e contagem de pontos.

## 10. Poker de casino

Não existe uma única mesa genérica. O seletor deve carregar uma configuração distinta:

- Caribbean Stud: cinco cartas, uma carta da banca aberta, Ante, Bet 2× e Progressive opcional; banca qualifica com Ás-Rei ou melhor.
- Casino Hold’em: duas cartas por lado, cinco comunitárias, Ante, Call 2× e AA Bonus.
- Three Card Poker: três cartas por lado, Ante/Play, Pair Plus e 6 Card Bonus; qualificação da banca configurável.
- Ultimate Texas Hold’em: Ante, Blind, Trips e Play; aumento 3×/4× antes do flop, 2× após o flop ou 1× após o river.
- Two Hand Casino Hold’em: duas mãos do jogador, cada uma com apostas e resultado próprios.

## Bloqueadores de publicação

1. Campo obrigatório ausente ou coberto.
2. Número, cor, carta, dado ou peça incoerente com o resultado.
3. Aposta de variante exibida sem configuração/pagamento correspondente.
4. Controle inacessível no celular ou painel cortado na rotação.
5. Total de aposta diferente do valor aceito pelo servidor.
6. Resultado decidido no cliente.

