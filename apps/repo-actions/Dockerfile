FROM oven/bun:1.3.9

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json bun.lock tsconfig.json /app/
COPY apps/repo-actions/package.json apps/repo-actions/tsconfig.json /app/apps/repo-actions/
COPY apps/web/package.json /app/apps/web/
COPY packages/agent-runtime/package.json packages/agent-runtime/tsconfig.json /app/packages/agent-runtime/
COPY packages/backend/package.json /app/packages/backend/
COPY packages/config/package.json packages/config/tsconfig.base.json /app/packages/config/
COPY packages/env/package.json /app/packages/env/
COPY packages/github/package.json /app/packages/github/
COPY packages/infra/package.json /app/packages/infra/
COPY packages/ui/package.json /app/packages/ui/
COPY packages/workos/package.json /app/packages/workos/

RUN bun install --frozen-lockfile

COPY apps/repo-actions/src /app/apps/repo-actions/src
COPY packages/agent-runtime/src /app/packages/agent-runtime/src

ENV PORT=8080

WORKDIR /app/apps/repo-actions

CMD ["bun", "run", "src/index.ts"]
