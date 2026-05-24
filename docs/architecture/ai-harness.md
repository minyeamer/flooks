# AI Harness

## Goal

The FLooks AI assistant should feel domain-aware without hard-wiring every behavior into backend source code.

## Harness pack concept

A harness pack is a declarative bundle that contributes:

- system prompt fragments
- domain glossary entries
- tool enablement rules
- output post-processing hooks
- escalation policies
- example prompts and evaluation fixtures

## Base tool set

The initial governed tool registry includes:

- `list_datasets`
- `inspect_schema`
- `run_governed_query`
- `explain_result`
- `summarize_issue`
- `propose_dashboard`

## Rules

1. Tool output must already respect dataset grants before the model sees it.
2. Harness packs can narrow tools, but they cannot bypass authorization.
3. Shared company keys and user-provided keys are different provider modes.
4. Every AI execution writes an audit event with actor, tool set, and dataset scope.
