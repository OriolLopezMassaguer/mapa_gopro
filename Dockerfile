# ── Stage 1: build the React client ──────────────────────────────────────────
FROM node:20-alpine AS client-builder
WORKDIR /app
COPY client/package*.json ./client/
RUN npm ci --prefix client
COPY client/ ./client/
RUN npm run build --prefix client

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Server production dependencies only
COPY server/package*.json ./server/
RUN npm ci --omit=dev --prefix server

# Application files
COPY server/       ./server/
COPY passes/       ./passes/
COPY scanner-exclude.json ./
COPY --from=client-builder /app/client/dist ./client/dist

ENV NODE_ENV=production
ENV PORT=3001
ENV MEDIA_SUBDIR=media

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s \
  CMD wget -qO- http://localhost:3001/api/passes || exit 1

CMD ["node", "server/src/index.js"]
