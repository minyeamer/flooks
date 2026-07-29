.PHONY: generate fmt test build compose-config

generate:
	cd internal/openapi && GOMODCACHE=$${GOMODCACHE:-/tmp/flooks-go-mod} GOCACHE=$${GOCACHE:-/tmp/flooks-go-cache} go generate

fmt:
	gofmt -w cmd internal

test:
	GOMODCACHE=$${GOMODCACHE:-/tmp/flooks-go-mod} GOCACHE=$${GOCACHE:-/tmp/flooks-go-cache} go test ./...
	npm --prefix apps/web test

build:
	GOMODCACHE=$${GOMODCACHE:-/tmp/flooks-go-mod} GOCACHE=$${GOCACHE:-/tmp/flooks-go-cache} go build ./cmd/api ./cmd/migrate
	npm --prefix apps/web run build

compose-config:
	docker compose --env-file .env -p flooks -f deploy/compose/compose.yml config --quiet
	docker compose --env-file .env -p flooks -f deploy/compose/compose.yml -f deploy/compose/compose.dev.yml config --quiet
