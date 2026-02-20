FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

# Copy prisma schema and generate client
COPY prisma ./prisma
RUN bunx --bun prisma generate

# Copy source
COPY src ./src
COPY tsconfig.json ./

# Create data directory for SQLite
RUN mkdir -p /data

ENV DATABASE_URL="file:/data/work-tracker.db"
ENV PORT=3000

EXPOSE 3000

# Run migrations then start
CMD ["sh", "-c", "bunx --bun prisma migrate deploy && bun run src/index.ts"]
