# ── Stage 1: Build the React/Vite frontend ──────────────────────────
FROM node:22-slim AS frontend-builder
WORKDIR /app/frontend

# Install dependencies
COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

# Copy source and build
COPY frontend/ ./
RUN npm run build
# Output is in /app/frontend/dist

# ── Stage 2: Production Node.js backend ─────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Copy backend source
COPY backend/ ./

# Copy built frontend into the location the backend serves from
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# AletCloud injects PORT — backend reads it
ENV NODE_ENV=production
EXPOSE 8000

CMD ["node", "server.js"]
