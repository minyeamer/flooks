package main

import (
	"context"
	"database/sql"
	"log"
	"os"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

func main() {
	dsn := os.Getenv("METADATA_DATABASE_URL")
	if dsn == "" {
		log.Fatal("METADATA_DATABASE_URL is required")
	}
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	if err := db.PingContext(context.Background()); err != nil {
		log.Fatal(err)
	}
	if err := goose.Up(db, "db/migrations"); err != nil {
		log.Fatal(err)
	}
}
