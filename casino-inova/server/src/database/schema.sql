-- Esquema do Casino Inova.
--
-- Regra que atravessa tudo: a carteira é um ledger append-only. Nenhuma linha de
-- ledger_entries é editada ou apagada — o saldo é sempre a SOMA das entradas, nunca
-- um campo guardado. É o que permite auditar de onde veio e pra onde foi cada ficha.

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  name        TEXT        NOT NULL,
  level       INTEGER     NOT NULL DEFAULT 1,
  xp          INTEGER     NOT NULL DEFAULT 0,
  vip_tier    TEXT        NOT NULL DEFAULT 'bronze',
  role        TEXT        NOT NULL DEFAULT 'jogador',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Credenciais ficam FORA da tabela users de propósito: o hash da senha não tem por que
-- ser carregado junto toda vez que alguém lê um nome de jogador na mesa. Uma conta pode
-- ter mais de uma credencial (senha hoje, Google/Apple depois) — por isso a chave é
-- (provedor, identificador), e não o user_id.
CREATE TABLE IF NOT EXISTS credentials (
  provider      TEXT        NOT NULL,   -- 'senha' | 'google' | 'apple' | 'facebook'
  subject       TEXT        NOT NULL,   -- e-mail na senha; uid do provedor nos outros
  user_id       TEXT        NOT NULL REFERENCES users(id),
  -- Só o provedor 'senha' usa: scrypt em "salt:hash". Nulo nos provedores externos,
  -- onde quem confere a identidade é o provedor.
  password_hash TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, subject)
);

CREATE INDEX IF NOT EXISTS credentials_user_idx ON credentials (user_id);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id          BIGSERIAL   PRIMARY KEY,
  user_id     TEXT        NOT NULL REFERENCES users(id),
  type        TEXT        NOT NULL,
  -- Positivo credita, negativo debita. Nunca zero.
  amount      BIGINT      NOT NULL CHECK (amount <> 0),
  -- De onde veio: id do jogo, do torneio ou do pacote. Deixa o extrato legível.
  origin      TEXT,
  -- Chave de idempotência: identifica a INTENÇÃO do cliente, não a linha.
  -- Duas requisições com a mesma chave são a mesma aposta tentada duas vezes (dedo
  -- duplo, retry depois de timeout, dois aparelhos), e só a primeira pode valer.
  -- Nula nas entradas que o servidor cria por conta própria (prêmio, ajuste, bônus).
  action_id   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- O saldo é lido somando as entradas do usuário, então esse índice é o caminho quente
-- do sistema inteiro: toda aposta passa por ele.
CREATE INDEX IF NOT EXISTS ledger_entries_user_idx ON ledger_entries (user_id, id);

-- Colunas novas em bancos que já existiam antes delas.
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS action_id TEXT;

