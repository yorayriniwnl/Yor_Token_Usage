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

FROM gcr.io/distroless/cc-debian13:nonroot@sha256:54df941ed0d06a1bd95ef5e0ce391fd8d9f94b64782dc9a60062727849ee3f97 AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /usr/local/bin/node /usr/local/bin/node
COPY --from=base /usr/local/LICENSE /licenses/node/LICENSE
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./
USER 65532:65532
CMD ["/usr/local/bin/node", "dist/server.js"]
