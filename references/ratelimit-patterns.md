# Rate Limiting Patterns

> Version-sensitive. Compare the target repository with the [compatibility baseline](compatibility.md). The compile-tested server middleware uses an Aegis limiter and defaults to adaptive BBR.

## Contents

- [Choose the limiting boundary](#choose-the-limiting-boundary)
- [Use the default BBR limiter](#use-the-default-bbr-limiter)
- [Tune BBR](#tune-bbr)
- [Limit selected operations](#limit-selected-operations)
- [Implement quota limiting](#implement-quota-limiting)
- [Verification](#verification)

## Choose the limiting boundary

Different controls solve different overload problems:

| Need | Boundary |
| --- | --- |
| Protect one process from CPU and in-flight overload | Kratos Aegis BBR middleware |
| Apply endpoint-specific protection | Middleware selector with separate limiter instances |
| Enforce user, tenant, API-key, or global quotas | Gateway or distributed quota service, or a keyed custom middleware |
| Control concurrency around one resource | Bounded semaphore close to that resource |

Do not present the built-in BBR limiter as a token bucket. Aegis `ratelimit.Limiter` has this contract:

```go
type Limiter interface {
	Allow() (DoneFunc, error)
}
```

The done callback must be invoked with the handler result so adaptive limiters can update their observations.

## Use the default BBR limiter

`ratelimit.Server()` uses `bbr.NewLimiter()` by default:

```go
package server

import (
	"github.com/go-kratos/kratos/v2/middleware/ratelimit"
	"github.com/go-kratos/kratos/v2/middleware/recovery"
	"github.com/go-kratos/kratos/v2/transport/http"
)

func Options() []http.ServerOption {
	return []http.ServerOption{
		http.Middleware(
			recovery.Recovery(),
			ratelimit.Server(),
		),
	}
}
```

An overload rejection returns Kratos error `ratelimit.ErrLimitExceed` with HTTP code 429.

## Tune BBR

Inject a configured Aegis limiter when runtime measurements justify non-default settings:

```go
package resilience

import (
	"time"

	"github.com/go-kratos/aegis/ratelimit/bbr"
	"github.com/go-kratos/kratos/v2/middleware"
	kratoslimit "github.com/go-kratos/kratos/v2/middleware/ratelimit"
)

func ServerLimiter() middleware.Middleware {
	limiter := bbr.NewLimiter(
		bbr.WithWindow(10*time.Second),
		bbr.WithBucket(100),
		bbr.WithCPUThreshold(800),
	)
	return kratoslimit.Server(kratoslimit.WithLimiter(limiter))
}
```

`WithCPUThreshold` uses a 0-1000 scale. In containers, set `WithCPUQuota` when process CPU sampling must be normalized to an explicit CPU quota.

## Limit selected operations

Selectors match generated transport operations. Verify operation names from generated code or runtime telemetry:

```go
loginLimiter := selector.Server(
	kratoslimit.Server(kratoslimit.WithLimiter(loginBBR)),
).Path(
	"/auth.v1.Auth/Login",
	"/auth.v1.Auth/RefreshToken",
).Build()
```

Create independent limiter instances for materially different traffic classes. Order selectors from the narrowest operation set to the broadest and test that each operation matches exactly one intended policy.

## Implement quota limiting

For fixed quotas, implement a keyed limiter at the boundary owning the identity and storage. If it adapts to Kratos `ratelimit.Server`, it must implement the Aegis interface and return a completion callback:

```go
type QuotaLimiter struct {
	// shared or local quota state
}

func (l *QuotaLimiter) Allow() (ratelimit.DoneFunc, error) {
	if !l.reserve() {
		return nil, ratelimit.ErrLimitExceed
	}
	return func(info ratelimit.DoneInfo) {
		l.observe(info.Err)
	}, nil
}
```

A single middleware-level limiter has no request identity in `Allow`. Use a custom Kratos middleware when the key must come from JWT claims, tenant metadata, an API key, or the remote address. Bound the keyed-state size and eviction policy.

Distributed quotas require an atomic backend operation and a defined failure mode. Decide whether backend failure fails open or closed, then expose that decision through metrics and alerts.

## Verification

Complete rate-limit work only when:

- limiter scope matches process protection, operation policy, or identity quota intent;
- allowed calls always execute the done callback;
- rejection codes and retry guidance match the public contract;
- burst, sustained load, recovery, and backend-failure behavior are tested;
- keyed limiter state is bounded; and
- rejection rate, current load, and limiter backend errors are observable.

## Sources

- [Kratos v2.9.2 rate-limit middleware](https://github.com/go-kratos/kratos/blob/v2.9.2/middleware/ratelimit/ratelimit.go)
- [Aegis v0.2.0 BBR limiter](https://github.com/go-kratos/aegis/blob/v0.2.0/ratelimit/bbr/bbr.go)
- [Aegis limiter interface](https://github.com/go-kratos/aegis/blob/v0.2.0/ratelimit/ratelimit.go)
