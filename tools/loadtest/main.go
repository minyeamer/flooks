package main

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"slices"
	"sync"
	"time"
)

func main() {
	base := "http://127.0.0.1:5741"
	if value := os.Getenv("FLOOKS_BASE_URL"); value != "" {
		base = value
	}
	client := &http.Client{Timeout: 10 * time.Second}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	streams := make([]io.ReadCloser, 0, 50)
	for range 50 {
		request, _ := http.NewRequestWithContext(ctx, http.MethodGet, base+"/api/v1/events", nil)
		response, err := client.Do(request)
		if err != nil || response.StatusCode != http.StatusOK {
			panic(fmt.Sprintf("SSE connection failed: %v", err))
		}
		streams = append(streams, response.Body)
	}
	defer func() {
		for _, stream := range streams {
			stream.Close()
		}
	}()

	body := []byte(`{"datasetKey":"ads_daily","timeRange":{"start":"2026-07-01","end":"2026-07-25"},"dimensions":["platform_name"],"metrics":["ad_cost","conv_amount","roas"],"limit":10}`)
	var durations []time.Duration
	var failures int
	var mu sync.Mutex
	var wg sync.WaitGroup
	guard := make(chan struct{}, 10)
	for range 50 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			guard <- struct{}{}
			defer func() { <-guard }()
			start := time.Now()
			response, err := client.Post(base+"/api/v1/query/execute", "application/json", bytes.NewReader(body))
			duration := time.Since(start)
			mu.Lock()
			defer mu.Unlock()
			if err != nil || response.StatusCode != http.StatusOK {
				failures++
				return
			}
			response.Body.Close()
			durations = append(durations, duration)
		}()
	}
	wg.Wait()
	slices.Sort(durations)
	p95 := durations[len(durations)*95/100]
	fmt.Printf("sse=%d requests=%d failures=%d p95=%s\n", len(streams), len(durations), failures, p95)
	if failures > 0 || p95 > 500*time.Millisecond {
		os.Exit(1)
	}
}
