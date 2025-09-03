FROM node:22-slim
RUN corepack enable
WORKDIR /usr/src/app
RUN apt-get update && apt-get install -y --no-install-recommends git python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/*
COPY . .
ENV NODE_ENV=production

CMD ["node", "app.js"]