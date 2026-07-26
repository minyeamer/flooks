package assets

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrConflict = errors.New("revision conflict")

type Asset struct {
	ID             uuid.UUID       `json:"id"`
	Kind           string          `json:"kind"`
	Slug           string          `json:"slug"`
	Title          string          `json:"title"`
	LatestRevision int             `json:"latestRevision"`
	Archived       bool            `json:"archived"`
	Document       json.RawMessage `json:"document,omitempty"`
	CreatedAt      time.Time       `json:"createdAt"`
	UpdatedAt      time.Time       `json:"updatedAt"`
}

type Revision struct {
	Revision int             `json:"revision"`
	Document json.RawMessage `json:"document,omitempty"`
	Summary  string          `json:"summary"`
	Actor    string          `json:"actor"`
	Created  time.Time       `json:"createdAt"`
}

type Store struct {
	pool *pgxpool.Pool
}

func NewStore(pool *pgxpool.Pool) *Store { return &Store{pool: pool} }

func (s *Store) List(ctx context.Context, kind string) ([]Asset, error) {
	rows, err := s.pool.Query(ctx, `SELECT id, kind, slug, title, latest_revision, archived_at IS NOT NULL, created_at, updated_at FROM assets WHERE kind=$1 ORDER BY updated_at DESC`, kind)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []Asset{}
	for rows.Next() {
		var item Asset
		if err := rows.Scan(&item.ID, &item.Kind, &item.Slug, &item.Title, &item.LatestRevision, &item.Archived, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	return result, rows.Err()
}

func (s *Store) Get(ctx context.Context, id uuid.UUID, revision int) (Asset, error) {
	var item Asset
	query := `SELECT a.id, a.kind, a.slug, a.title, a.latest_revision, a.archived_at IS NOT NULL, r.document, a.created_at, a.updated_at
FROM assets a JOIN asset_revisions r ON r.asset_id=a.id AND r.revision=CASE WHEN $2=0 THEN a.latest_revision ELSE $2 END WHERE a.id=$1`
	err := s.pool.QueryRow(ctx, query, id, revision).Scan(&item.ID, &item.Kind, &item.Slug, &item.Title, &item.LatestRevision, &item.Archived, &item.Document, &item.CreatedAt, &item.UpdatedAt)
	return item, err
}

func (s *Store) Create(ctx context.Context, kind, slug, title, summary string, document json.RawMessage) (Asset, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Asset{}, err
	}
	defer tx.Rollback(ctx)
	var item Asset
	err = tx.QueryRow(ctx, `INSERT INTO assets(kind,slug,title) VALUES($1,$2,$3) RETURNING id,kind,slug,title,latest_revision,false,created_at,updated_at`, kind, slug, title).
		Scan(&item.ID, &item.Kind, &item.Slug, &item.Title, &item.LatestRevision, &item.Archived, &item.CreatedAt, &item.UpdatedAt)
	if err != nil {
		return Asset{}, err
	}
	if err := insertRevision(ctx, tx, item.ID, 1, summary, document); err != nil {
		return Asset{}, err
	}
	if err := insertEvent(ctx, tx, item, "created"); err != nil {
		return Asset{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Asset{}, err
	}
	item.Document = document
	return item, nil
}

func (s *Store) Update(ctx context.Context, id uuid.UUID, base int, title, summary string, document json.RawMessage) (Asset, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Asset{}, err
	}
	defer tx.Rollback(ctx)
	var item Asset
	err = tx.QueryRow(ctx, `UPDATE assets SET title=$3, latest_revision=latest_revision+1, updated_at=now()
WHERE id=$1 AND latest_revision=$2
RETURNING id,kind,slug,title,latest_revision,archived_at IS NOT NULL,created_at,updated_at`, id, base, title).
		Scan(&item.ID, &item.Kind, &item.Slug, &item.Title, &item.LatestRevision, &item.Archived, &item.CreatedAt, &item.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return Asset{}, ErrConflict
	}
	if err != nil {
		return Asset{}, err
	}
	if err := insertRevision(ctx, tx, id, item.LatestRevision, summary, document); err != nil {
		return Asset{}, err
	}
	if err := insertEvent(ctx, tx, item, "updated"); err != nil {
		return Asset{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Asset{}, err
	}
	item.Document = document
	return item, nil
}

func (s *Store) Archive(ctx context.Context, id uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `UPDATE assets SET archived_at=COALESCE(archived_at,now()), updated_at=now() WHERE id=$1`, id)
	return err
}

func (s *Store) Revisions(ctx context.Context, id uuid.UUID) ([]Revision, error) {
	rows, err := s.pool.Query(ctx, `SELECT revision,summary,actor,created_at FROM asset_revisions WHERE asset_id=$1 ORDER BY revision DESC`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []Revision{}
	for rows.Next() {
		var item Revision
		if err := rows.Scan(&item.Revision, &item.Summary, &item.Actor, &item.Created); err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	return result, rows.Err()
}

func (s *Store) Restore(ctx context.Context, id uuid.UUID, source, base int) (Asset, error) {
	item, err := s.Get(ctx, id, source)
	if err != nil {
		return Asset{}, err
	}
	return s.Update(ctx, id, base, item.Title, fmt.Sprintf("revision %d 복원", source), item.Document)
}

func insertRevision(ctx context.Context, tx pgx.Tx, id uuid.UUID, revision int, summary string, document json.RawMessage) error {
	sum := sha256.Sum256(document)
	_, err := tx.Exec(ctx, `INSERT INTO asset_revisions(asset_id,revision,document,summary,checksum) VALUES($1,$2,$3,$4,$5)`, id, revision, document, summary, hex.EncodeToString(sum[:]))
	return err
}

func insertEvent(ctx context.Context, tx pgx.Tx, item Asset, eventType string) error {
	payload, _ := json.Marshal(map[string]any{"resourceType": item.Kind, "resourceId": item.ID, "revision": item.LatestRevision, "eventType": eventType})
	_, err := tx.Exec(ctx, `INSERT INTO outbox_events(topic,payload) VALUES('flooks:asset-events',$1)`, payload)
	return err
}