-- É ESTE índice que impede o débito duplo, e é ele que faz o trabalho de verdade:
-- não é o código que decide se já viu a ação, é o banco que recusa a segunda. Assim
-- vale mesmo com duas requisições simultâneas em processos diferentes, que é
-- exatamente o caso em que uma checagem em código falharia.
-- Parcial (WHERE action_id IS NOT NULL) porque as entradas do servidor não têm chave
-- e não devem colidir entre si.
CREATE UNIQUE INDEX IF NOT EXISTS ledger_entries_action_idx
  ON ledger_entries (user_id, action_id)
  WHERE action_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS friend_requests (
  id          BIGSERIAL   PRIMARY KEY,
  from_user_id TEXT       NOT NULL REFERENCES users(id),
  to_user_id  TEXT        NOT NULL REFERENCES users(id),
  status      TEXT        NOT NULL CHECK (status IN ('pendente','aceita')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (from_user_id <> to_user_id)
);

-- Só pode existir um vínculo entre duas pessoas, não importa quem pediu primeiro.
-- LEAST/GREATEST normaliza o par, então (a,b) e (b,a) colidem no mesmo índice.
CREATE UNIQUE INDEX IF NOT EXISTS friend_requests_par_idx
  ON friend_requests (LEAST(from_user_id, to_user_id), GREATEST(from_user_id, to_user_id));

CREATE TABLE IF NOT EXISTS coupons (
  code             TEXT        PRIMARY KEY,
  chips            BIGINT      NOT NULL CHECK (chips > 0),
  max_redemptions  INTEGER     NOT NULL CHECK (max_redemptions > 0),
  active           BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A chave composta é o que garante "um resgate por pessoa" no banco, não só no código.
CREATE TABLE IF NOT EXISTS coupon_redemptions (
  coupon_code TEXT        NOT NULL REFERENCES coupons(code) ON DELETE CASCADE,
  user_id     TEXT        NOT NULL REFERENCES users(id),
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (coupon_code, user_id)
);

CREATE TABLE IF NOT EXISTS tournament_rounds (
  id        BIGSERIAL   PRIMARY KEY,
  user_id   TEXT        NOT NULL REFERENCES users(id),
  game_id   TEXT        NOT NULL,
  stake     BIGINT      NOT NULL CHECK (stake > 0),
  returned  BIGINT      NOT NULL CHECK (returned >= 0),
  played_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tournament_rounds_janela_idx ON tournament_rounds (played_at, game_id);

-- Marca a janela de torneio já premiada. A chave primária é o que impede pagar duas
-- vezes: a segunda tentativa de inserir a mesma janela viola a chave e é ignorada.
CREATE TABLE IF NOT EXISTS tournament_settlements (
  tournament_id TEXT        NOT NULL,
  window_start  TIMESTAMPTZ NOT NULL,
  settled_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, window_start)
);

-- Compras já processadas. A chave primária é o id do evento do provedor de pagamento:
-- se ele reenviar o mesmo evento (o que provedores fazem quando não recebem o 200),
-- a segunda inserção viola a chave e a ficha não é creditada de novo.
CREATE TABLE IF NOT EXISTS purchases (
  provider_event_id TEXT        PRIMARY KEY,
  user_id           TEXT        NOT NULL REFERENCES users(id),
  package_id        TEXT        NOT NULL,
  chips             BIGINT      NOT NULL CHECK (chips > 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Preenchido quando o provedor avisa que a compra foi estornada. As fichas NÃO são
  -- retiradas automaticamente (a pessoa pode já ter apostado, e saldo negativo quebra
  -- a carteira) — fica marcado aqui pra o suporte decidir o que fazer.
  refunded_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS purchases_user_idx ON purchases (user_id, created_at);

-- --- Identidade visível e aparência do jogador ---
--
-- `public_code` é o número que a pessoa vê no perfil e diz pro suporte. O `id` de
-- verdade (`u-` mais nove bytes em base64url) não serve pra isso: ninguém consegue ler
-- em voz alta nem digitar sem errar. São oito dígitos, mostrados como 0000-0000.
--
-- `avatar` guarda QUAL retrato a pessoa escolheu, por nome, e não uma imagem: as
-- opções são arte que já vem dentro do aplicativo. Guardar o arquivo aqui significaria
-- upload, armazenamento e moderação de imagem — três problemas que a escolha entre
-- retratos prontos não tem.
--
-- Entram como ALTER e não na criação da tabela porque a tabela já existe nas bases que
-- estão rodando. `IF NOT EXISTS` nos dois lados deixa isto rodar toda subida sem fazer
-- nada quando já foi aplicado.
ALTER TABLE users ADD COLUMN IF NOT EXISTS public_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_public_code_idx ON users (public_code);

-- --- Idade e aceite dos termos ---
--
-- `birth_date` é DATA e não idade: idade muda sozinha todo ano, e guardar um número que
-- envelhece errado é como não guardar nada. A conferência dos 18 anos é feita a partir
-- dela, no momento em que importa.
--
-- `terms_accepted_at` guarda QUANDO a pessoa aceitou, e não um sim/não. Um booleano não
-- responde a única pergunta que alguém faria depois ("aceitou qual versão, quando?"), e
-- `terms_version` diz qual texto estava valendo — sem isso, mudar os termos apagaria o
-- histórico de quem concordou com os antigos.
--
-- Entram como ALTER porque a tabela já existe nas bases rodando.
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS legal_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version TEXT;

-- --- Recompensa diária ---
--
-- Uma linha por jogador, e não uma por coleta: o que precisa ser sabido é só onde a
-- pessoa está na sequência e quando ela coletou pela última vez. O histórico de quem
-- recebeu o quê já existe no livro-caixa (`ledger_entries`, tipo 'presente'), e guardar
-- de novo aqui seria duas verdades sobre o mesmo fato.
--
-- `last_claim_day` é a DATA (sem hora) do dia em que a coleta aconteceu, e não o
-- instante. É ela que a regra usa — "coletou hoje", "coletou ontem" —, e guardar a data
-- torna a conta imune a fuso e a horário de verão dentro do mesmo dia.
--
-- A CHAVE PRIMÁRIA NO user_id É O QUE IMPEDE COLETAR DUAS VEZES. A coleta é um UPDATE
-- condicionado a `last_claim_day < CURRENT_DATE`: dois pedidos simultâneos disputam a
-- mesma linha, o segundo encontra a data já de hoje e não atualiza nada — então não
-- paga. Sem isso, dois toques rápidos no botão valeriam dois prêmios.
CREATE TABLE IF NOT EXISTS daily_rewards (
  user_id        TEXT    PRIMARY KEY REFERENCES users(id),
  -- Em que dia do calendário (1 a 30) foi a última coleta.
  last_claim_day INTEGER NOT NULL CHECK (last_claim_day BETWEEN 1 AND 30),
  -- A data da última coleta, em UTC. NULL nunca acontece: a linha só nasce ao coletar.
  last_claim_on  DATE    NOT NULL,
  -- Quantos dias seguidos, pra mostrar na tela. É informação, não regra.
  streak         INTEGER NOT NULL DEFAULT 1 CHECK (streak >= 1)
);

-- --- O extrato passa a se auditar sozinho ---
--
-- Antes, cada linha guardava só o movimento (`amount`). Pra saber se o extrato estava
-- certo era preciso somar tudo de novo — e uma linha perdida no meio some sem deixar
-- marca, porque a soma continua sendo a soma do que sobrou.
--
-- Com o saldo ANTES e DEPOIS gravados na própria linha, o extrato vira uma corrente:
-- o `balance_after` de uma linha tem que ser o `balance_before` da seguinte, e
-- `balance_before + amount` tem que dar `balance_after`. Qualquer buraco, qualquer
-- gravação fora de transação e qualquer linha apagada quebram a corrente num ponto
-- exato, que dá pra apontar. É o que `verifica-corrente-do-extrato.ts` confere.
--
-- `round_id` amarra o movimento à rodada que o causou: a aposta e o prêmio da mesma
-- rodada passam a ter o mesmo identificador, e aí dá pra perguntar "quanto esta rodada
-- custou e pagou" sem adivinhar por horário.
--
-- As três entram como ALTER porque a tabela já existe nas bases rodando, e ficam
-- NULL nas linhas antigas — que é a verdade: aquele saldo não foi gravado na época.
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS balance_before BIGINT;
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS balance_after  BIGINT;
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS round_id       TEXT;

CREATE INDEX IF NOT EXISTS ledger_entries_rodada_idx ON ledger_entries (round_id)
  WHERE round_id IS NOT NULL;

-- ============================================================================
-- AS RODADAS, E O QUE ACONTECEU DENTRO DELAS
-- ============================================================================
--
-- O problema que estas duas tabelas resolvem: hoje, se alguém disser "sumiu uma ficha
-- ontem", temos o extrato — sabemos que saiu 100 e entrou 0 — e não temos O QUE
-- ACONTECEU. Não dá pra responder "por que", só "quanto". Uma reclamação vira palavra
-- contra palavra, e um defeito de animação some sem deixar rastro.
--
-- COMO ELAS SE DIVIDEM. `rodadas` guarda o que precisa ser PROCURADO: por jogo, por
-- data, por estado, por mesa. Isso vira coluna e vira índice. `eventos_da_rodada`
-- guarda o que precisa ser LIDO EM ORDEM depois de já ter achado a rodada — e o
-- conteúdo de cada evento é JSONB porque cada tipo carrega uma coisa diferente. A
-- divisão é essa, e não "coluna é o que eu lembrei" contra "JSON é o resto": jogar tudo
-- num JSON gigante faz toda pergunta virar varredura da tabela inteira.

CREATE TABLE IF NOT EXISTS rodadas (
  -- O id vem do servidor e é o mesmo que aparece no extrato (`ledger_entries.round_id`)
  -- e nas mensagens pro cliente. É por ele que uma reclamação é investigada.
  id                   TEXT PRIMARY KEY,
  jogo                 TEXT NOT NULL,
  -- NULL numa rodada solo; o código da mesa quando há gente junto.
  mesa                 TEXT,
  -- A fase em que a rodada está ou parou. Os valores são os de `protocolo/fases.ts`.
  estado               TEXT NOT NULL,
  --
  -- AS VERSÕES EXISTEM PRA RODADA VELHA CONTINUAR LEGÍVEL.
  --
  -- Se daqui a seis meses a regra da Banca Francesa mudar, uma rodada de hoje tem que
  -- continuar interpretável — e a única forma de saber COM QUAL REGRA ela foi decidida é
  -- ter gravado isso junto. Sem estas duas colunas, o replay depende eternamente do
  -- código de agora, e um dia passa a mentir em silêncio.
  --
  -- `versao_da_regra` muda quando o resultado ou o pagamento mudam de comportamento.
  -- `versao_do_protocolo` muda quando o formato dos eventos muda.
  versao_da_regra      TEXT NOT NULL,
  versao_do_protocolo  INTEGER NOT NULL,
  -- O que saiu: dados, número da roleta, cartas. Estrutura por jogo, por isso JSONB.
  -- Fica NULL até a rodada decidir — e NULL aqui quer dizer "não decidiu", não "não sei".
  resultado            JSONB,
  aberta_em            TIMESTAMPTZ NOT NULL DEFAULT now(),
  apostas_fechadas_em  TIMESTAMPTZ,
  decidida_em          TIMESTAMPTZ,
  fechada_em           TIMESTAMPTZ,
  atualizada_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Procurar rodada de um jogo por data é a pergunta mais comum do suporte.
CREATE INDEX IF NOT EXISTS rodadas_jogo_data_idx ON rodadas (jogo, aberta_em DESC);
-- "O que ficou preso?" — só as que não fecharam, que são poucas. Índice parcial porque
-- um índice sobre `estado` inteiro seria quase todo RODADA_FECHADA, e não serviria pra
-- nada além de ocupar espaço.
CREATE INDEX IF NOT EXISTS rodadas_abertas_idx ON rodadas (estado, atualizada_em)
  WHERE fechada_em IS NULL;
CREATE INDEX IF NOT EXISTS rodadas_mesa_idx ON rodadas (mesa, aberta_em DESC)
  WHERE mesa IS NOT NULL;

CREATE TABLE IF NOT EXISTS eventos_da_rodada (
  rodada_id  TEXT    NOT NULL REFERENCES rodadas(id) ON DELETE CASCADE,
  --
  -- A ORDEM É A CHAVE PRIMÁRIA, e não um detalhe.
  --
  -- Horário não serve como ordem: dois eventos no mesmo milissegundo empatam, o relógio
  -- da máquina anda pra trás no acerto de hora, e mensagem de rede chega fora de ordem.
  -- `seq` é um contador por rodada, atribuído dentro da mesma transação que grava o
  -- evento, com a linha da rodada travada. Assim "o 17 veio depois do 16" continua
  -- verdade depois de o processo reiniciar, depois de um backup restaurado e depois de
  -- duas conexões gravarem ao mesmo tempo — a chave primária recusa a duplicata.
  seq        INTEGER NOT NULL,
  tipo       TEXT    NOT NULL,
  -- De quem foi o evento, quando foi de alguém. NULL nos eventos da mesa (abriu,
  -- fechou, sorteou). É referência de verdade pra o dado sumir junto com a conta.
  usuario_id TEXT    REFERENCES users(id) ON DELETE SET NULL,
  em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  --
  -- O CONTEÚDO, e só o necessário pra reconstruir a rodada.
  --
  -- Nunca entra aqui: e-mail, senha, token, endereço de rede, nem carta privada de
  -- outro jogador. Não é zelo abstrato — este log é lido no suporte e sai em backup, e
  -- o que não foi gravado não vaza.
  dados      JSONB   NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (rodada_id, seq)
);

-- "O que este jogador fez nesta rodada" e "onde ele estava quando reclamou".
CREATE INDEX IF NOT EXISTS eventos_usuario_idx ON eventos_da_rodada (usuario_id, em DESC)
  WHERE usuario_id IS NOT NULL;

-- --- O teto diário de XP ---
--
-- Duas colunas na própria linha do usuário, e não uma tabela de histórico, porque a
-- única pergunta que o teto faz é "quanto já subiu HOJE". O histórico de XP ganho por
-- rodada já existe: cada rodada está em `rodadas` com o que foi apostado, e o XP sai do
-- apostado por uma função pura.
--
-- `xp_do_dia_em` guarda de QUE DIA é o contador. Sem ela seria preciso uma tarefa
-- agendada zerando `xp_do_dia` de todo mundo à meia-noite — que é trabalho recorrente,
-- falha em silêncio quando o processo está fora do ar, e dá a todos a mesma meia-noite.
-- Com a data junto, o contador se zera sozinho na primeira rodada de cada dia: se o dia
-- gravado não é hoje, o que estava lá era de ontem e não conta.
--
-- O DIA É EM UTC e vem do código (`src/comum/dia-do-servidor.ts`), nunca de
-- `CURRENT_DATE`. `CURRENT_DATE` é a data no fuso do BANCO — trocar o fuso do servidor
-- moveria a virada do dia pra todo mundo de uma vez, e horário de verão daria dias de 23
-- e de 25 horas. A régua do dia está escrita em um lugar só, em código, onde se lê.
ALTER TABLE users ADD COLUMN IF NOT EXISTS xp_do_dia    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS xp_do_dia_em DATE;

-- --- A recompensa diária, corrigida ---
--
-- TRÊS DEFEITOS ESTAVAM AQUI, e os três são de tipos diferentes.
--
-- 1. O CHECK travava o calendário em trinta dias (`BETWEEN 1 AND 30`), então o mês de
--    verdade — 28, 29, 30 ou 31 — não cabia. Em fevereiro o marco de fim de mês nunca
--    chegava; em julho o dia 31 era recusado pelo banco.
--
-- 2. `last_claim_on` era comparado com `CURRENT_DATE`, que é a data no fuso do BANCO.
--    Trocar o fuso do servidor moveria a virada do dia pra todo mundo de uma vez, e
--    horário de verão dá dias de 23 e de 25 horas. A régua agora vem do código
--    (`comum/dia-do-servidor.ts`, em UTC) e é passada como parâmetro.
--
-- 3. E O PIOR: a linha era marcada como coletada ANTES de o prêmio ser creditado, fora
--    de transação. Morrendo o processo entre as duas, a pessoa ficava marcada como tendo
--    coletado E NÃO RECEBIA — e não podia coletar de novo. Dinheiro não movido com a
--    marca já gravada é invisível: ninguém reclama do que não sabe que existia.
ALTER TABLE daily_rewards DROP CONSTRAINT IF EXISTS daily_rewards_last_claim_day_check;
ALTER TABLE daily_rewards ADD COLUMN IF NOT EXISTS streak_total INTEGER NOT NULL DEFAULT 1;

-- O HISTÓRICO DE COLETAS — uma linha por coleta, e é ela que fecha a janela.
--
-- A coleta inteira passou a ser uma transação só: grava esta linha, credita a carteira e
-- atualiza `daily_rewards`. Ou as três acontecem, ou nenhuma acontece. O pior caso deixou
-- de ser "marcado e não pago" e virou "nada aconteceu, tente de novo".
--
-- `claim_id` É A CHAVE DE IDEMPOTÊNCIA, e é o cliente quem a escolhe — ela identifica a
-- INTENÇÃO ("a coleta que eu pedi às 9h03"), não a linha. Dois toques no botão, um retry
-- depois de timeout, ou o mesmo pedido saindo de dois aparelhos chegam com a mesma chave,
-- e o índice único faz o banco recusar o segundo. É o mesmo padrão de `ledger_entries`.
--
-- E ELE GUARDA O QUE FOI USADO NA CONTA — nível, multiplicador do dia e bônus — porque
-- daqui a seis meses "por que recebi 3.000?" precisa de resposta, e recalcular com os
-- números de hoje responderia outra pergunta. O multiplicador é gravado como inteiro em
-- centésimos pra não guardar dinheiro perto de ponto flutuante.
CREATE TABLE IF NOT EXISTS daily_reward_claims (
  claim_id      TEXT        PRIMARY KEY,
  user_id       TEXT        NOT NULL REFERENCES users(id),
  -- O dia do servidor (UTC) em que a coleta valeu. Um por pessoa, garantido pelo índice.
  claimed_on    DATE        NOT NULL,
  -- A casa do calendário coletada (1 até o tamanho do mês).
  calendar_day  INTEGER     NOT NULL CHECK (calendar_day BETWEEN 1 AND 31),
  -- Dias seguidos até esta coleta, contando esta.
  streak        INTEGER     NOT NULL CHECK (streak >= 1),
  -- O nível do jogador no momento da coleta.
  level         INTEGER     NOT NULL,
  -- Multiplicador do dia e bônus de nível, em centésimos (250 = 2,50x).
  day_multiplier    INTEGER NOT NULL,
  level_bonus_cents INTEGER NOT NULL,
  chips         BIGINT      NOT NULL CHECK (chips > 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- É ESTE ÍNDICE QUE IMPEDE COLETAR DUAS VEZES NO MESMO DIA, e não uma checagem em código.
-- Dois pedidos simultâneos em processos diferentes não se enxergam; o banco enxerga os
-- dois. O segundo bate no índice e a transação inteira é desfeita — sem pagar.
CREATE UNIQUE INDEX IF NOT EXISTS daily_reward_claims_um_por_dia
  ON daily_reward_claims (user_id, claimed_on);

CREATE INDEX IF NOT EXISTS daily_reward_claims_user_idx
  ON daily_reward_claims (user_id, claimed_on DESC);

-- --- A configuração da recompensa, no servidor ---
--
-- Uma linha por versão, e nunca um UPDATE: mudar o valor de um marco não pode reescrever
-- o passado. A versão em vigor é a de maior `versao` com `valida_de <= hoje`, e as
-- anteriores ficam pra explicar o que foi pago quando.
--
-- ESTÁ VAZIA POR PADRÃO, e isso é de propósito: sem linha, valem os valores do código
-- (`calendario.ts`), que são os aprovados em docs/economia.md. A tabela existe pra dar
-- pra corrigir um número sem soltar versão nova do servidor — não pra que os números
-- fiquem escondidos num banco onde ninguém os lê junto com a regra.
CREATE TABLE IF NOT EXISTS daily_reward_config (
  versao        INTEGER     PRIMARY KEY,
  valida_de     DATE        NOT NULL,
  -- A âncora em fichas (o mínimo da mesa Bronze), e os quatro marcos, em JSON.
  ancora        BIGINT      NOT NULL CHECK (ancora > 0),
  marcos        JSONB       NOT NULL,
  marco_fim_mes INTEGER     NOT NULL CHECK (marco_fim_mes > 0),
  teto_do_bonus INTEGER     NOT NULL CHECK (teto_do_bonus > 0),
  criada_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  criada_por    TEXT
);

-- --- As promoções da loja ---
--
-- UMA PROMOÇÃO É UMA LINHA COM PRAZO, e não um `if` no código. A diferença importa: com um
-- `if`, "o pacote grande está 50% maior nesta semana" precisa de uma versão nova do
-- servidor para começar E outra para acabar — e a que acaba é a que alguém esquece.
--
-- `starts_at` e `ends_at` são DATAS do servidor (UTC), a mesma régua de tudo que conta dia
-- neste projeto (`comum/dia-do-servidor.ts`). Nunca `CURRENT_DATE`.
--
-- NÃO EXISTE URGÊNCIA FABRICADA AQUI. `ends_at` é a data real de fim, publicada à tela
-- para que ela mostre "termina domingo" — e não um relógio regressivo que reinicia quando
-- a pessoa volta. Uma promoção que "acaba em 4 minutos" toda vez que o aplicativo abre é
-- mentira, e este projeto não conta essa.
CREATE TABLE IF NOT EXISTS store_promotions (
  promotion_id   TEXT        PRIMARY KEY,
  nome           TEXT        NOT NULL,
  starts_at      DATE        NOT NULL,
  ends_at        DATE        NOT NULL,
  -- Quanto acrescenta por cima do pacote, em porcentagem inteira. 50 = +50% de fichas.
  bonus_percent  INTEGER     NOT NULL CHECK (bonus_percent > 0 AND bonus_percent <= 500),
  -- Em que pacotes vale. Vazio = todos.
  package_ids    TEXT[]      NOT NULL DEFAULT '{}',
  -- Em que degraus econômicos vale. Vazio = todos.
  eligible_tiers TEXT[]      NOT NULL DEFAULT '{}',
  -- Quantas vezes cada pessoa pode comprar com esta promoção. NULL = sem limite.
  purchase_limit INTEGER     CHECK (purchase_limit IS NULL OR purchase_limit > 0),
  ativa          BOOLEAN     NOT NULL DEFAULT TRUE,
  criada_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at >= starts_at)
);

CREATE INDEX IF NOT EXISTS store_promotions_janela ON store_promotions (starts_at, ends_at)
  WHERE ativa;

-- A promoção usada em cada compra fica GRAVADA NA COMPRA, e não só na tabela de promoções.
-- Sem isso, editar ou apagar uma promoção reescreveria o passado: uma compra de três meses
-- atrás passaria a "ter sido" com o bônus de hoje, e o suporte não teria como explicar o
-- número que a pessoa viu na tela naquele dia.
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS promotion_id      TEXT;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS bonus_percent     INTEGER;
-- O degrau e o nível no momento da compra: são eles que explicam o tamanho do pacote.
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS tier_id           TEXT;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS level             INTEGER;
-- Preço e moeda, em centavos e inteiro. Dinheiro perto de ponto flutuante vira 9,899999.
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS price_cents       INTEGER;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS currency          TEXT;
-- Qual porta o dinheiro usou: revenuecat, pix, cartao... Ver PortaDePagamento.
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS provider          TEXT;

CREATE INDEX IF NOT EXISTS purchases_promotion_idx ON purchases (promotion_id)
  WHERE promotion_id IS NOT NULL;
