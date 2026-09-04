# Casino Inova — app e servidor numa imagem só.
#
# O app web é construído e depois SERVIDO pelo próprio servidor Node, na mesma porta.
# Com site e API na mesma origem não existe CORS pra configurar, o endereço da API não
# precisa ser escrito em lugar nenhum (o app usa a origem da página) e publicar é subir
# um processo só, em vez de dois serviços que precisam se achar.
#
# As duas etapas de construção usam a imagem `node:20` completa, e não a `slim`: a
# exportação do Expo mexe com imagens (ícone, splash) e precisa das ferramentas de
# compilação que a slim não traz. Só a imagem final é slim, que é a que fica.

# --- 1. constrói o app web ---
FROM node:20 AS app
WORKDIR /app
# package.json e lock primeiro: enquanto eles não mudarem, o Docker reaproveita a
# instalação e a construção seguinte é bem mais rápida.
COPY app/package.json app/package-lock.json ./
RUN npm ci
COPY app/ ./
RUN npx expo export --platform web

# --- 2. compila o servidor ---
FROM node:20 AS servidor
WORKDIR /servidor
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# --- 3. imagem final: só o que roda ---
FROM node:20-slim
WORKDIR /casino
ENV NODE_ENV=production

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=servidor /servidor/dist ./dist
COPY --from=app /app/dist ./site

# Os termos de uso e a política de privacidade, servidos em /legal/termos e
# /legal/privacidade. O texto mora em docs/ e não dentro do código: documento jurídico
# escondido numa constante de TypeScript é documento que ninguém revisa. Esta linha é o
# preço de ter UM texto só — o mesmo que o app mostra e o mesmo que está no repositório.
COPY docs/termos-de-uso.md docs/politica-de-privacidade.md ./documentos/

# Onde o servidor acha o site. Sem isto ele procuraria em ../../app/dist, caminho que
# só existe no repositório.
ENV PASTA_DO_SITE=/casino/site
ENV PORT=3000
EXPOSE 3000

# JWT_SECRET e DATABASE_URL vêm do ambiente da hospedagem — o servidor se recusa a
# subir sem o segredo, de propósito.
CMD ["node", "dist/main.js"]
