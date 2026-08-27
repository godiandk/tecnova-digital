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
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- O saldo é lido somando as entradas do usuário, então esse índice é o caminho quente
-- do sistema inteiro: toda aposta passa por ele.
CREATE INDEX IF NOT EXISTS ledger_entries_user_idx ON ledger_entries (user_id, id);

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
