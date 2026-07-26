package postgres

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/flooks/flooks/internal/domain"
)

type Connector struct {
	key       string
	pool      *pgxpool.Pool
	semaphore chan struct{}
}

func New(key string, pool *pgxpool.Pool, maxConcurrent int) *Connector {
	return &Connector{key: key, pool: pool, semaphore: make(chan struct{}, maxConcurrent)}
}

func (c *Connector) Kind() string { return c.key }

func (c *Connector) ValidateManifest(manifest domain.DatasetManifest) error {
	if manifest.Source.Kind != "table_function" && manifest.Source.Kind != "table" {
		return fmt.Errorf("unsupported source kind %q", manifest.Source.Kind)
	}
	if _, err := identifier(manifest.Source.Identifier); err != nil {
		return err
	}
	return nil
}

func (c *Connector) Execute(ctx context.Context, manifest domain.DatasetManifest, spec domain.QuerySpec) (domain.QueryResult, error) {
	select {
	case c.semaphore <- struct{}{}:
		defer func() { <-c.semaphore }()
	case <-ctx.Done():
		return domain.QueryResult{}, ctx.Err()
	}
	sql, args, err := Compile(manifest, spec)
	if err != nil {
		return domain.QueryResult{}, err
	}
	started := time.Now()
	rows, err := c.pool.Query(ctx, sql, args...)
	if err != nil {
		return domain.QueryResult{}, err
	}
	defer rows.Close()
	fields := rows.FieldDescriptions()
	columns := make([]domain.Column, len(fields))
	for index, field := range fields {
		columns[index] = domain.Column{Name: field.Name, Type: typeName(field.DataTypeOID)}
	}
	resultRows := make([]map[string]any, 0)
	for rows.Next() {
		values, err := rows.Values()
		if err != nil {
			return domain.QueryResult{}, err
		}
		row := make(map[string]any, len(values))
		for index, value := range values {
			row[fields[index].Name] = normalize(value)
		}
		resultRows = append(resultRows, row)
	}
	if err := rows.Err(); err != nil {
		return domain.QueryResult{}, err
	}
	return domain.QueryResult{Columns: columns, Rows: resultRows, RowCount: len(resultRows), DurationMS: time.Since(started).Milliseconds()}, nil
}

