# Stage 1: Build
FROM node:22-alpine AS build

WORKDIR /usr/src/app

# Install git & build tools
RUN apk add --no-cache git python3 make g++

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install && pnpm approve-builds --prod

# Copy application code
COPY . .

# Stage 2: Production
FROM node:22-alpine

WORKDIR /usr/src/app

# Copy only what we need from build
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app ./

# Set environment variables
ENV NODE_ENV=production

# Expose port (if needed)
# EXPOSE 3000

CMD ["node", "app.js"]