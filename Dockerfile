FROM node:22
workdir /app
COPY package*.json ./
COPY pnpm*.yaml ./
RUN npm install -g pnpm
RUN pnpm install
COPY . .

CMD ["pnpm", "start"]