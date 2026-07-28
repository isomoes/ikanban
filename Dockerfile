FROM --platform=$BUILDPLATFORM oven/bun:1.3.10-alpine AS build

WORKDIR /app

COPY package.json bun.lock ./
COPY packages/web/package.json packages/web/package.json
RUN bun install --frozen-lockfile --ignore-scripts

COPY packages/web packages/web
RUN VITE_BASE_PATH=/ikanban/ bun run build:web

FROM oven/bun:1.3.10-alpine AS runtime

WORKDIR /app/packages/web

ENV OPENCODE_URL=http://host.docker.internal:4097

COPY --from=build --chown=bun:bun /app/packages/web/bin ./bin
COPY --from=build --chown=bun:bun /app/packages/web/dist ./dist

USER bun
EXPOSE 3000

CMD ["bun", "bin/cli.js"]
