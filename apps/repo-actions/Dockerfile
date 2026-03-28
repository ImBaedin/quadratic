FROM oven/bun:1.3.9

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json bun.lock /app/
COPY apps/repo-actions/package.json /app/apps/repo-actions/package.json
COPY packages/agent-runtime/package.json /app/packages/agent-runtime/package.json
COPY packages/config/package.json /app/packages/config/package.json
COPY tsconfig.json /app/tsconfig.json
COPY packages/config /app/packages/config
COPY packages/agent-runtime /app/packages/agent-runtime
COPY apps/repo-actions /app/apps/repo-actions

RUN bun install --frozen-lockfile

WORKDIR /app/apps/repo-actions
ENV PORT=8080

CMD ["bun", "run", "src/index.ts"]
