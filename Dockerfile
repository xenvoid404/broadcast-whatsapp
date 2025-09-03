FROM node:22
WORKDIR /usr/src/app
COPY package*.json ./ 
COPY pnpm*.yaml ./
RUN npm install -g pnpm
RUN pnpm install
COPY . .
ENV NODE_ENV=production

CMD ["node", "app.js"]