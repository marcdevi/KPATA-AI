# KPATA AI - Worker Service Dockerfile
FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace config
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY pnpm-lock.yaml ./

# Copy shared package
COPY packages/shared ./packages/shared

# Copy Worker service
COPY services/worker ./services/worker

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build shared package first
WORKDIR /app/packages/shared
RUN pnpm build

# Build Worker service
WORKDIR /app/services/worker
RUN pnpm build

# Production stage
FROM node:20-alpine AS production

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy built files
COPY --from=base /app/package.json ./
COPY --from=base /app/pnpm-workspace.yaml ./
COPY --from=base /app/pnpm-lock.yaml ./
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages/shared ./packages/shared
COPY --from=base /app/services/worker ./services/worker

WORKDIR /app/services/worker

CMD ["node", "dist/index.js"]
