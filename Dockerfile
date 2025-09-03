FROM node:22-slim
RUN corepack enable
RUN apt-get update && apt-get install -y --no-install-recommends --no-cache git python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /usr/src/app
COPY package*.json ./
COPY pnpm*.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY . .
ENV NODE_ENV=production

CMD ["node", "app.js"]