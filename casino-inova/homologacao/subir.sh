#!/usr/bin/env bash
#
# AMBIENTE DE HOMOLOGAÇÃO FIXO do Casino Inova.
#
# Sobe sempre a MESMA coisa, do mesmo jeito, pra que "funcionou aqui" queira dizer
# alguma coisa. Sem isto, cada conferência roda contra um servidor com variável de
# ambiente diferente, banco em estado diferente e site construído noutra hora — e um
# defeito que aparece numa rodada e some na outra vira "coisa do navegador".
#
#   ./homologacao/subir.sh          sobe banco + servidor + site
#   ./homologacao/subir.sh --testes sobe e roda todas as conferências
#
# Tudo em cima de localhost:3000. O próprio servidor serve o site construído.
set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(dirname "$AQUI")"

# --- as credenciais são fixas de propósito: é ambiente de teste, não de produção ---
export DATABASE_URL="${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/casino_inova}"
export TEST_DATABASE_URL="${TEST_DATABASE_URL:-postgres://postgres:postgres@localhost:5432/casino_inova_test}"
export JWT_SECRET="${JWT_SECRET:-segredo-de-homologacao-nao-usar-em-producao}"
export EMAILS_DE_ADMIN="${EMAILS_DE_ADMIN:-wly.vianna@gmail.com}"
export PORT="${PORT:-3000}"

echo "== 1/4  banco =="
pg_ctlcluster 16 main start 2>/dev/null || true
for i in $(seq 1 20); do
  if PGPASSWORD=postgres psql -h localhost -U postgres -c 'select 1' >/dev/null 2>&1; then break; fi
  sleep 1
done
PGPASSWORD=postgres psql -h localhost -U postgres -tc \
  "SELECT 1 FROM pg_database WHERE datname='casino_inova'" | grep -q 1 \
  || PGPASSWORD=postgres createdb -h localhost -U postgres casino_inova
PGPASSWORD=postgres psql -h localhost -U postgres -tc \
  "SELECT 1 FROM pg_database WHERE datname='casino_inova_test'" | grep -q 1 \
  || PGPASSWORD=postgres createdb -h localhost -U postgres casino_inova_test
echo "   ok: casino_inova e casino_inova_test de pé"

echo "== 2/4  site (expo export) =="
cd "$RAIZ/app" && npx expo export --platform web --output-dir dist >/tmp/expo-export.log 2>&1
tail -1 /tmp/expo-export.log

echo "== 3/4  servidor =="
cd "$RAIZ/server"
# derruba o servidor anterior POR PID: `pkill -f <texto>` casa com esta própria linha
# de comando e mata o shell que a executa.
for pid in $(ps -eo pid,args | grep '[t]s-node src/main.ts' | awk '{print $1}'); do
  kill "$pid" 2>/dev/null || true
done
nohup npm run start:dev >/tmp/servidor-homologacao.log 2>&1 &
for i in $(seq 1 40); do
  if curl -sf --noproxy '*' -o /dev/null "http://localhost:$PORT/games/slots/config"; then break; fi
  sleep 1
done
curl -sf --noproxy '*' -o /dev/null "http://localhost:$PORT/games/slots/config" \
  && echo "   ok: http://localhost:$PORT" \
  || { echo "   FALHOU — veja /tmp/servidor-homologacao.log"; tail -5 /tmp/servidor-homologacao.log; exit 1; }

echo "== 4/4  versão em teste =="
git -C "$RAIZ/.." log --oneline -1

if [ "${1:-}" = "--testes" ]; then
  echo
  echo "== conferências do servidor =="
  cd "$RAIZ/server" && npm run verify:tudo
  echo
  echo "== conferências do aplicativo =="
  cd "$RAIZ/app" && npm run verify:tudo
  echo
  echo "== o dinheiro entra e sai certo =="
  cd "$RAIZ/server" && node verificacao/verifica-dinheiro.mjs

  # As conferências abaixo falam com o servidor que acabou de subir e com o navegador —
  # por isso não estão no `verify:tudo`, que precisa rodar sem nada no ar.
  # TODAS as conferências de ponta a ponta, e não só duas.
  #
  # Quatro delas estavam quebradas há tempos e ninguém sabia, porque não rodavam em
  # lugar nenhum: a rota de cadastro passou a exigir data de nascimento e elas não
  # mandavam. Conferência que não roda não é conferência — é arquivo.
  echo
  echo "== ponta a ponta, jogo por jogo =="
  cd "$RAIZ/server"
  for v in verifica-banca-nulos verifica-slots verifica-blackjack verifica-domino \
           verifica-idempotencia verifica-reconexao verifica-queda-truco \
           verifica-janela-mesa verifica-perfil-e-admin; do
    printf '   %-26s ' "$v"
    if node "verificacao/$v.mjs" >"/tmp/$v.log" 2>&1; then
      echo "ok"
    else
      echo "FALHOU — veja /tmp/$v.log"
      grep -iE 'FALHOU|Error:' "/tmp/$v.log" | head -2
    fi
  done
  echo
  echo "== a mesa cabe nos cinco tamanhos =="
  cd "$RAIZ/app" \
    && PLAYWRIGHT="${PLAYWRIGHT:-/opt/node22/lib/node_modules/playwright/index.js}" \
       CHROMIUM="${CHROMIUM:-/opt/pw-browsers/chromium-1194/chrome-linux/chrome}" \
       node verificacao/verifica-tamanhos.mjs
fi
