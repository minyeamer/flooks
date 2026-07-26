package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"github.com/flooks/flooks/internal/assets"
	"github.com/flooks/flooks/internal/domain"
	"github.com/flooks/flooks/internal/query"
)

type Server struct {
	metadata                    *pgxpool.Pool
	analyticsDatasource         *pgxpool.Pool
	redis                       *redis.Client
	assets                      *assets.Store
	query                       *query.Service
	checkDependencyAvailability func(context.Context) (error, error, error)
}

func New(metadata, analyticsDatasource *pgxpool.Pool, redisClient *redis.Client, assetStore *assets.Store, queryService *query.Service) http.Handler {
	server := &Server{
		metadata:            metadata,
		analyticsDatasource: analyticsDatasource,
		redis:               redisClient,
		assets:              assetStore,
		query:               queryService,
	}
	server.checkDependencyAvailability = func(ctx context.Context) (error, error, error) {
		metadataErr := metadata.Ping(ctx)
		redisErr := redisClient.Ping(ctx).Err()
		var analyticsErr error
		if analyticsDatasource == nil {
			analyticsErr = errors.New("analytics datasource unavailable")
		} else {
			analyticsErr = analyticsDatasource.Ping(ctx)
		}
		return metadataErr, redisErr, analyticsErr
	}
	router := chi.NewRouter()
	router.Use(middleware.RequestID, middleware.RealIP, middleware.Recoverer, server.logging)
	router.Route("/api/v1", func(r chi.Router) {
		r.Get("/health/live", func(w http.ResponseWriter, _ *http.Request) { writeJSON(w, 200, map[string]string{"status": "ok"}) })
		r.Get("/health/ready", server.ready)
		r.Get("/system/status", server.status)
		r.Get("/datasets", server.datasets)
		r.Get("/datasets/{key}", server.dataset)
		r.Post("/query/validate", server.validateQuery)
		r.Post("/query/execute", server.executeQuery)
		r.Get("/events", server.events)
		r.Route("/assets/{kind}", func(r chi.Router) {
			r.Get("/", server.listAssets)
			r.Post("/", server.createAsset)
			r.Route("/{id}", func(r chi.Router) {
				r.Get("/", server.getAsset)
				r.Put("/", server.updateAsset)
				r.Delete("/", server.archiveAsset)
				r.Get("/revisions", server.listRevisions)
				r.Get("/revisions/{revision}", server.getRevision)
				r.Post("/revisions/{revision}/restore", server.restoreRevision)
				r.Get("/export", server.getAsset)
			})
		})
	})
	return router
}

func (s *Server) ready(w http.ResponseWriter, r *http.Request) {
	if err := s.metadata.Ping(r.Context()); err != nil {
		problem(w, 503, "metadata unavailable", err.Error())
		return
	}
	if err := s.redis.Ping(r.Context()).Err(); err != nil {
		problem(w, 503, "redis unavailable", err.Error())
		return
	}
	writeJSON(w, 200, map[string]string{"status": "ready"})
}

func (s *Server) status(w http.ResponseWriter, r *http.Request) {
	status := map[string]string{"metadata": "ok", "redis": "ok", "analyticsDatasource": "ok"}
	metadataErr, redisErr, analyticsErr := s.checkDependencyAvailability(r.Context())
	if metadataErr != nil {
		status["metadata"] = "down"
	}
	if redisErr != nil {
		status["redis"] = "down"
	}
	if analyticsErr != nil {
		status["analyticsDatasource"] = "degraded"
	}
	writeJSON(w, 200, map[string]any{"service": "flooks-api", "version": "0.1.0", "principal": "anonymous", "capabilities": []string{"view", "edit", "refresh"}, "dependencies": status})
}

func (s *Server) datasets(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, 200, s.query.Manifests())
}
func (s *Server) dataset(w http.ResponseWriter, r *http.Request) {
	item, ok := s.query.Manifest(chi.URLParam(r, "key"))
	if !ok {
		problem(w, 404, "dataset not found", "")
		return
	}
	writeJSON(w, 200, item)
}

func (s *Server) validateQuery(w http.ResponseWriter, r *http.Request) {
	var spec domain.QuerySpec
	if !decode(w, r, &spec) {
		return
	}
	normalized, manifest, err := s.query.Validate(spec)
	if err != nil {
		problem(w, 422, "invalid query", err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"valid": true, "normalizedSpec": normalized, "dataset": manifest.Key})
}

func (s *Server) executeQuery(w http.ResponseWriter, r *http.Request) {
	var spec domain.QuerySpec
	if !decode(w, r, &spec) {
		return
	}
	result, err := s.query.Execute(r.Context(), spec, r.URL.Query().Get("refresh") == "true")
	if err != nil {
		problem(w, 422, "query failed", err.Error())
		return
	}
	writeJSON(w, 200, result)
}

type assetWrite struct {
	Slug     string          `json:"slug"`
	Title    string          `json:"title"`
	Summary  string          `json:"summary"`
	Document json.RawMessage `json:"document"`
}

func (s *Server) listAssets(w http.ResponseWriter, r *http.Request) {
	items, err := s.assets.List(r.Context(), singularKind(chi.URLParam(r, "kind")))
	if err != nil {
		problem(w, 500, "list failed", err.Error())
		return
	}
	writeJSON(w, 200, items)
}

func (s *Server) createAsset(w http.ResponseWriter, r *http.Request) {
	var body assetWrite
	if !decode(w, r, &body) || !validDocument(w, singularKind(chi.URLParam(r, "kind")), body.Document) {
		return
	}
	item, err := s.assets.Create(r.Context(), singularKind(chi.URLParam(r, "kind")), body.Slug, body.Title, body.Summary, body.Document)
	if err != nil {
		problem(w, 409, "create failed", err.Error())
		return
	}
	w.Header().Set("ETag", fmt.Sprintf(`"%d"`, item.LatestRevision))
	writeJSON(w, 201, item)
}

