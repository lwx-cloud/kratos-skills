---
name: kratos-skills
description: Go-Kratos v2 repository engineering for implementation, staged migration, causal debugging, and code review. Use for Kratos services, Protobuf HTTP/gRPC contracts, Service-Biz-Data or Wire boundaries, generated code, middleware, infrastructure, persistence, observability, resilience, and production-readiness work.
---

# Go-Kratos v2 Engineering

Work repository-first and version-locked.

## 1. Reconnaissance

1. Inspect `go.mod`, generation targets, Buf configuration, API protos, `cmd/`, and affected `internal/` packages.
2. Identify the exact Go, Kratos, contrib, Protobuf, validation, Wire, persistence, and observability versions involved.
3. Map the request, dependency, or failure path across API, service, biz, data, configuration, wiring, generated output, and tests; mark each boundary affected or ruled out.
4. Read [references/compatibility.md](references/compatibility.md) before applying version-sensitive examples.
5. Select the narrowest task references from the routing table and read each selected file completely.

Complete reconnaissance only when the installed versions and repository-owned commands are recorded, constraining local conventions are identified, and each relevant boundary is marked affected or ruled out with repository evidence.

## 2. Choose the Branch

Choose one branch: Implement for a direct modification, Migrate for a staged transition between contracts or technologies, Debug for causal diagnosis, or Review for a read-only assessment. Debug may transition into Implement or Migrate only when the request authorizes a fix.

### Implement

1. Preserve the repository's intentional architecture and naming.
2. Keep transport adaptation in `internal/service`, business rules and repository contracts in `internal/biz`, and infrastructure implementations in `internal/data` when the project follows the standard layout.
3. Propagate context, deadlines, metadata, and trace state across every changed call boundary.
4. Change source definitions for generated output, update constructors and Wire providers, then regenerate through repository-owned targets.
5. Run focused tests, broaden verification when contracts or shared infrastructure change, and inspect the final diff.

Complete implementation only when every affected boundary is modified or explicitly ruled out, generated outputs match their sources, providers agree, required checks pass, and the diff is intentional. Report each unavailable check with its exact command and blocking dependency.

### Migrate

1. Record the current and target states, compatibility constraints, and affected callers, data, configuration, dependencies, generated artifacts, and deployment boundaries.
2. Read [references/migration-patterns.md](references/migration-patterns.md), [references/compatibility.md](references/compatibility.md), and every affected subsystem reference completely.
3. Implement and verify the ordered transition through repository-owned commands, preserving an operable and observable state at every deployable phase.

Complete migration only when every caller, data shape, generated artifact, configuration key, and deployment phase is accounted for; each intermediate state is deployable; compatibility checks pass; rollback is explicit; and legacy removal gates are satisfied or reported as remaining work.

### Debug

1. Reproduce the failure or trace it to the first causal fault.
2. Test competing hypotheses with the narrowest commands and runtime evidence.
3. Report the cause, affected path, and evidence before proposing architectural changes.
4. Apply a fix only when the request authorizes changes; then use the Implement or Migrate branch for the fix and verification.

Complete diagnosis only when the first causal fault is evidenced and every remaining hypothesis names the command or environment requirement needed to resolve it.

### Review

1. Keep review-only work read-only.
2. Inspect the requested scope and affected boundaries for correctness, contract compatibility, layer boundaries, error translation, cancellation, security, observability, generated output, and tests.
3. Load [best-practices/overview.md](best-practices/overview.md) for broad production-readiness reviews and add subsystem references only for code actually present.
4. Report every material finding with concrete files and lines, ordered by severity.

Complete review only when every material issue is reported or the result explicitly states that no material findings remain, and every verification gap names the command required to close it.

## Route to References

| Task | Read |
| --- | --- |
| Baseline maintenance or dependency upgrades | [references/compatibility.md](references/compatibility.md) |
| Cross-version, contract, storage, or infrastructure migration | [references/migration-patterns.md](references/migration-patterns.md), [references/compatibility.md](references/compatibility.md), plus every affected subsystem reference |
| Service-Biz-Data boundaries, repositories, use cases, or Wire | [references/architecture-patterns.md](references/architecture-patterns.md) |
| Protobuf APIs and HTTP mappings | [references/api-patterns.md](references/api-patterns.md) |
| HTTP or gRPC servers and clients | [references/transport-patterns.md](references/transport-patterns.md) |
| Kratos CLI and generation commands | [references/cli-guide.md](references/cli-guide.md) |
| Structured errors and boundary mapping | [references/error-patterns.md](references/error-patterns.md) |
| Protovalidate or PGV migration | [references/validate-patterns.md](references/validate-patterns.md) |
| Middleware composition or order | [references/middleware-patterns.md](references/middleware-patterns.md) |
| JWT authentication and operation protection | [references/auth-patterns.md](references/auth-patterns.md) |
| Configuration sources and precedence | [references/config-patterns.md](references/config-patterns.md) |
| Registry and discovery | [references/registry-patterns.md](references/registry-patterns.md) |
| Client balancing and node filters | [references/selector-patterns.md](references/selector-patterns.md) |
| Circuit breaking | [references/circuit-breaker-patterns.md](references/circuit-breaker-patterns.md) |
| Rate limiting and overload protection | [references/ratelimit-patterns.md](references/ratelimit-patterns.md) |
| Panic recovery | [references/recovery-patterns.md](references/recovery-patterns.md) |
| Structured logging | [references/logging-patterns.md](references/logging-patterns.md) |
| OpenTelemetry metrics and Prometheus export | [references/metrics-patterns.md](references/metrics-patterns.md) |
| OpenTelemetry tracing | [references/tracing-patterns.md](references/tracing-patterns.md) |
| Kratos metadata propagation | [references/metadata-patterns.md](references/metadata-patterns.md) |
| Ent repositories and transactions | [references/ent-patterns.md](references/ent-patterns.md) |
| Serialization and content negotiation | [references/encoding-patterns.md](references/encoding-patterns.md) |
| OpenAPI generation and serving | [references/openapi-guide.md](references/openapi-guide.md) |
| Installation, generation, Wire, runtime, database, or discovery diagnosis | [troubleshooting/common-issues.md](troubleshooting/common-issues.md) plus the affected subsystem reference |
