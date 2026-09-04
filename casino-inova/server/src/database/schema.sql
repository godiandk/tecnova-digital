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
