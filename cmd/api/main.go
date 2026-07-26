package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"github.com/flooks/flooks/internal/assets"
	pgconnector "github.com/flooks/flooks/internal/connector/postgres"
	"github.com/flooks/flooks/internal/events"
	"github.com/flooks/flooks/internal/httpapi"
	"github.com/flooks/flooks/internal/manifest"
	"github.com/flooks/flooks/internal/query"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	metadata := mustPool(ctx, required("METADATA_DATABASE_URL"), true)
	defer metadata.Close()
	analyticsPool := mustPool(ctx, required("ANALYTICS_DATABASE_URL"), false)
	defer analyticsPool.Close()
	cache := redis.NewClient(&redis.Options{Addr: env("REDIS_ADDR", "redis:6379")})
	defer cache.Close()

	manifests, err := manifest.LoadDirectory(env("DATASET_MANIFEST_DIR", "contracts/datasets"))
	if err != nil {
		slog.Error("manifest load failed", "error", err)
		os.Exit(1)
	}
	queryService, err := query.NewService(manifests, []query.Connector{pgconnector.New("analytics-postgres", analyticsPool, 10)}, cache)
	if err != nil {
		slog.Error("query service failed", "error", err)
		os.Exit(1)
	}
	go events.NewDispatcher(metadata, cache).Run(ctx)

	server := &http.Server{
		Addr:              env("HTTP_ADDR", ":5741"),
		Handler:           httpapi.New(metadata, analyticsPool, cache, assets.NewStore(metadata), queryService),
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	go func() {
		slog.Info("api listening", "address", server.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server failed", "error", err)
			stop()
		}
	}()
	<-ctx.Done()
	shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = server.Shutdown(shutdown)
}

func mustPool(ctx context.Context, dsn string, ping bool) *pgxpool.Pool {
	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		panic(err)
	}
	config.MaxConns = 10
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		panic(err)
	}
	if ping {
		if err := pool.Ping(ctx); err != nil {
			panic(err)
		}
	}
	return pool
}
func required(key string) string {
	value := os.Getenv(key)
	if value == "" {
		panic(key + " is required")
	}
	return value
}
func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
