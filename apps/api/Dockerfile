FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd ./cmd
COPY internal ./internal
RUN CGO_ENABLED=0 go build -o /out/api ./cmd/api && CGO_ENABLED=0 go build -o /out/migrate ./cmd/migrate

FROM golang:1.26-alpine AS dev
RUN go install github.com/air-verse/air@v1.64.5
WORKDIR /src
CMD ["air", "-c", ".air.toml"]

FROM alpine:3.22
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=build /out/api /app/api
COPY --from=build /out/migrate /app/migrate
COPY contracts/datasets /app/contracts/datasets
COPY db/migrations /app/db/migrations
USER 65532:65532
ENTRYPOINT ["/app/api"]
