# Using Kratos Skills with Claude Code

This file is human-facing installation and invocation guidance. Kratos engineering instructions live in [`SKILL.md`](../SKILL.md) and the routed references.

## Install

From a repository checkout, link the entire skill directory so referenced files remain available:

```bash
mkdir -p ~/.claude/skills
ln -s "$(pwd)" ~/.claude/skills/kratos-skills
```

For a project-local installation:

```bash
git clone https://github.com/laxidou/kratos-skills.git .claude/skills/kratos-skills
```

Confirm the installed directory contains `SKILL.md`, `references/`, `best-practices/`, and `troubleshooting/`.

## Invoke

Invoke the skill explicitly when supported:

```text
/kratos-skills
```

The skill is model-invoked because its frontmatter description is present. Automatic invocation depends on the assistant matching the request and repository context to that description; an import alone is not a guaranteed trigger.

Useful requests include:

```text
Implement this Kratos API change using the repository's existing generation workflow.
Migrate this Kratos contract in deployable phases with an explicit compatibility and rollback plan.
Review this Service-Biz-Data implementation for contract and context propagation issues.
Diagnose this Wire generation failure without changing unrelated architecture.
Harden this Kratos client with observable timeout and circuit-breaker behavior.
```

Include the affected service, expected behavior, compatibility constraints, and commands already attempted when available.

## Reference routing

The skill loads only references required for the task. To force a narrow branch, name it in the request:

```text
Use the Kratos validation reference to migrate these request messages from PGV to Protovalidate.
Use the selector reference to verify this client discovery configuration against the repository's pinned Kratos version.
Use the production-readiness checklist to review this service.
```

## Update

For symlink installations, update the checkout normally. For cloned installations, pull or reinstall the skill, then run:

```bash
scripts/check.sh
```

The check validates skill metadata, Markdown links and anchors, reference routing, pinned source versions, and stale APIs, then compiles the pinned Kratos v2 API baseline.
