# syntax=docker/dockerfile:1

# Imagem única, dois alvos: `api` (a API NestJS) e `web` (a LP e o painel já
# construídos, servidos pelo nginx que também é o proxy reverso do domínio
# único). Um Dockerfile só porque os dois alvos partem da mesma instalação de
# dependências do monorepo — separá-los faria o `npm ci` rodar duas vezes.
#
# Nenhum segredo entra aqui. As variáveis do navegador (`VITE_*`) chegam como
# argumentos de build e são todas públicas por definição; a chave secreta do
# Supabase só existe em variável de ambiente do contêiner da API, em execução.

# Node 24, não 20: `@supabase/supabase-js` (fixado em ^2.114) deixou de suportar
# Node 20 na versão 2.110.0, porque `realtime-js` exige o WebSocket nativo que só
# existe a partir do Node 22. Com Node 20 a API subia, inicializava os módulos e
# morria em `createSupabaseClient` com "Node.js detected but native WebSocket not
# found" — em laço de reinício, sem nunca ficar saudável. 24 é também a versão do
# hospedeiro em que o projeto é verificado (ver docs/OPERACAO.md).
ARG NODE_VERSION=24-alpine
ARG NGINX_VERSION=1.27-alpine

# ---------------------------------------------------------------------------
# Dependências de desenvolvimento — o que build e checagem de tipos precisam.
# Copiar só os manifestos antes do código faz esta camada sobreviver a qualquer
# alteração de fonte.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/admin/package.json apps/admin/
COPY apps/lp/package.json apps/lp/
COPY packages/content-schema/package.json packages/content-schema/
COPY packages/design-tokens/package.json packages/design-tokens/
RUN npm ci

# ---------------------------------------------------------------------------
# Dependências de execução da API — as mesmas versões do lockfile, sem as de
# desenvolvimento. É o que vai para a imagem final da API.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS deps-producao
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/admin/package.json apps/admin/
COPY apps/lp/package.json apps/lp/
COPY packages/content-schema/package.json packages/content-schema/
COPY packages/design-tokens/package.json packages/design-tokens/
RUN npm ci --omit=dev

# ---------------------------------------------------------------------------
# Código-fonte sobre as dependências de desenvolvimento.
# ---------------------------------------------------------------------------
FROM deps AS fonte
COPY . .

# ---------------------------------------------------------------------------
# Build da API. `npm run build -w apps/api` dispara o `prebuild`, que constrói
# packages/content-schema antes — a API o consome pelo `dist`.
# ---------------------------------------------------------------------------
FROM fonte AS build-api
RUN npm run build -w apps/api

# ---------------------------------------------------------------------------
# API em execução.
#
# Parte de `deps-producao` em vez de copiar node_modules para uma imagem limpa:
# num monorepo o npm nem sempre iça tudo para a raiz — `jose`, por exemplo, fica
# em `apps/api/node_modules` porque há outra versão dele em outro workspace.
# Copiar só `/repo/node_modules` deixaria a API subindo e morrendo em
# `Cannot find module 'jose'`. Herdar o estágio traz a árvore inteira, no lugar
# em que o `npm ci` a deixou.
# ---------------------------------------------------------------------------
FROM deps-producao AS api
WORKDIR /repo/apps/api
ENV NODE_ENV=production
COPY --from=build-api /repo/apps/api/dist /repo/apps/api/dist
# O pacote de esquemas é uma dependência de workspace: `npm ci` deixou um link
# simbólico em node_modules apontando para cá, então o `dist` precisa existir.
COPY --from=build-api /repo/packages/content-schema/dist /repo/packages/content-schema/dist
EXPOSE 3000
CMD ["node", "dist/main.js"]

# ---------------------------------------------------------------------------
# Build da LP e do painel.
#
# Todo `VITE_*` entra no arquivo servido ao navegador — é o contrato do Vite, e
# por isso nenhuma destas variáveis é segredo. A chave secreta do Supabase não
# aparece aqui de propósito: ela não tem argumento de build correspondente, e
# um `docker build --build-arg` que a passasse seria ignorado.
# ---------------------------------------------------------------------------
FROM fonte AS build-web
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_API_BASE_URL=/api
ARG VITE_CONTENT_ENDPOINT=/api/content
ARG VITE_LEAD_SUBMIT_ENDPOINT=/api/leads
ARG VITE_EBOOK_URL=
ARG VITE_EBOOK_DELIVERY_MODE=email
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL} \
    VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY} \
    VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_CONTENT_ENDPOINT=${VITE_CONTENT_ENDPOINT} \
    VITE_LEAD_SUBMIT_ENDPOINT=${VITE_LEAD_SUBMIT_ENDPOINT} \
    VITE_EBOOK_URL=${VITE_EBOOK_URL} \
    VITE_EBOOK_DELIVERY_MODE=${VITE_EBOOK_DELIVERY_MODE}
RUN npm run build -w apps/lp && npm run build -w apps/admin

# ---------------------------------------------------------------------------
# Proxy reverso + arquivos estáticos: a porta única.
#
# A LP vai para a raiz e o painel para `admin/`, porque o build do painel já sai
# com `base: '/admin/'` (SDD § D-04). O mapa de caminhos está em nginx.conf.
# ---------------------------------------------------------------------------
FROM nginx:${NGINX_VERSION} AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/proxy.conf /etc/nginx/proxy_veggiedent.conf
COPY --from=build-web /repo/apps/lp/dist /usr/share/nginx/html
COPY --from=build-web /repo/apps/admin/dist /usr/share/nginx/html/admin
EXPOSE 8080
