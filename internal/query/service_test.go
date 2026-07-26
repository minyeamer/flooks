package query

import (
	"context"
	"testing"

	"github.com/flooks/flooks/internal/domain"
)

type fakeConnector struct{}

func (fakeConnector) Kind() string                                  { return "fake" }
func (fakeConnector) ValidateManifest(domain.DatasetManifest) error { return nil }
func (fakeConnector) Execute(context.Context, domain.DatasetManifest, domain.QuerySpec) (domain.QueryResult, error) {
	return domain.QueryResult{}, nil
}

func TestValidateEnforcesManifestAndLimit(t *testing.T) {
	manifest := domain.DatasetManifest{
		Version: 1, Key: "ads", Connector: "fake",
		Dimensions: []domain.Dimension{{Key: "ymd", FilterOperators: []string{"between"}}},
		Metrics:    []domain.Metric{{Key: "cost"}},
		Limits:     domain.LimitPolicy{DefaultRows: 100, MaxRows: 500},
	}
	service, err := NewService([]domain.DatasetManifest{manifest}, []Connector{fakeConnector{}}, nil)
	if err != nil {
		t.Fatal(err)
	}
	spec, _, err := service.Validate(domain.QuerySpec{
		DatasetKey: "ads", TimeRange: domain.TimeRange{Start: "2026-07-01", End: "2026-07-25"},
		Metrics: []string{"cost"}, Limit: 900,
	})
	if err != nil {
		t.Fatal(err)
	}
	if spec.Limit != 500 {
		t.Fatalf("limit = %d, want 500", spec.Limit)
	}
}

func TestValidateRejectsUnknownField(t *testing.T) {
	manifest := domain.DatasetManifest{Version: 1, Key: "ads", Connector: "fake", Metrics: []domain.Metric{{Key: "cost"}}, Limits: domain.LimitPolicy{DefaultRows: 100, MaxRows: 500}}
	service, _ := NewService([]domain.DatasetManifest{manifest}, []Connector{fakeConnector{}}, nil)
	_, _, err := service.Validate(domain.QuerySpec{DatasetKey: "ads", TimeRange: domain.TimeRange{Start: "2026-07-01", End: "2026-07-25"}, Metrics: []string{"secret"}})
	if err == nil {
		t.Fatal("expected unknown metric to fail")
	}
}
