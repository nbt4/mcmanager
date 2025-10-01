FROM node:20-alpine AS builder

# Install required packages for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Generate Prisma client with correct binary targets for Alpine
ENV PRISMA_ENGINES_MIRROR=https://binaries.prismaio.com
RUN npx prisma generate

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Install curl for health checks, OpenSSL for Prisma, OpenJDK for Minecraft servers, and util-linux for nsenter
RUN apk add --no-cache curl openssl openjdk21-jre util-linux

WORKDIR /app

# Copy built application and node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

# Create data directory
RUN mkdir -p /app/data

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

CMD ["node", "dist/main"]