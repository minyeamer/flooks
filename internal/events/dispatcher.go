package events

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type Dispatcher struct {
	db    *pgxpool.Pool
	redis *redis.Client
}

func NewDispatcher(db *pgxpool.Pool, redisClient *redis.Client) *Dispatcher {
	return &Dispatcher{db: db, redis: redisClient}
}

func (d *Dispatcher) Run(ctx context.Context) {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			d.flush(ctx)
		}
	}
}

func (d *Dispatcher) flush(ctx context.Context) {
	rows, err := d.db.Query(ctx, `SELECT id,topic,payload FROM outbox_events WHERE published_at IS NULL ORDER BY id LIMIT 100`)
	if err != nil {
		slog.Warn("outbox query failed", "error", err)
		return
	}
	defer rows.Close()
	type event struct {
		id      int64
		topic   string
		payload json.RawMessage
	}
	var pending []event
	for rows.Next() {
		var item event
		if rows.Scan(&item.id, &item.topic, &item.payload) == nil {
			pending = append(pending, item)
		}
	}
	for _, item := range pending {
		if err := d.redis.Publish(ctx, item.topic, item.payload).Err(); err != nil {
			return
		}
		_, _ = d.db.Exec(ctx, `UPDATE outbox_events SET published_at=now() WHERE id=$1`, item.id)
	}
}
