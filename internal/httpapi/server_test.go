package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http/httptest"
	"testing"
)

func TestSystemStatusReportsHealthyDependencies(t *testing.T) {
	server := &Server{
		checkDependencyAvailability: func(context.Context) (error, error, error) {
			return nil, nil, nil
		},
	}
	response := httptest.NewRecorder()
	server.status(response, httptest.NewRequest("GET", "/api/v1/system/status", nil))

	if response.Code != 200 {
		t.Fatalf("status = %d, want 200", response.Code)
	}
	var body struct {
		Dependencies map[string]string `json:"dependencies"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	want := map[string]string{"metadata": "ok", "redis": "ok", "analyticsDatasource": "ok"}
	assertDependencyStatus(t, body.Dependencies, want)
}

func TestSystemStatusDegradesAnalyticsDatasource(t *testing.T) {
	server := &Server{
		checkDependencyAvailability: func(context.Context) (error, error, error) {
			return nil, nil, errors.New("unavailable")
		},
	}
	response := httptest.NewRecorder()
	server.status(response, httptest.NewRequest("GET", "/api/v1/system/status", nil))

	var body struct {
		Dependencies map[string]string `json:"dependencies"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	want := map[string]string{"metadata": "ok", "redis": "ok", "analyticsDatasource": "degraded"}
	assertDependencyStatus(t, body.Dependencies, want)
}

func assertDependencyStatus(t *testing.T, got, want map[string]string) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("dependencies = %#v, want %#v", got, want)
	}
	for key, value := range want {
		if got[key] != value {
			t.Fatalf("dependencies[%q] = %q, want %q", key, got[key], value)
		}
	}
}
