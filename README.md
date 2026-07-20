# Kratos Skills

Repository-aware Go-Kratos v2 engineering skill for implementation, migration, debugging, and review.

[English](README.md) | [简体中文](README_CN.md)

## What It Provides

- A compact workflow in [SKILL.md](SKILL.md) with distinct implementation, staged migration, causal debugging, and review branches.
- Focused references for APIs, architecture, middleware, resilience, observability, persistence, and generation.
- A compile-tested dependency baseline in [references/compatibility.md](references/compatibility.md).
- Static documentation checks and pinned Go API compilation through `scripts/check.sh`.

The skill inventories target versions and affected boundaries first, then routes only to references relevant to the task.

## Install

With the skills CLI:

```bash
npx skills add laxidou/kratos-skills
```

For local development, link this checkout so edits remain live:

```bash
mkdir -p ~/.codex/skills
ln -s "$(pwd)" ~/.codex/skills/kratos-skills
```

Claude Code users may link the same checkout under `~/.claude/skills/kratos-skills`. See [getting-started/claude-code-guide.md](getting-started/claude-code-guide.md) for platform-specific discovery and invocation details.

## Use

Invoke `$kratos-skills` explicitly or ask for a Kratos repository task, for example:

```text
Use $kratos-skills to migrate request validation to Protovalidate and verify generated code.
```

```text
Review this Kratos service's middleware order, error mapping, and shutdown behavior.
```

The root skill selects the appropriate branch and reference files. Read [best-practices/overview.md](best-practices/overview.md) for a broad production-readiness review or [troubleshooting/common-issues.md](troubleshooting/common-issues.md) for cross-cutting diagnosis.

## Validate Changes

```bash
scripts/check.sh
```

The command validates skill metadata, Markdown structure and anchors, routed references, pinned source versions, and known stale APIs, then compiles the pinned API baseline and runs `go vet`.

## License

[MIT](LICENSE)
