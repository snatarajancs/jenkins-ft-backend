# ============================================================
# Build stage
# ============================================================
FROM node:22-bookworm-slim AS build

WORKDIR /app

# Install dependencies first for better Docker layer caching
COPY package.json package-lock.json ./

RUN npm i

# Copy the complete project
COPY . .

# Build the application
RUN npm run build


# ============================================================
# Production dependencies
# ============================================================
FROM node:22-bookworm-slim AS production-deps

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm i --omit=dev \
    && npm cache clean --force


# ============================================================
# Production runtime
# ============================================================
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production

WORKDIR /app

# Minimal runtime dependency + non-root user
RUN apt-get update \
    && apt-get install -y --no-install-recommends dumb-init \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 nodeapp \
    && useradd --system --uid 1001 --gid nodeapp nodeapp

# Production dependencies only
COPY --from=production-deps \
    --chown=nodeapp:nodeapp \
    /app/node_modules ./node_modules

# Compiled application only
COPY --from=build \
    --chown=nodeapp:nodeapp \
    /app/dist ./dist

# Application metadata
COPY --chown=nodeapp:nodeapp \
    package.json ./

USER nodeapp

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "dist/main.js"]