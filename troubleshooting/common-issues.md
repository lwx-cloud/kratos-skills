# Kratos Troubleshooting Guide

Diagnose from the failing path and repository versions. Capture the first causal error, reproduce it with the narrowest command, and load the affected subsystem reference before changing architecture.

## Contents

- [Establish the baseline](#1-establish-the-baseline)
- [Installation and tool failures](#installation-and-tool-failures)
- [Protobuf and Buf failures](#protobuf-and-buf-failures)
- [Wire failures](#wire-failures)
- [Build and test failures](#build-and-test-failures)
- [Startup and configuration failures](#startup-and-configuration-failures)
- [Discovery and client failures](#discovery-and-client-failures)
- [Timeout, cancellation, and resilience failures](#timeout-cancellation-and-resilience-failures)
- [Data failures](#data-failures)
- [Observability gaps](#observability-gaps)
- [Completion criterion](#completion-criterion)

## 1. Establish the baseline

Run repository-defined status or generation commands first. Otherwise collect:

```bash
go version
go env GOMOD GOWORK GOPATH GOROOT GOTOOLCHAIN
go list -m all
buf --version
protoc --version
wire help
```

Inspect:

- `go.mod` and `go.work` replacements;
- Make, Buf, and `go:generate` targets;
- tool versions installed on `PATH`;
- configuration files and environment precedence; and
- the earliest build, generation, or runtime error rather than the final cascade.

## Installation and tool failures

| Symptom | Check | Resolution path |
| --- | --- | --- |
| command not found | `command -v <tool>` and `go env GOBIN GOPATH` | Install the version used by repository automation and add its bin directory to `PATH` |
| Go tool version mismatch | `go version` and `go env GOROOT GOTOOLCHAIN` | Remove stale forced `GOROOT` values or select one coherent toolchain |
| plugin not found by protoc | `command -v protoc-gen-*` | Run the repository bootstrap target or install its pinned plugin version |
| module download failure | `go env GOPROXY GOPRIVATE GONOSUMDB` | Correct proxy, private-module authentication, or network policy |

Keep the project's pinned tool version throughout diagnosis.

## Protobuf and Buf failures

Check, in order:

1. import roots and Buf module paths;
2. `go_package` values and package versions;
3. dependency declarations and lock files;
4. plugin names, output paths, and `paths=source_relative` conventions;
5. generated-file ownership; and
6. breaking-change errors against the intended baseline.

Use the repository commands, or isolate with:

```bash
buf lint
buf generate
buf breaking --against '.git#branch=main'
```

Read [API patterns](../references/api-patterns.md), [validation](../references/validate-patterns.md), and [errors](../references/error-patterns.md).

## Wire failures

| Symptom | Likely cause |
| --- | --- |
| no injector found | missing `//go:build wireinject`, wrong package, or injector excluded from the command |
| no provider found | constructor or interface binding absent from the reachable provider sets |
| multiple bindings | duplicate providers for the same requested type |
| `wire_gen.go` drift | constructor graph changed without regeneration |

Trace the missing type from the injector back through provider sets. Confirm cleanup functions and errors have compatible constructor signatures. Regenerate with the repository target and inspect the generated diff.

Read [architecture patterns](../references/architecture-patterns.md).

## Build and test failures

- Re-run the narrowest failing package with `go test -count=1`.
- Distinguish handwritten compile errors from stale generated output.
- Check build tags, platform-specific files, CGO requirements, and replaced modules.
- Run `go mod tidy` only when dependency changes are intended; inspect both `go.mod` and `go.sum` afterward.
- For races or shared state, run the repository's race-enabled target or `go test -race` on the affected packages.

## Startup and configuration failures

Trace configuration from source to decoded struct to constructor:

- confirm source precedence and environment key transformation;
- distinguish missing values from zero values;
- validate durations, addresses, TLS paths, pool bounds, and credentials at startup;
- check that generated config types match configuration files; and
- log selected non-secret configuration metadata.

For port or connectivity errors, verify the actual listener address, container networking, DNS, proxy settings, and TLS mode before changing client code.

Read [configuration patterns](../references/config-patterns.md) and [transport patterns](../references/transport-patterns.md).

## Discovery and client failures

For `no instances available`, `selector.ErrNoAvailable`, or connection failures:

1. verify the registry contains the expected service name;
2. inspect instance address, protocol, version, metadata, and lease health;
3. confirm the client endpoint uses the repository's discovery scheme;
4. evaluate each node filter against real metadata;
5. confirm the global selector builder is configured before client creation; and
6. test an empty and a single-node result.

Read [registry patterns](../references/registry-patterns.md), [selector patterns](../references/selector-patterns.md), and [transport patterns](../references/transport-patterns.md).

## Timeout, cancellation, and resilience failures

- Find the first deadline in the call chain and calculate the remaining budget at each hop.
- Preserve the incoming context instead of replacing it with `context.Background()`.
- Separate caller cancellation from dependency timeout and breaker rejection.
- Check retry count, backoff, idempotency, and middleware order.
- Confirm rate limiting protects the intended scope and invokes limiter completion callbacks.

Read [circuit breaking](../references/circuit-breaker-patterns.md), [rate limiting](../references/ratelimit-patterns.md), [recovery](../references/recovery-patterns.md), and [middleware](../references/middleware-patterns.md).

## Data failures

- Verify DSN source, network reachability, TLS, credentials, migrations, and connection-pool limits.
- Translate not-found and constraint errors through the repository's domain error model.
- Confirm transactions commit once and roll back on every error or panic path.
- Reproduce slow queries with query plans and bounded test data before changing architecture.

Read [Ent patterns](../references/ent-patterns.md) and [error patterns](../references/error-patterns.md).

## Observability gaps

When the failure cannot be traced, add the smallest diagnostic signal needed:

- generated operation and service identity;
- trace and span correlation;
- dependency endpoint without credentials;
- timeout budget and error class;
- discovery node count and bounded metadata; and
- limiter or breaker rejection reason.

Remove temporary high-cardinality or sensitive diagnostics after the cause is verified.

## Completion criterion

Diagnosis is complete when the failing path is reproduced or conclusively traced, the first causal fault is identified with evidence, proposed changes address that fault, and every unverified hypothesis has an explicit command or environment requirement.
