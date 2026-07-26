package query

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	"golang.org/x/sync/singleflight"

	"github.com/flooks/flooks/internal/domain"
)

type Connector interface {
	Kind() string
	ValidateManifest(domain.DatasetManifest) error
	Execute(context.Context, domain.DatasetManifest, domain.QuerySpec) (domain.QueryResult, error)
}

type Service struct {
	manifests  map[string]domain.DatasetManifest
	connectors map[string]Connector
	cache      *redis.Client
	group      singleflight.Group
}

func NewService(manifests []domain.DatasetManifest, connectors []Connector, cache *redis.Client) (*Service, error) {
	service := &Service{manifests: map[string]domain.DatasetManifest{}, connectors: map[string]Connector{}, cache: cache}
	for _, connector := range connectors {
		service.connectors[connector.Kind()] = connector
	}
	for _, manifest := range manifests {
		connector, ok := service.connectors[manifest.Connector]
		if !ok {
			return nil, fmt.Errorf("dataset %s uses unregistered connector %s", manifest.Key, manifest.Connector)
		}
		if err := connector.ValidateManifest(manifest); err != nil {
			return nil, fmt.Errorf("dataset %s: %w", manifest.Key, err)
		}
		service.manifests[manifest.Key] = manifest
	}
	return service, nil
}

func (s *Service) Manifests() []domain.DatasetManifest {
	result := make([]domain.DatasetManifest, 0, len(s.manifests))
	for _, manifest := range s.manifests {
		result = append(result, manifest)
	}
	slices.SortFunc(result, func(a, b domain.DatasetManifest) int { return strings.Compare(a.Key, b.Key) })
	return result
}

func (s *Service) Manifest(key string) (domain.DatasetManifest, bool) {
	manifest, ok := s.manifests[key]
	return manifest, ok
}

func (s *Service) Validate(spec domain.QuerySpec) (domain.QuerySpec, domain.DatasetManifest, error) {
	manifest, ok := s.manifests[spec.DatasetKey]
	if !ok {
		return spec, manifest, fmt.Errorf("datasetKey: unknown dataset %q", spec.DatasetKey)
	}
	if _, _, err := spec.Dates(); err != nil {
		return spec, manifest, err
	}
	if len(spec.Dimensions) == 0 && len(spec.Metrics) == 0 {
		return spec, manifest, errors.New("at least one dimension or metric is required")
	}
	for _, key := range spec.Dimensions {
		if _, ok := manifest.Dimension(key); !ok {
			return spec, manifest, fmt.Errorf("dimensions: unknown field %q", key)
		}
	}
	for _, key := range spec.Metrics {
		if _, ok := manifest.Metric(key); !ok {
			return spec, manifest, fmt.Errorf("metrics: unknown metric %q", key)
		}
	}
	for _, filter := range spec.Filters {
		field, ok := manifest.Dimension(filter.Field)
		if !ok {
			return spec, manifest, fmt.Errorf("filters: unknown field %q", filter.Field)
		}
		if !slices.Contains(field.FilterOperators, filter.Op) {
			return spec, manifest, fmt.Errorf("filters: operator %q is not allowed for %q", filter.Op, filter.Field)
		}
	}
	for _, sort := range spec.Sort {
		if sort.Direction != "asc" && sort.Direction != "desc" {
			return spec, manifest, fmt.Errorf("sort: invalid direction %q", sort.Direction)
		}
		if _, dimension := manifest.Dimension(sort.Field); !dimension {
			if _, metric := manifest.Metric(sort.Field); !metric {
				return spec, manifest, fmt.Errorf("sort: unknown field %q", sort.Field)
			}
		}
	}
	if spec.Limit <= 0 {
		spec.Limit = manifest.Limits.DefaultRows
	}
	if spec.Limit > manifest.Limits.MaxRows {
		spec.Limit = manifest.Limits.MaxRows
	}
	if spec.Offset < 0 {
		return spec, manifest, errors.New("offset must be non-negative")
	}
	return spec, manifest, nil
}

func (s *Service) Execute(ctx context.Context, spec domain.QuerySpec, refresh bool) (domain.QueryResult, error) {
	normalized, manifest, err := s.Validate(spec)
	if err != nil {
		return domain.QueryResult{}, err
	}
	key, err := normalized.CacheKey(manifest.Version, manifest.Connector)
	if err != nil {
		return domain.QueryResult{}, err
	}
	if !refresh && s.cache != nil {
		if payload, err := s.cache.Get(ctx, key).Bytes(); err == nil {
			var result domain.QueryResult
			if json.Unmarshal(payload, &result) == nil {
				result.Cached = true
				return result, nil
			}
		}
	}
	value, err, _ := s.group.Do(key, func() (any, error) {
		timeout := time.Duration(manifest.Limits.TimeoutSeconds) * time.Second
		queryCtx, cancel := context.WithTimeout(ctx, timeout)
		defer cancel()
		result, err := s.connectors[manifest.Connector].Execute(queryCtx, manifest, normalized)
		if err != nil {
			return domain.QueryResult{}, err
		}
		if s.cache != nil {
			if payload, encodeErr := json.Marshal(result); encodeErr == nil {
				_ = s.cache.Set(ctx, key, payload, time.Duration(manifest.Cache.TTLSeconds)*time.Second).Err()
			}
		}
		return result, nil
	})
	if err != nil {
		return domain.QueryResult{}, err
	}
	return value.(domain.QueryResult), nil
}
