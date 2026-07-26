package postgres

import (
	"strings"
	"testing"

	"github.com/flooks/flooks/internal/domain"
)

func TestCompileUsesBoundValuesAndAllowlistedIdentifiers(t *testing.T) {
	manifest := testManifest()
	spec := domain.QuerySpec{
		DatasetKey: "ads_daily",
		TimeRange:  domain.TimeRange{Start: "2026-07-01", End: "2026-07-25"},
		Dimensions: []string{"platform_name"},
		Metrics:    []string{"ad_cost", "roas"},
		Filters:    []domain.Filter{{Field: "platform_name", Op: "eq", Value: "네이버' OR 1=1 --"}},
		Sort:       []domain.Sort{{Field: "ad_cost", Direction: "desc"}},
		Limit:      100,
	}
	sql, args, err := Compile(manifest, spec)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(sql, "OR 1=1") {
		t.Fatalf("user value leaked into SQL: %s", sql)
	}
	if !strings.Contains(sql, `"analytics"."adreport_daily"($1::date, $2::date)`) {
		t.Fatalf("qualified function was not safely quoted: %s", sql)
	}
	if got := args[2]; got != spec.Filters[0].Value {
		t.Fatalf("filter argument = %v", got)
	}
}

func TestIdentifierRejectsInjection(t *testing.T) {
	if _, err := identifier(`analytics.adreport_daily;DROP TABLE assets`); err == nil {
		t.Fatal("expected unsafe identifier to fail")
	}
}

func testManifest() domain.DatasetManifest {
	return domain.DatasetManifest{
		Version:   1,
		Key:       "ads_daily",
		Connector: "analytics-postgres",
		Source:    domain.Source{Kind: "table_function", Identifier: "analytics.adreport_daily"},
		Dimensions: []domain.Dimension{{
			Key: "platform_name", Column: "platform_name", FilterOperators: []string{"eq", "in"},
		}},
		Metrics: []domain.Metric{
			{Key: "ad_cost", Type: "sum", Column: "ad_cost"},
			{Key: "conv_amount", Type: "sum", Column: "conv_amount"},
			{Key: "roas", Type: "ratio", Numerator: "conv_amount", Denominator: "ad_cost"},
		},
		Limits: domain.LimitPolicy{DefaultRows: 100, MaxRows: 500, TimeoutSeconds: 15},
	}
}
