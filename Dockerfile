FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN npm install --global pnpm@11.25.0
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:24-bookworm-slim
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data
WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node server ./server
COPY --chown=node:node data ./data
COPY --chown=node:node img ./img
COPY --chown=node:node thumbs ./thumbs
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 3000
CMD ["node", "server/server.mjs"]
