# ─────────────────────────────────────────────
#  ADA-Chat — Dockerfile
#  Multi-stage build: keeps final image lean
# ─────────────────────────────────────────────

# ── Stage 1: Install dependencies ──────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy only package files first (better layer caching)
COPY package.json package-lock.json ./

# Install production dependencies only
RUN npm ci --omit=dev


# ── Stage 2: Final runtime image ───────────────
FROM node:20-alpine AS runner

# Security: run as non-root user
RUN addgroup -S adagroup && adduser -S adauser -G adagroup

WORKDIR /app

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy all application source files
COPY . .

# Give ownership of the app folder to our non-root user
RUN chown -R adauser:adagroup /app

USER adauser

# Expose the application port
EXPOSE 3000

# Health check — hits the login page every 30s
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/login || exit 1

# Start the server (using node directly, not nodemon, in production)
CMD ["node", "server.js"]
