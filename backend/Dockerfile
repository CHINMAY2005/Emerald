# Stage 1: Build & Dependencies
FROM node:20-alpine AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci

# Stage 2: Production Runner
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /usr/src/app

# Copy production packages & codebase
COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/

# Run the app as a non-root user
USER node

EXPOSE 3000

CMD ["node", "src/index.js"]
