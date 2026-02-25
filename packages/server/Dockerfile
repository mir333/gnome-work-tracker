FROM oven/bun:alpine AS base
WORKDIR /app

RUN apk add --no-cache curl

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

# Copy prisma schema and generate client
COPY prisma ./prisma
RUN bunx --bun prisma generate

# Copy source
COPY src ./src
COPY tsconfig.json ./

# Create non-root user and data directory for SQLite
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser && \
    mkdir -p /data && chown appuser:appgroup /data

ENV DATABASE_URL="file:/data/work-tracker.db"
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

USER appuser

# Run migrations then start
CMD ["sh", "-c", "bunx --bun prisma migrate deploy && bun run src/index.ts"]
