# Staged Migration Patterns

Use this reference for cross-version, contract, storage, dependency, or infrastructure transitions. Read [compatibility.md](compatibility.md) and every affected subsystem reference before choosing the sequence.

## Define the transition

Record:

- current and target contracts, versions, schemas, or providers;
- affected callers, consumers, jobs, persisted data, configuration keys, generated artifacts, and deployment units;
- compatibility requirements and approved breaking changes;
- repository-owned generation, migration, verification, and deployment commands; and
- the signal that proves each phase is safe to advance or roll back.

Treat this inventory as the migration boundary ledger. Mark every discovered item with its transition phase or rule it out with repository evidence.

## Design deployable phases

Build an ordered phase graph in which every state that can reach production remains operable. Choose only the mechanisms required by the repository:

- additive contract or schema changes before removals;
- adapters or compatibility shims at controlled boundaries;
- dual-read, dual-write, shadow, or backfill phases for persisted data;
- feature flags or configuration aliases for staged activation;
- mixed-version compatibility during rolling deployment; and
- explicit rollback commands and data consequences.

Define the owner, entry condition, verification, rollback path, and exit condition for each phase. Keep irreversible steps behind a verified recovery or restore point.

## Preserve compatibility

Preserve public contracts and existing data semantics by default. For an approved breaking change, account for every caller and record the rollout order, migration window, generated-client impact, and communication requirement before implementation.

Change source definitions rather than derived output. Regenerate through repository-owned targets and review contract, schema, dependency, configuration, and generated diffs together.

## Execute and observe

Verify the old path, transition path, and target path for every phase that can coexist. Include representative success, failure, retry, cancellation, and rollback behavior where the subsystem exposes them.

Make phase progress observable with bounded signals such as migrated record counts, legacy call volume, compatibility errors, fallback use, and target-path success. Define thresholds that stop advancement or trigger rollback.

## Retire the legacy path

Remove legacy code, fields, schema, configuration, dependencies, feature flags, and generated artifacts only after:

- all known callers and stored data have moved;
- the legacy-path signal reaches its agreed removal threshold;
- the target path has passed its soak or stability window;
- rollback no longer depends on the legacy artifact, or a replacement recovery path exists; and
- repository checks and deployment verification pass without the legacy path.

## Verification

Complete migration work only when the boundary ledger accounts for every caller and artifact, every deployable phase has entry, verification, rollback, and exit conditions, compatibility checks cover mixed states, observability can detect unsafe progress, and each legacy removal is supported by evidence.
