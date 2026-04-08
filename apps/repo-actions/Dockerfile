FROM oven/bun:1.3.9

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json tsconfig.json /app/
COPY src /app/src

RUN bun install

ENV PORT=8080

CMD ["bun", "run", "src/index.ts"]
