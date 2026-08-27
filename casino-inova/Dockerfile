# Casino Inova — app e servidor numa imagem só.
#
# O app web é construído e depois SERVIDO pelo próprio servidor Node, na mesma porta.
# Com site e API na mesma origem não existe CORS pra configurar, o endereço da API não
# precisa ser escrito em lugar nenhum (o app usa a origem da página) e publicar é subir
# um processo só, em vez de dois serviços que precisam se achar.

# --- 1. constrói o app web ---
FROM node:20-slim AS app
WORKDIR /app
COPY app/package*.json ./
RUN npm ci
COPY app/ ./
RUN npx expo export --platform web

# --- 2. constrói o servidor ---
FROM node:20-slim AS servidor
WORKDIR /servidor
COPY server/package*.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

# --- 3. imagem final: só o que roda ---
FROM node:20-slim
WORKDIR /casino
ENV NODE_ENV=production

COPY server/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=servidor /servidor/dist ./dist
COPY --from=app /app/dist ./site

# Onde o servidor acha o site. Sem isso ele procuraria em ../../app/dist, que só
# existe no repositório.
ENV PASTA_DO_SITE=/casino/site
ENV PORT=3000
EXPOSE 3000

# JWT_SECRET e DATABASE_URL vêm do ambiente da hospedagem — o servidor se recusa a
# subir sem o segredo, de propósito.
CMD ["node", "dist/main.js"]