func (s *Server) getAsset(w http.ResponseWriter, r *http.Request) {
	id, ok := assetID(w, r)
	if !ok {
		return
	}
	revision, _ := strconv.Atoi(chi.URLParam(r, "revision"))
	item, err := s.assets.Get(r.Context(), id, revision)
	if errors.Is(err, pgx.ErrNoRows) {
		problem(w, 404, "asset not found", "")
		return
	}
	if err != nil {
		problem(w, 500, "read failed", err.Error())
		return
	}
	w.Header().Set("ETag", fmt.Sprintf(`"%d"`, item.LatestRevision))
	writeJSON(w, 200, item)
}

func (s *Server) updateAsset(w http.ResponseWriter, r *http.Request) {
	id, ok := assetID(w, r)
	if !ok {
		return
	}
	base, ok := etag(w, r)
	if !ok {
		return
	}
	var body assetWrite
	if !decode(w, r, &body) || !validDocument(w, singularKind(chi.URLParam(r, "kind")), body.Document) {
		return
	}
	item, err := s.assets.Update(r.Context(), id, base, body.Title, body.Summary, body.Document)
	if errors.Is(err, assets.ErrConflict) {
		problem(w, 412, "revision conflict", "다른 사용자가 먼저 저장했습니다")
		return
	}
	if err != nil {
		problem(w, 500, "update failed", err.Error())
		return
	}
	w.Header().Set("ETag", fmt.Sprintf(`"%d"`, item.LatestRevision))
	writeJSON(w, 200, item)
}

func (s *Server) archiveAsset(w http.ResponseWriter, r *http.Request) {
	id, ok := assetID(w, r)
	if !ok {
		return
	}
	if err := s.assets.Archive(r.Context(), id); err != nil {
		problem(w, 500, "archive failed", err.Error())
		return
	}
	w.WriteHeader(204)
}

func (s *Server) listRevisions(w http.ResponseWriter, r *http.Request) {
	id, ok := assetID(w, r)
	if !ok {
		return
	}
	items, err := s.assets.Revisions(r.Context(), id)
	if err != nil {
		problem(w, 500, "revision list failed", err.Error())
		return
	}
	writeJSON(w, 200, items)
}

func (s *Server) getRevision(w http.ResponseWriter, r *http.Request) { s.getAsset(w, r) }

func (s *Server) restoreRevision(w http.ResponseWriter, r *http.Request) {
	id, ok := assetID(w, r)
	if !ok {
		return
	}
	base, ok := etag(w, r)
	if !ok {
		return
	}
	source, err := strconv.Atoi(chi.URLParam(r, "revision"))
	if err != nil {
		problem(w, 400, "invalid revision", "")
		return
	}
	item, err := s.assets.Restore(r.Context(), id, source, base)
	if errors.Is(err, assets.ErrConflict) {
		problem(w, 412, "revision conflict", "")
		return
	}
	if err != nil {
		problem(w, 500, "restore failed", err.Error())
		return
	}
	w.Header().Set("ETag", fmt.Sprintf(`"%d"`, item.LatestRevision))
	writeJSON(w, 200, item)
}

func (s *Server) events(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		problem(w, 500, "streaming unavailable", "")
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Accel-Buffering", "no")
	subscription := s.redis.Subscribe(r.Context(), "flooks:asset-events")
	defer subscription.Close()
	fmt.Fprint(w, ": connected\n\n")
	flusher.Flush()
	for {
		select {
		case <-r.Context().Done():
			return
		case message, open := <-subscription.Channel():
			if !open {
				return
			}
			fmt.Fprintf(w, "event: asset\ndata: %s\n\n", message.Payload)
			flusher.Flush()
		}
	}
}

func (s *Server) logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		slog.Info("request", "method", r.Method, "path", r.URL.Path, "request_id", middleware.GetReqID(r.Context()), "duration_ms", time.Since(start).Milliseconds())
	})
}

func validDocument(w http.ResponseWriter, kind string, payload json.RawMessage) bool {
	var document struct {
		APIVersion string `json:"apiVersion"`
		Kind       string `json:"kind"`
	}
	if json.Unmarshal(payload, &document) != nil || document.APIVersion != "flooks.io/v1alpha1" {
		problem(w, 422, "invalid document", "apiVersion must be flooks.io/v1alpha1")
		return false
	}
	expected := "Chart"
	if kind == "dashboard" {
		expected = "Dashboard"
	}
	if document.Kind != expected {
		problem(w, 422, "invalid document", "kind must be "+expected)
		return false
	}
	return true
}

func singularKind(kind string) string { return strings.TrimSuffix(kind, "s") }
func assetID(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		problem(w, 400, "invalid asset id", "")
		return uuid.Nil, false
	}
	return id, true
}
func etag(w http.ResponseWriter, r *http.Request) (int, bool) {
	value := strings.Trim(r.Header.Get("If-Match"), `"`)
	revision, err := strconv.Atoi(value)
	if err != nil || revision < 1 {
		problem(w, 428, "If-Match required", "현재 revision ETag를 제출하세요")
		return 0, false
	}
	return revision, true
}
func decode(w http.ResponseWriter, r *http.Request, target any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 2<<20)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		problem(w, 400, "invalid JSON", err.Error())
		return false
	}
	return true
}
func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
func problem(w http.ResponseWriter, status int, title, detail string) {
	writeJSON(w, status, map[string]any{"type": "about:blank", "title": title, "status": status, "detail": detail})
}

var _ = context.Canceled
