# Recovery Patterns

> Version-sensitive. Compare recovery APIs with the [compatibility baseline](compatibility.md). The compile-tested middleware exposes `WithHandler`.

## Contents

- [Place recovery](#place-recovery)
- [Use default recovery](#use-default-recovery)
- [Customize the public error](#customize-the-public-error)
- [Operate panic handling](#operate-panic-handling)
- [Verification](#verification)

## Place recovery

Put recovery first in the middleware list so it wraps later middleware and the service handler:

```go
package server

import (
	"github.com/go-kratos/kratos/v2/middleware/recovery"
	"github.com/go-kratos/kratos/v2/transport/grpc"
	"github.com/go-kratos/kratos/v2/transport/http"
)

func HTTPOptions() []http.ServerOption {
	return []http.ServerOption{
		http.Middleware(recovery.Recovery()),
	}
}

func GRPCOptions() []grpc.ServerOption {
	return []grpc.ServerOption{
		grpc.Middleware(recovery.Recovery()),
	}
}
```

Recovery belongs on server paths. Client calls should return transport errors rather than relying on panic recovery as ordinary control flow.

## Use default recovery

The default middleware:

- catches panics from wrapped middleware and handlers;
- captures the current goroutine stack;
- logs the panic, request value, and stack through the Kratos contextual logger;
- stores elapsed seconds in the recovery context; and
- returns `recovery.ErrUnknownRequest`.

Because the default log includes the request value, review request types for secrets and large payloads. Prefer redaction at logging boundaries and keep authentication credentials out of request messages.

## Customize the public error

Use `WithHandler` to return the repository's stable internal-error contract:

```go
package resilience

import (
	"context"

	"github.com/go-kratos/kratos/v2/errors"
	"github.com/go-kratos/kratos/v2/middleware"
	"github.com/go-kratos/kratos/v2/middleware/recovery"
)

func Recovery() middleware.Middleware {
	return recovery.Recovery(
		recovery.WithHandler(func(ctx context.Context, req, recovered any) error {
			return errors.InternalServer(
				"INTERNAL_ERROR",
				"internal server error",
			).WithCause(asError(recovered))
		}),
	)
}

func asError(value any) error {
	if err, ok := value.(error); ok {
		return err
	}
	return errors.New(500, "PANIC", "panic recovered")
}
```

The middleware already logs the stack before calling the custom handler. Add structured incident metadata in the handler only when it does not duplicate or expose the recovered request.

Configure the Kratos global or contextual logger during application startup; the compile-tested recovery middleware exposes no `WithLogger` option.

## Operate panic handling

Treat every recovered panic as a defect or violated invariant:

- increment a bounded panic metric by generated operation and service;
- attach operation, trace ID, release, and instance metadata to the incident;
- alert on sustained or critical-operation panics;
- preserve the original cause internally; and
- return a stable, sanitized public error.

Keep process-level crash policy separate. Recovery handles request goroutines; startup failures, corrupted global state, and background goroutine panics may still require process termination and restart.

## Verification

Complete recovery work only when tests confirm:

- a panic in the handler and in later middleware is recovered;
- the configured public error is returned without panic details;
- non-panicking calls preserve replies and errors;
- panic logs or incidents include operation and trace correlation;
- sensitive request data is redacted; and
- background goroutine panic policy is explicit.

## Sources

- [Kratos v2.9.2 recovery middleware](https://github.com/go-kratos/kratos/blob/v2.9.2/middleware/recovery/recovery.go)