func Compile(manifest domain.DatasetManifest, spec domain.QuerySpec) (string, []any, error) {
	source, err := identifier(manifest.Source.Identifier)
	if err != nil {
		return "", nil, err
	}
	args := []any{spec.TimeRange.Start, spec.TimeRange.End}
	selects := make([]string, 0, len(spec.Dimensions)+len(spec.Metrics))
	groups := make([]string, 0, len(spec.Dimensions))
	for _, key := range spec.Dimensions {
		field, _ := manifest.Dimension(key)
		column := pgx.Identifier{field.Column}.Sanitize()
		selects = append(selects, column+" AS "+pgx.Identifier{field.Key}.Sanitize())
		groups = append(groups, column)
	}
	for _, key := range spec.Metrics {
		metric, _ := manifest.Metric(key)
		expression, err := metricSQL(manifest, metric)
		if err != nil {
			return "", nil, err
		}
		selects = append(selects, expression+" AS "+pgx.Identifier{metric.Key}.Sanitize())
	}
	from := source
	if manifest.Source.Kind == "table_function" {
		from += "($1::date, $2::date)"
	}
	parts := []string{"SELECT " + strings.Join(selects, ", "), "FROM " + from}
	if len(spec.Filters) > 0 {
		predicates := make([]string, 0, len(spec.Filters))
		for _, filter := range spec.Filters {
			field, _ := manifest.Dimension(filter.Field)
			column := pgx.Identifier{field.Column}.Sanitize()
			switch filter.Op {
			case "eq":
				args = append(args, filter.Value)
				predicates = append(predicates, column+" = $"+strconv.Itoa(len(args)))
			case "in":
				values, ok := filter.Value.([]any)
				if !ok || len(values) == 0 {
					return "", nil, fmt.Errorf("filter %s requires a non-empty array", filter.Field)
				}
				textValues := make([]string, len(values))
				for index, value := range values {
					textValues[index] = fmt.Sprint(value)
				}
				args = append(args, textValues)
				predicates = append(predicates, column+" = ANY($"+strconv.Itoa(len(args))+"::text[])")
			case "contains":
				args = append(args, "%"+fmt.Sprint(filter.Value)+"%")
				predicates = append(predicates, column+" ILIKE $"+strconv.Itoa(len(args)))
			case "between":
				values, ok := filter.Value.([]any)
				if !ok || len(values) != 2 {
					return "", nil, fmt.Errorf("filter %s requires two values", filter.Field)
				}
				args = append(args, values[0], values[1])
				predicates = append(predicates, fmt.Sprintf("%s BETWEEN $%d AND $%d", column, len(args)-1, len(args)))
			case "isNull":
				if value, _ := filter.Value.(bool); value {
					predicates = append(predicates, column+" IS NULL")
				} else {
					predicates = append(predicates, column+" IS NOT NULL")
				}
			}
		}
		parts = append(parts, "WHERE "+strings.Join(predicates, " AND "))
	}
	if len(groups) > 0 && len(spec.Metrics) > 0 {
		parts = append(parts, "GROUP BY "+strings.Join(groups, ", "))
	}
	if len(spec.Sort) > 0 {
		sorts := make([]string, 0, len(spec.Sort))
		for _, sort := range spec.Sort {
			sorts = append(sorts, pgx.Identifier{sort.Field}.Sanitize()+" "+strings.ToUpper(sort.Direction))
		}
		parts = append(parts, "ORDER BY "+strings.Join(sorts, ", "))
	}
	args = append(args, spec.Limit, spec.Offset)
	parts = append(parts, fmt.Sprintf("LIMIT $%d OFFSET $%d", len(args)-1, len(args)))
	return strings.Join(parts, "\n"), args, nil
}

func metricSQL(manifest domain.DatasetManifest, metric domain.Metric) (string, error) {
	if metric.Type == "sum" {
		return "COALESCE(SUM(" + pgx.Identifier{metric.Column}.Sanitize() + "), 0)", nil
	}
	if metric.Type == "ratio" {
		numerator, ok := manifest.Metric(metric.Numerator)
		if !ok {
			return "", fmt.Errorf("unknown numerator %q", metric.Numerator)
		}
		denominator, ok := manifest.Metric(metric.Denominator)
		if !ok {
			return "", fmt.Errorf("unknown denominator %q", metric.Denominator)
		}
		return fmt.Sprintf("COALESCE(SUM(%s) / NULLIF(SUM(%s), 0), 0)", pgx.Identifier{numerator.Column}.Sanitize(), pgx.Identifier{denominator.Column}.Sanitize()), nil
	}
	return "", fmt.Errorf("unsupported metric type %q", metric.Type)
}

func identifier(value string) (string, error) {
	parts := strings.Split(value, ".")
	if len(parts) < 1 || len(parts) > 2 {
		return "", fmt.Errorf("invalid qualified identifier %q", value)
	}
	for _, part := range parts {
		if part == "" {
			return "", fmt.Errorf("invalid qualified identifier %q", value)
		}
		for _, char := range part {
			if !(char == '_' || char >= 'a' && char <= 'z' || char >= '0' && char <= '9') {
				return "", fmt.Errorf("invalid identifier %q", value)
			}
		}
	}
	return pgx.Identifier(parts).Sanitize(), nil
}

func normalize(value any) any {
	switch item := value.(type) {
	case time.Time:
		return item.Format(time.RFC3339)
	case []byte:
		return string(item)
	default:
		return item
	}
}

func typeName(oid uint32) string {
	switch oid {
	case 20, 21, 23:
		return "integer"
	case 700, 701, 1700:
		return "number"
	case 1082:
		return "date"
	case 1114, 1184:
		return "datetime"
	default:
		return "string"
	}
}
