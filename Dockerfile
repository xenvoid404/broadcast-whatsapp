FROM node:22-slim
WORKDIR /usr/src/app
COPY package*.json ./
COPY pnpm*.yaml ./
RUN apt-get update && apt-get install -y --no-install-recommends \
git \
python3 \
make \
g++ \ && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm
RUN pnpm install
COPY . .
ENV NODE_ENV=production

CMD ["node", "app.js"]