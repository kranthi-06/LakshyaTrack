# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# LakshyaTrack Sandbox — Hardened Code Execution Container
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#
# SECURITY PROPERTIES:
#   - Runs as non-root (uid=65534)
#   - Read-only root filesystem (mounted at runtime)
#   - No network access (--network=none at runtime)
#   - All capabilities dropped (--cap-drop=ALL at runtime)
#   - No privilege escalation (--security-opt=no-new-privileges)
#   - Minimal attack surface (slim base, no build tools)
#   - No package manager in final image
#   - Ephemeral: destroyed after each execution
#
FROM python:3.11-slim AS base

# Install Node.js for JavaScript execution support
RUN apt-get update && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/* && \
    # Remove package manager to reduce attack surface
    rm -rf /var/cache/apt /etc/apt/sources.list*

# Create non-root sandbox user with no login shell and no home directory
RUN groupadd -g 65534 sandbox && \
    useradd -u 65534 -g sandbox -M -d /nonexistent -s /usr/sbin/nologin sandbox

# Create working directories
RUN mkdir -p /sandbox /tmp/code && \
    chown sandbox:sandbox /tmp/code && \
    chmod 700 /tmp/code

# Copy the execution wrapper script
COPY executor.py /sandbox/executor.py
RUN chmod 444 /sandbox/executor.py && \
    chown root:root /sandbox/executor.py

# Remove potentially dangerous binaries
RUN rm -f /usr/bin/wget /usr/bin/curl /usr/bin/nc /usr/bin/ncat \
          /usr/bin/apt /usr/bin/apt-get /usr/bin/dpkg 2>/dev/null; true

# Switch to sandbox user
USER sandbox

# Working directory is the writable temp area
WORKDIR /tmp/code

# No CMD — the controller passes the command at runtime
ENTRYPOINT ["python3", "/sandbox/executor.py"]
