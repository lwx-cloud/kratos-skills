# Configuration Patterns

> Version-sensitive source adapters follow the [compatibility baseline](compatibility.md). Preserve the target repository's source order and key conventions.

## Contents

- [Establish precedence](#establish-precedence)
- [Load and scan configuration](#load-and-scan-configuration)
- [Use generated configuration types](#use-generated-configuration-types)
- [Integrate remote sources](#integrate-remote-sources)
- [Apply watched changes safely](#apply-watched-changes-safely)
- [Verification](#verification)

## Establish precedence

Document configuration sources from lowest to highest precedence before changing them. Common layers include defaults, local files, deployment files, remote configuration, environment variables, and explicit flags.

Kratos merges sources in the order supplied and later values override earlier values. Verify this behavior against the installed version and repository tests.

Keep these decisions explicit:

- key naming and environment-variable transformation;
- required values and zero-value semantics;
- secret ownership and redaction;
- startup-only versus reloadable values; and
- failure behavior when a remote source is unavailable.

## Load and scan configuration

Use the repository's existing sources and close watchers during cleanup:

```go
package bootstrap

import (
	"github.com/go-kratos/kratos/v2/config"
	"github.com/go-kratos/kratos/v2/config/env"
	"github.com/go-kratos/kratos/v2/config/file"
)

func Load(path string, target any) (config.Config, error) {
	c := config.New(config.WithSource(
		file.NewSource(path),
		env.NewSource("APP_"),
	))
	if err := c.Load(); err != nil {
		return nil, err
	}
	if err := c.Scan(target); err != nil {
		_ = c.Close()
		return nil, err
	}
	return c, nil
}
```

Validate decoded values before constructing servers, databases, registries, and clients. Return actionable startup errors that name the invalid key without including secret values.

## Use generated configuration types

Kratos layout projects commonly define bootstrap configuration in Protobuf:

```protobuf
syntax = "proto3";

package project.conf;

import "google/protobuf/duration.proto";

option go_package = "example.com/project/internal/conf;conf";

message Bootstrap {
  Server server = 1;
  Data data = 2;
}

message Server {
  message HTTP {
    string network = 1;
    string addr = 2;
    google.protobuf.Duration timeout = 3;
  }
  HTTP http = 1;
}

message Data {
  message Database {
    string driver = 1;
    string source = 2;
  }
  Database database = 1;
}
```

Generate configuration types through the repository target, scan into the generated bootstrap value, validate it, and pass typed sections into Wire constructors.

## Integrate remote sources

Kratos contrib provides adapters for systems such as etcd, Consul, Nacos, Apollo, and Kubernetes. Read the selected adapter's module version and constructor API before use.

For every remote source, configure:

- authenticated and TLS-protected endpoints;
- namespace, path, group, or data ID;
- initial load timeout and retry policy;
- cache or last-known-good behavior; and
- health signals for watch failures and stale data.

Keep provider-specific construction in bootstrap or data infrastructure packages. Keep business packages dependent on typed configuration rather than config-center clients.

## Apply watched changes safely

`Config.Watch` observes a key already present in the loaded configuration:

```go
err := c.Watch("feature.checkout", func(key string, value config.Value) {
	next, err := value.Bool()
	if err != nil {
		return
	}
	featureFlags.SetCheckout(next)
})
```

Reload only components designed for concurrent replacement. Keep listener addresses, database drivers, schema settings, and other startup invariants immutable unless the application implements an explicit handover mechanism.

## Verification

Complete a configuration change when:

- source precedence is documented and tested;
- generated types and configuration files agree;
- required values, durations, addresses, pool bounds, and TLS settings are validated at startup;
- secrets remain outside committed files, logs, and public errors;
- watch callbacks are race-safe and limited to reloadable values; and
- configuration watchers close during application cleanup.

## Sources

- [Kratos configuration](https://go-kratos.dev/docs/component/config/)
- [Kratos layout](https://github.com/go-kratos/kratos-layout)
