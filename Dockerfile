# syntax=docker/dockerfile:1
#
# Two images from one build:
#   app    – the web app (Next.js standalone server + Chromium for PDFs)
#   tools  – one-off commands: migrate, setup, invite (see docker/tools.sh)
#
# Used by docker-compose.prod.yml; see README.md → "Auf einem Server installieren".

ARG NODE_IMAGE=node:24-bookworm-slim
ARG PLAYWRIGHT_VERSION=1.64.1

# ---------------------------------------------------------------- dependencies
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
# postinstall generates the Prisma client into src/generated. The Prisma
# config wants a database URL, which generating does not use.
RUN mkdir -p src \
    && DATABASE_URL=postgresql://build@build.invalid/build npm ci --no-audit --no-fund

# ---------------------------------------------------------------- build
FROM deps AS build
COPY . .
ENV NODE_ENV=production NEXT_OUTPUT=standalone NEXT_TELEMETRY_DISABLED=1
# The build imports server modules, which validate the environment. These
# placeholders exist only for this command; the real values come at runtime.
RUN APP_URL=https://build.invalid \
    DATABASE_URL=postgresql://build@build.invalid/build \
    AUTH_SECRET=placeholder-only-used-while-building-the-image-0123456789 \
    npm run build

# ---------------------------------------------------------------- tools
FROM build AS tools
ENV NEXT_OUTPUT=
RUN chmod +x docker/tools.sh
USER node
ENTRYPOINT ["/app/docker/tools.sh"]

# ---------------------------------------------------------------- app
FROM ${NODE_IMAGE} AS app
ARG PLAYWRIGHT_VERSION
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    STORAGE_DIR=/data/storage \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Headless Chromium and its system libraries for the PDF export.
RUN npx -y "playwright-core@${PLAYWRIGHT_VERSION}" install --with-deps --only-shell chromium \
    && rm -rf /var/lib/apt/lists/* /root/.npm \
    && mkdir -p /data/storage && chown -R node:node /data

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
# File tracing misses data files of playwright-core (browsers.json): copy the
# whole package, or every PDF export fails.
COPY --from=build --chown=node:node /app/node_modules/playwright-core ./node_modules/playwright-core
# Breached-password list for the password check (read at runtime).
COPY --from=build --chown=node:node /app/data/common-passwords.txt ./data/common-passwords.txt

USER node
EXPOSE 3000
VOLUME ["/data/storage"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
