# Digital Menu SaaS — AletCloud Deployment
# Multi-stage: builds React frontend then serves it via Express backend

# ── Stage 1: Build frontend ───────────────────────────────────────────────────
FROM node:22-slim AS frontend-builder
WORKDIR /app/frontend

# Install deps first (cached layer)
COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund --prefer-offline

# Copy source and build
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Production runner ────────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app

# Install backend production dependencies only
COPY backend/package*.json ./
RUN npm install --omit=dev --no-audit --no-fund --prefer-offline

# Copy backend source files
COPY backend/ ./

# Copy the built frontend so Express can serve it as static files
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Production environment settings
ENV NODE_ENV=production
ENV PORT=3000
# Disable Node.js file watching features that exhaust inotify watchers
ENV NODE_OPTIONS="--max-old-space-size=512"
ENV CHOKIDAR_USEPOLLING=false
ENV CHOKIDAR_INTERVAL=0

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=15s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "--no-warnings", "server.js"]
