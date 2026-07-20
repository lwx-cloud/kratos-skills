# Kratos Production-Readiness Review

Use this checklist for broad reviews. Load subsystem references only when the inspected code reaches that subsystem. Report concrete files and lines for every material finding.

## Contents

- [Compatibility and generation](#compatibility-and-generation)
- [API contracts](#api-contracts)
- [Architecture and dependency injection](#architecture-and-dependency-injection)
- [Context, data, and transactions](#context-data-and-transactions)
- [Configuration and discovery](#configuration-and-discovery)
- [Middleware and resilience](#middleware-and-resilience)
- [Observability](#observability)
- [Security](#security)
- [Testing and delivery](#testing-and-delivery)
- [Completion criterion](#completion-criterion)

## Compatibility and generation

- Record the Go, Kratos, contrib, Protobuf, Buf, Wire, validation, and persistence versions from repository files.
- Use repository-owned Make, Buf, Go generate, or task-runner commands.
- Confirm generated files match their source protos, schemas, configuration definitions, and Wire injectors.
- Keep generated outputs in the diff only when the repository tracks them.
- Check API and database compatibility before approving dependency or generator upgrades.

Read [CLI and generation](../references/cli-guide.md), [API patterns](../references/api-patterns.md), and the affected generator reference.

## API contracts

- Version public Protobuf packages and set a correct `go_package`.
- Verify HTTP methods, paths, path parameters, bodies, and response mappings.
- Preserve existing field numbers and reserve removed fields and names.
- Define validation and structured errors at the contract boundary used by the repository.
- Apply pagination, field masks, idempotency, and long-running semantics where the domain requires them.
- Test backward compatibility and representative invalid requests.

Read [API patterns](../references/api-patterns.md), [validation](../references/validate-patterns.md), [errors](../references/error-patterns.md), and [OpenAPI](../references/openapi-guide.md).

## Architecture and dependency injection

- Keep service methods focused on transport adaptation.
- Keep business rules, use cases, and repository contracts independent of storage and transport packages.
- Keep persistence and external clients behind data-layer implementations.
- Pass dependencies through constructors and Wire provider sets.
- Update injectors and generated Wire output whenever constructor graphs change.
- Preserve the repository's intentional deviations instead of forcing a template migration.

Read [architecture patterns](../references/architecture-patterns.md).

## Context, data, and transactions

- Propagate the incoming context through use cases, repositories, and outbound clients.
- Set explicit outbound timeouts and preserve caller cancellation.
- Bound connection pools, queues, batches, and concurrency.
- Define transaction ownership at the use-case boundary and guarantee rollback on every error path.
- Translate not-found, conflict, timeout, and availability failures at the appropriate boundary.
- Avoid exposing raw database or upstream error messages through public APIs.

Read [transport patterns](../references/transport-patterns.md), [Ent patterns](../references/ent-patterns.md), and [error patterns](../references/error-patterns.md).

## Configuration and discovery

- Establish configuration-source precedence and startup validation.
- Keep secrets outside committed configuration and logs.
- Validate addresses, timeouts, pool sizes, and feature flags before serving traffic.
- Register services with correct names, versions, protocols, health state, and metadata.
- Confirm clients use discovery endpoints, intended node filters, and a compatible selector builder.
- Exercise empty discovery results and stale-instance removal.

Read [configuration](../references/config-patterns.md), [registry](../references/registry-patterns.md), and [selector](../references/selector-patterns.md).

## Middleware and resilience

- Verify middleware order from request and response behavior.
- Keep recovery outermost when it must catch later middleware and handler panics.
- Apply authentication and validation to the intended generated operations.
- Use client-side circuit breaking for unstable dependencies and classify failures correctly.
- Use BBR for process overload protection and separate quota enforcement by identity or operation.
- Retry only bounded, idempotent work and include jitter where appropriate.
- Make rejections, fallbacks, and degraded responses observable.

Read [middleware](../references/middleware-patterns.md), [authentication](../references/auth-patterns.md), [recovery](../references/recovery-patterns.md), [circuit breaking](../references/circuit-breaker-patterns.md), and [rate limiting](../references/ratelimit-patterns.md).

## Observability

- Use structured logs with stable keys and contextual trace correlation.
- Record generated operations instead of unbounded raw paths.
- Keep metric attributes bounded and exclude user, request, trace, and resource IDs.
- Propagate trace and metadata context across every outbound call.
- Record latency, availability, saturation, rejections, and dependency failures.
- Shut down telemetry providers with a bounded context.

Read [logging](../references/logging-patterns.md), [metrics](../references/metrics-patterns.md), [tracing](../references/tracing-patterns.md), and [metadata](../references/metadata-patterns.md).

## Security

- Enforce JWT algorithm, issuer, audience, expiry, and key-rotation policy.
- Protect new operations by default and keep public-operation allowlists explicit.
- Redact credentials, tokens, authorization headers, and sensitive request fields.
- Apply TLS and certificate validation to production network paths.
- Validate user-controlled input before storage, logging, template use, or downstream calls.
- Keep operational endpoints intentionally exposed and network-protected.

Read [authentication](../references/auth-patterns.md), [transport](../references/transport-patterns.md), and [validation](../references/validate-patterns.md).

## Testing and delivery

- Unit-test use cases through repository interfaces.
- Test transport mappings, validation rejection, structured errors, and middleware order.
- Add integration coverage for persistence, discovery, and external clients changed by the patch.
- Run race-sensitive tests for shared limiter, selector, cache, or connection state.
- Verify graceful startup, shutdown, readiness, and cleanup.
- Inspect dependency, generated, configuration, and container changes in the final diff.

## Completion criterion

A production-readiness review is complete when every checklist section is either supported by evidence or explicitly out of scope, every material finding cites a file and line, and verification gaps name the exact command or environment dependency required to close them.
