# Stage 1: Build
FROM node:18-alpine AS build

WORKDIR /usr/src/app

# Install build tools needed for some packages
RUN apk add --no-cache python3 make g++

# Install pnpm
RUN npm install -g pnpm@8

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
# Using --unsafe-perm to allow build scripts to run
RUN pnpm install --prod --unsafe-perm

# Copy application code
COPY . .

# Stage 2: Production
FROM node:18-alpine

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