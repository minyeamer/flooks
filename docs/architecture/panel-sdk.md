# Panel SDK

## Goal

FLooks supports first-party and third-party panels without giving custom code unrestricted access to the host application.

## Runtime boundary

- first-party panels run in the main React runtime
- third-party custom panels run inside a sandboxed iframe or isolated runtime container
- panel registration is manifest-driven and versioned

## Required contract

Each panel package must declare:

- `key`: stable panel type key
- `version`: semantic compatibility marker
- `displayName`: user-facing title
- `inputSchema`: validated panel configuration schema
- `dataContract`: expected tabular or timeseries input shape
- `capabilities`: resize, export, drilldown, filter interaction, theme usage

## Host events

The host may emit:

- `themeChanged`
- `filtersChanged`
- `timeRangeChanged`
- `refreshRequested`
- `selectionChanged`

## Security rules

1. No direct access to parent window globals.
2. No direct network calls to governed datasets from custom panels.
3. Input configuration must be schema-validated on registration and on use.
4. HTML-only panels must pass sanitation before rendering.
