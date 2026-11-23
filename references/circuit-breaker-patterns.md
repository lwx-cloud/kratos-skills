# Circuit Breaker Patterns

> Version-sensitive. Compare the target repository with the [compatibility baseline](compatibility.md). The compile-tested middleware is client-side and groups breakers by operation.

## Contents

- [Place the breaker](#place-the-breaker)
- [Use the default breaker](#use-the-default-breaker)
- [Configure Aegis SRE](#configure-aegis-sre)
- [Control failure classification](#control-failure-classification)
- [Design fallback behavior](#design-fallback-behavior)
- [Verification](#verification)

## Place the breaker

Install `circuitbreaker.Client` on outbound calls to unstable dependencies. The compile-tested baseline exposes the breaker on the client side.

The middleware creates a breaker per client operation and records:

- internal-server errors;
- service-unavailable errors; and
- gateway-timeout errors.

Other results count as success. This classification makes domain-to-Kratos error mapping part of breaker behavior.

## Use the default breaker

The default middleware uses an Aegis SRE breaker:

```go
package client

import (
	"context"

	"github.com/go-kratos/kratos/v2/middleware/circuitbreaker"
	kratosgrpc "github.com/go-kratos/kratos/v2/transport/grpc"
)

func Dial(ctx context.Context, endpoint string) error {
	conn, err := kratosgrpc.DialInsecure(
		ctx,
		kratosgrpc.WithEndpoint(endpoint),
		kratosgrpc.WithMiddleware(circuitbreaker.Client()),
	)
	if err != nil {
		return err
	}
	return conn.Close()
}
```

Place tracing and metrics outside the breaker when locally rejected calls must still be visible. Place retries deliberately: retrying outside the breaker records each attempt, while retrying inside can hide attempt-level failures from the breaker.

## Configure Aegis SRE

Use `WithCircuitBreaker` to construct one breaker for each operation group entry:

```go
package resilience

import (
	"time"

	aegiscb "github.com/go-kratos/aegis/circuitbreaker"
	"github.com/go-kratos/aegis/circuitbreaker/sre"
	"github.com/go-kratos/kratos/v2/middleware"
	"github.com/go-kratos/kratos/v2/middleware/circuitbreaker"
)

func ClientBreaker() middleware.Middleware {
	return circuitbreaker.Client(
		circuitbreaker.WithCircuitBreaker(func() aegiscb.CircuitBreaker {
			return sre.NewBreaker(
				sre.WithSuccess(0.6),
				sre.WithRequest(100),
				sre.WithWindow(3*time.Second),
				sre.WithBucket(10),
			)
		}),
	)
}
```

The Aegis SRE implementation uses adaptive probabilistic shedding based on recent accepted and total requests. Avoid describing it as a generic three-state breaker unless the selected implementation actually exposes those semantics.

Tune from measurements:

- `WithRequest` controls the minimum volume before shedding;
- `WithSuccess` controls aggressiveness through the accepted-request ratio;
- `WithWindow` defines the observation window; and
- `WithBucket` defines its resolution.

## Control failure classification

The compile-tested middleware classifies failures directly rather than exposing `WithFilter`. Normalize dependency failures before they return through the breaker:

- map transport and backend availability failures to service unavailable or gateway timeout;
- keep validation, authentication, conflict, and other caller errors as 4xx-class Kratos errors; and
- preserve causes for logs and traces without exposing internal details publicly.

If an application requires a different classification policy, implement a small client middleware around the call or a custom `circuitbreaker.CircuitBreaker` integration and verify middleware order explicitly.

## Design fallback behavior

Fallback is a business decision, not a generic middleware default. Use only bounded, semantically valid alternatives such as:

- a fresh-enough cache entry;
- a degraded response with an explicit field indicating incompleteness;
- queued asynchronous work when the contract permits it; or
- a fast service-unavailable error.

Match rejection with `errors.Is(err, circuitbreaker.ErrNotAllowed)` rather than parsing error strings. Keep fallback latency bounded and observable.

## Verification

Complete circuit-breaker work only when:

- the middleware is installed on the intended client path;
- failure classification tests cover 4xx, 5xx, timeout, cancellation, and local rejection;
- thresholds are tested with sufficient request volume;
- fallback behavior preserves the API contract;
- rejected calls emit metrics and traces; and
- retries cannot amplify non-idempotent work or overload recovery.

## Sources

- [Kratos v2.9.2 circuit-breaker middleware](https://github.com/go-kratos/kratos/blob/v2.9.2/middleware/circuitbreaker/circuitbreaker.go)
- [Aegis v0.2.0 SRE breaker](https://github.com/go-kratos/aegis/blob/v0.2.0/circuitbreaker/sre/sre.go)
