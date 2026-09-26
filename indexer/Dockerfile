# TrusTrove Go indexer container image.
#
# Build context is the repository root so the build shares the root
# .dockerignore with the rest of the workspace:
#
#   docker build -f indexer/Dockerfile -t trusttrove-indexer .
#
# The root .dockerignore excludes go.sum, so go mod download regenerates it
# inside the build stage before compiling. Runtime configuration is injected
# via environment variables (see ../../.env.docker.example).

# ---------- builder: compile the statically linked indexer binary ----------
FROM golang:1.25-alpine AS builder
WORKDIR /src
COPY indexer/go.mod ./
RUN go mod download
COPY indexer/ ./
RUN CGO_ENABLED=0 go build -trimpath -o /out/indexer .

# ---------- runner: minimal runtime image ----------
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=builder /out/indexer ./indexer
COPY indexer/db/migrations ./db/migrations

EXPOSE 8080

CMD ["./indexer"]