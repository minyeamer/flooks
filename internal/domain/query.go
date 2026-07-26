package domain

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"time"
)

type TimeRange struct {
	Start string `json:"start"`
	End   string `json:"end"`
}

type Filter struct {
	Field string `json:"field"`
	Op    string `json:"op"`
	Value any    `json:"value,omitempty"`
}

type Sort struct {
	Field     string `json:"field"`
	Direction string `json:"direction"`
}

type QuerySpec struct {
	DatasetKey string    `json:"datasetKey"`
	TimeRange  TimeRange `json:"timeRange"`
	Dimensions []string  `json:"dimensions,omitempty"`
	Metrics    []string  `json:"metrics,omitempty"`
	Filters    []Filter  `json:"filters,omitempty"`
	Sort       []Sort    `json:"sort,omitempty"`
	Limit      int       `json:"limit,omitempty"`
	Offset     int       `json:"offset,omitempty"`
}

type Column struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

type QueryResult struct {
	Columns    []Column         `json:"columns"`
	Rows       []map[string]any `json:"rows"`
	RowCount   int              `json:"rowCount"`
	DurationMS int64            `json:"durationMs"`
	Cached     bool             `json:"cached"`
}

func (s QuerySpec) CacheKey(manifestVersion int, connector string) (string, error) {
	payload, err := json.Marshal(struct {
		Version   int       `json:"version"`
		Connector string    `json:"connector"`
		Spec      QuerySpec `json:"spec"`
	}{manifestVersion, connector, s})
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(payload)
	return fmt.Sprintf("flooks:query:%x", sum), nil
}

func (s QuerySpec) Dates() (time.Time, time.Time, error) {
	start, err := time.Parse(time.DateOnly, s.TimeRange.Start)
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("timeRange.start: %w", err)
	}
	end, err := time.Parse(time.DateOnly, s.TimeRange.End)
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("timeRange.end: %w", err)
	}
	if end.Before(start) {
		return time.Time{}, time.Time{}, fmt.Errorf("timeRange.end must not precede start")
	}
	return start, end, nil
}
