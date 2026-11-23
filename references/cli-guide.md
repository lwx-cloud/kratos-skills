# Kratos CLI and Generation

Treat repository commands as authoritative. Inspect `Makefile`, `Taskfile`, Buf configuration, `go:generate` directives, tool pins, and CI before invoking the Kratos CLI directly.

## Contents

- [Tool version](#tool-version)
- [Project scaffolding](#project-scaffolding)
- [Protobuf generation](#protobuf-generation)
- [Repository workflow](#repository-workflow)
- [Diagnosis](#diagnosis)
- [Completion criterion](#completion-criterion)

## Tool Version

Use the version pinned by the repository. When a manual install is necessary, substitute that exact version:

```bash
go install github.com/go-kratos/kratos/cmd/kratos/v2@<pinned-version>
kratos -v
```

Record the version source in `tools.go`, a Make variable, CI image, developer-tool manifest, or equivalent project mechanism. Keep CLI and runtime upgrades separate enough that generated diffs can be reviewed deliberately.

## Project Scaffolding

Use `kratos new` only when creating a service or module. Select the layout repository and branch explicitly when reproducibility matters:

```bash
kratos new user-service -r <layout-repository> -b <layout-revision>
```

For an existing repository, preserve its layout instead of re-scaffolding files. Review scaffold output before adding it, especially module paths, API package names, configuration, Docker files, and CI defaults.

## Protobuf Generation

The CLI can create a proto skeleton and invoke Kratos generators:

```bash
kratos proto add api/user/v1/user.proto
kratos proto client api/user/v1/user.proto
kratos proto server api/user/v1/user.proto -t internal/service
```

Run these commands only if they match the repository's established targets. Generated clients normally include message, gRPC, and HTTP code; server generation creates an implementation skeleton that still requires constructor, interface, and Wire integration.

Change `.proto` sources before generated `.go` files. Regenerate all outputs governed by the changed source, including validation, errors, OpenAPI, and mocks where configured.

## Repository Workflow

Use the narrowest repository target that owns the changed artifact, then broaden verification:

```bash
make api
make config
make errors
make wire
go test ./...
```

Target names differ by repository; discover them rather than assuming this set exists. After generation:

1. Inspect the command output.
2. Review generated and handwritten diffs separately.
3. Run the same target again and require a clean second diff.
4. Build or test every package consuming the generated contract.

Use `kratos run` only when it is the repository's normal entry point. Otherwise run the documented binary, container, or development target with its required configuration.

## Diagnosis

For missing tools, compare `PATH`, `go env GOBIN`, and the repository's installation target. For generation failures, identify the first failing plugin, print its version, and verify include paths and source imports. For Wire failures, run the repository's Wire target and inspect provider-set type mismatches before editing generated injectors.

Read [troubleshooting/common-issues.md](../troubleshooting/common-issues.md) for cross-cutting generation and environment failures.

## Completion Criterion

Complete a CLI or generation change when the repository's pinned tool version is identified, the owning generation target succeeds, a second run produces no unexplained diff, generated files match their source definitions, affected consumers build or test, and every unavailable command records its exact environment dependency.

## References

- [Kratos CLI Usage](https://go-kratos.dev/docs/getting-started/usage)
- [Kratos Quick Start](https://go-kratos.dev/docs/getting-started/start)
