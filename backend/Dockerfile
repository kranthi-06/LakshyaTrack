# ─── Stage 1: Dependencies ───────────────────────────────────
FROM python:3.11-slim AS deps

WORKDIR /app

# System deps required for psycopg2-binary, argon2-cffi, etc.
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev tini && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ─── Stage 2: Production image ───────────────────────────────
FROM python:3.11-slim AS production

# Security: run as non-root
RUN groupadd -r appuser && useradd -r -g appuser -d /app -s /sbin/nologin appuser

# Runtime deps only (no gcc)
RUN apt-get update && \
    apt-get install -y --no-install-recommends libpq5 tini curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy installed packages from deps stage
COPY --from=deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin

# Copy application code
COPY . .

# Set ownership
RUN chown -R appuser:appuser /app

USER appuser

# Environment defaults (override at deploy time)
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

EXPOSE ${PORT}

# Container health check for orchestrators (K8s, ECS, Docker Swarm)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -sf http://localhost:${PORT}/health/live || exit 1

# Use tini for proper signal handling (PID 1 zombie reaping)
ENTRYPOINT ["tini", "--"]
CMD ["gunicorn", "-c", "gunicorn_conf.py", "app.main:app"]
