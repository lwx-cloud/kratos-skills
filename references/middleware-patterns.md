# Middleware Patterns

> Version-sensitive. Compare middleware APIs with the [compatibility baseline](compatibility.md) and verify execution order in the target repository.

## Contents

- [Understand execution order](#understand-execution-order)
- [Compose server middleware](#compose-server-middleware)
- [Compose client middleware](#compose-client-middleware)
- [Write custom middleware](#write-custom-middleware)
- [Select operations](#select-operations)
- [Route to specialized references](#route-to-specialized-references)
- [Verification](#verification)

## Understand execution order

Kratos builds middleware with `middleware.Chain`. The first middleware in the list is the outermost wrapper:

```text
request  -> first -> second -> handler
response <- first <- second <- handler
```

Order affects panic capture, trace context, logs, metrics, authentication, validation, retries, rate limiting, and circuit-breaker observations. Derive the order from required behavior and test both accepted and rejected requests.

## Compose server middleware

A common server chain keeps recovery outermost and records rejected requests in traces and logs:

```go
package server

import (
	validate "github.com/go-kratos/kratos/contrib/middleware/validate/v2"
	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-kratos/kratos/v2/middleware/logging"
	"github.com/go-kratos/kratos/v2/middleware/recovery"
	"github.com/go-kratos/kratos/v2/middleware/tracing"
	"github.com/go-kratos/kratos/v2/transport/http"
)

func Middleware(logger log.Logger) http.ServerOption {
	return http.Middleware(
		recovery.Recovery(),
		tracing.Server(),
		logging.Server(logger),
		validate.ProtoValidate(),
	)
}
```

Add authentication, metrics, and rate limiting according to policy. For example, put authentication before work that requires identity; place metrics outside a limiter when rejected requests must be counted.

## Compose client middleware

Client middleware observes outbound calls:

```go
conn, err := grpc.DialInsecure(
	ctx,
	grpc.WithEndpoint(endpoint),
	grpc.WithMiddleware(
		tracing.Client(),
		metrics.Client(metricsOptions...),
		circuitbreaker.Client(),
	),
)
```

Decide retry placement explicitly. Retrying outside a circuit breaker records each attempt; retrying inside presents one combined result. Retry only operations with a defined idempotency strategy.

## Write custom middleware

Keep custom middleware transport-agnostic unless it genuinely needs headers or operation metadata:

```go
package middlewarex

import (
	"context"
	"time"

	"github.com/go-kratos/kratos/v2/middleware"
	"github.com/go-kratos/kratos/v2/transport"
)

func Timing(observe func(operation string, elapsed time.Duration, err error)) middleware.Middleware {
	return func(next middleware.Handler) middleware.Handler {
		return func(ctx context.Context, req any) (reply any, err error) {
			started := time.Now()
			operation := ""
			if tr, ok := transport.FromServerContext(ctx); ok {
				operation = tr.Operation()
			}
			defer func() { observe(operation, time.Since(started), err) }()
			return next(ctx, req)
		}
	}
}
```

Preserve context, return the next handler's reply and error, and keep labels bounded. Use `FromClientContext` for outbound middleware.

## Select operations

Use `middleware/selector` to apply middleware to generated transport operations:

```go
protected := selector.Server(authMiddleware).
	Match(func(_ context.Context, operation string) bool {
		return operation != "/auth.v1.Auth/Login"
	}).
	Build()
```

Operation values are not necessarily raw HTTP paths. Inspect generated handlers or runtime telemetry before writing matchers. Prefer public-operation allowlists so new methods inherit protection.

## Route to specialized references

- Authentication: [auth-patterns.md](auth-patterns.md)
- Validation: [validate-patterns.md](validate-patterns.md)
- Metrics: [metrics-patterns.md](metrics-patterns.md)
- Circuit breaking: [circuit-breaker-patterns.md](circuit-breaker-patterns.md)
- Rate limiting: [ratelimit-patterns.md](ratelimit-patterns.md)
- Recovery: [recovery-patterns.md](recovery-patterns.md)
- Tracing: [tracing-patterns.md](tracing-patterns.md)

Load only the references involved in the chain under change.

## Verification

Complete middleware work only when:

- the chain order is tested for success, validation rejection, authentication rejection, timeout, and panic paths;
- server middleware is not accidentally installed on clients or vice versa;
- selectors match the observed operation names;
- context cancellation and deadlines reach the handler and outbound calls; and
- logs, metrics, and traces include failures without exposing sensitive data.

## Sources

- [Kratos v2.9.2 middleware chain](https://github.com/go-kratos/kratos/blob/v2.9.2/middleware/middleware.go)
- [Kratos v2.9.2 middleware selector](https://github.com/go-kratos/kratos/blob/v2.9.2/middleware/selector/selector.go)
