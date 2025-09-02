# Stage 1: Build
FROM node:22-alpine AS build

WORKDIR /usr/src/app

# Install git & build tools
RUN apk add --no-cache git python3 make g++

# Install pnpm version specified in package.json
RUN npm install -g pnpm@8

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
# Build scripts are allowed in package.json
RUN pnpm install --prod

# Copy application code
COPY . .

# Stage 2: Production
FROM node:22-alpine

WORKDIR /usr/src/app

# Copy dependencies and application code from build stage
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/package.json ./
COPY --from=build /usr/src/app/app.js ./
COPY --from=build /usr/src/app/database ./database
COPY --from=build /usr/src/app/messages ./messages

# Set environment variables
ENV NODE_ENV=production

CMD ["node", "app.js"]