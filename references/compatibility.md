# Compatibility Baseline

Use the target repository as the runtime source of truth. This skill's compile-tested example baseline is defined by [`scripts/compilecheck/go.mod`](../scripts/compilecheck/go.mod); read its direct requirements instead of copying version numbers from prose.

## Apply the baseline

1. Compare the target `go.mod`, `go.work`, Buf files, generator versions, and contrib modules with the compilecheck module.
2. Use the target repository's existing API when versions differ.
3. Consult pinned source links in the selected reference to confirm version-sensitive options and interfaces.
4. Update dependencies only when the task authorizes an upgrade.

## Maintain the baseline

When intentionally upgrading the skill baseline:

1. Change direct requirements in `scripts/compilecheck/go.mod`.
2. Run `go mod tidy` in `scripts/compilecheck`.
3. Update version-sensitive examples and pinned source links.
4. Extend stale-API rules in `scripts/check-docs.mjs` for removed or renamed APIs.
5. Run `scripts/check.sh`, then run the platform skill validator before publishing.

Baseline maintenance is complete when the compilecheck module builds, vet passes, skill metadata and stale API checks pass, and every pinned source link matches the tested module version.
