FROM node:22.23-trixie-slim@sha256:c5849ff9c9ebcd66615412f0b548ca5b8ecaef84003dc9ac2e077ebe46aaa3f6 AS base
WORKDIR /app

FROM base AS deps
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

FROM base AS build
ENV NODE_ENV=development
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
RUN npm ci && npm run prisma:generate && npm run build

FROM build AS test
ENV NODE_ENV=test
COPY tests ./tests

FROM base AS runtime
ENV NODE_ENV=production
RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
              /usr/local/bin/yarn /usr/local/bin/yarnpkg /usr/local/bin/pnpm /usr/local/bin/pnpx
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./
USER node
CMD ["node", "dist/server.js"]