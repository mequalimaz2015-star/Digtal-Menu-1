# Digital Menu SaaS — AletCloud Deployment
# Multi-stage: builds frontend then serves via Express backend

# ── Stage 1: Build frontend ──────────────────────────────────────────────────
FROM node:22-slim AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

COPY frontend/ ./
RUN npm run build

# ── Stage 2: Production runner ───────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app

# Install backend dependencies (production only)
COPY backend/package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Copy backend source
COPY backend/ ./

# Copy built frontend — Express will serve it as static files
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "server.js"]
