# Digital Menu SaaS — AletCloud Deployment
# Multi-stage: builds React frontend then serves it via Express backend

# ── Stage 1: Build frontend ───────────────────────────────────────────────────
FROM node:22-slim AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

COPY frontend/ ./
RUN npm run build

# ── Stage 2: Production runner ────────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app

# Install wget for health check (not in slim by default)
RUN apt-get update -qq && apt-get install -y --no-install-recommends wget && rm -rf /var/lib/apt/lists/*

# Install backend production dependencies only
COPY backend/package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Copy backend source
COPY backend/ ./

# Copy built frontend for Express static serving
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=15s --start-period=60s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
