# Digital Menu - AletCloud Deployment
# Build: v4

FROM node:22-slim AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

COPY frontend/ ./
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app

COPY backend/package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY backend/ ./

COPY --from=frontend-builder /app/frontend/dist ./frontend/dist
COPY --from=frontend-builder /app/frontend/dist /frontend/dist
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]
