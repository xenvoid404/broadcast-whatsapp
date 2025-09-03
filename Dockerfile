FROM node:22-slim
WORKDIR /usr/src/app
RUN apk add --no-cache git python3 make g++
COPY package*.json ./ 
COPY pnpm*.yaml ./
RUN npm install -g pnpm
RUN pnpm install
COPY . .
ENV NODE_ENV=production

CMD ["node", "app.js"]