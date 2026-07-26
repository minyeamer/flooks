-- +goose Up
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('chart', 'dashboard')),
  slug text NOT NULL,
  title text NOT NULL,
  latest_revision integer NOT NULL DEFAULT 1,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, slug)
);

CREATE TABLE asset_revisions (
  asset_id uuid NOT NULL REFERENCES assets(id),
  revision integer NOT NULL,
  document jsonb NOT NULL,
  summary text NOT NULL DEFAULT '',
  actor text NOT NULL DEFAULT 'anonymous',
  checksum text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (asset_id, revision)
);

CREATE TABLE outbox_events (
  id bigserial PRIMARY KEY,
  topic text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE INDEX outbox_unpublished_idx ON outbox_events(id) WHERE published_at IS NULL;

-- +goose Down
DROP TABLE IF EXISTS outbox_events;
DROP TABLE IF EXISTS asset_revisions;
DROP TABLE IF EXISTS assets;
