# Middleware Patterns

This guide covers middleware patterns in kratos.

## Overview

Middleware in kratos provides a way to intercept requests and responses, enabling cross-cutting concerns like logging, authentication, rate limiting, and more.

## Middleware Execution Order

Middleware follows **First In, Last Out (FILO)** order:

```
         ┌───────────────────┐
         │MIDDLEWARE 1       │
         │ ┌────────────────┐│
         │ │MIDDLEWARE 2    ││
         │ │ ┌─────────────┐││
         │ │ │MIDDLEWARE 3 │││
         │ │ │ ┌─────────┐ │││
REQUEST  │ │ │ │  YOUR   │ │││  RESPONSE
   ──────┼─┼─┼─▷ HANDLER ○─┼┼┼───▷
         │ │ │ └─────────┘ │││
         │ │ └─────────────┘││
         │ └────────────────┘│
         └───────────────────┘
```

## Built-in Middleware

| Middleware | Purpose | Location |
|------------|---------|----------|
| `recovery` | Panic recovery | `middleware/recovery` |
| `logging` | Request logging | `middleware/logging` |
| `tracing` | Distributed tracing | `middleware/tracing` |
| `validate` | Request validation | `middleware/validate` |
| `metrics` | Metrics collection | `middleware/metrics` |
| `metadata` | Metadata propagation | `middleware/metadata` |
| `auth` | JWT authentication | `middleware/auth` |
| `ratelimit` | Rate limiting | `middleware/ratelimit` |
| `circuitbreaker` | Circuit breaker | `middleware/circuitbreaker` |

## Basic Usage

### Server Middleware

```go
import (
    "github.com/go-kratos/kratos/v2/middleware"
    "github.com/go-kratos/kratos/v2/middleware/recovery"
    "github.com/go-kratos/kratos/v2/middleware/logging"
    "github.com/go-kratos/kratos/v2/middleware/tracing"
    "github.com/go-kratos/kratos/v2/middleware/validate"
    "github.com/go-kratos/kratos/v2/transport/http"
)

// HTTP Server
httpSrv := http.NewServer(
    http.Middleware(
        recovery.Recovery(),
        tracing.Server(),
        logging.Server(logger),
        validate.Validator(),
    ),
)

// gRPC Server
grpcSrv := grpc.NewServer(
    grpc.Middleware(
        recovery.Recovery(),
        tracing.Server(),
        logging.Server(logger),
    ),
)
```

### Client Middleware

```go
// HTTP Client
conn, err := http.NewClient(
    ctx,
    http.WithEndpoint(endpoint),
    http.WithMiddleware(
        recovery.Recovery(),
        tracing.Client(),
        logging.Client(logger),
    ),
)

// gRPC Client
conn, err := grpc.DialInsecure(
    ctx,
    grpc.WithEndpoint(endpoint),
    grpc.WithMiddleware(
        recovery.Recovery(),
        tracing.Client(),
    ),
)
```

## Custom Middleware

### Basic Middleware Structure

```go
package middleware

import (
    "context"
    "github.com/go-kratos/kratos/v2/middleware"
    "github.com/go-kratos/kratos/v2/transport"
)

// MyMiddleware creates a custom middleware
func MyMiddleware() middleware.Middleware {
    return func(handler middleware.Handler) middleware.Handler {
        return func(ctx context.Context, req interface{}) (reply interface{}, err error) {
            // Pre-processing (request phase)
            if tr, ok := transport.FromServerContext(ctx); ok {
                // Access transport information
                operation := tr.Operation()
                // ...
            }

            // Call next handler
            reply, err = handler(ctx, req)

            // Post-processing (response phase)
            // ...

            return reply, err
        }
    }
}
```

### Middleware with Configuration

```go
package middleware

type options struct {
    headerKey string
    headerValue string
}

// Option configures the middleware
type Option func(*options)

func WithHeader(key, value string) Option {
    return func(o *options) {
        o.headerKey = key
        o.headerValue = value
    }
}

// CustomHeader middleware adds custom headers
func CustomHeader(opts ...Option) middleware.Middleware {
    o := &options{
        headerKey:   "X-Custom-Header",
        headerValue: "default",
    }
    for _, opt := range opts {
        opt(o)
    }

    return func(handler middleware.Handler) middleware.Handler {
        return func(ctx context.Context, req interface{}) (reply interface{}, err error) {
            if tr, ok := transport.FromServerContext(ctx); ok {
                tr.ReplyHeader().Set(o.headerKey, o.headerValue)
            }
            return handler(ctx, req)
        }
    }
}

// Usage
httpSrv := http.NewServer(
    http.Middleware(
        CustomHeader(WithHeader("X-Version", "v1.0")),
    ),
)
```

## Authentication Middleware Example

```go
package auth

import (
    "context"
    "strings"
    "github.com/go-kratos/kratos/v2/errors"
    "github.com/go-kratos/kratos/v2/middleware"
    "github.com/go-kratos/kratos/v2/transport"
)

var (
    ErrMissingToken = errors.Unauthorized("MISSING_TOKEN", "authorization token required")
    ErrInvalidToken = errors.Unauthorized("INVALID_TOKEN", "invalid authorization token")
)

// TokenValidator validates JWT tokens
type TokenValidator interface {
    Validate(ctx context.Context, token string) (userID string, err error)
}

// Server creates an auth middleware
func Server(validator TokenValidator) middleware.Middleware {
    return func(handler middleware.Handler) middleware.Handler {
        return func(ctx context.Context, req interface{}) (reply interface{}, err error) {
            // Extract token from header
            tr, ok := transport.FromServerContext(ctx)
            if !ok {
                return nil, ErrMissingToken
            }

            auth := tr.RequestHeader().Get("Authorization")
            if auth == "" {
                return nil, ErrMissingToken
            }

            // Parse Bearer token
            parts := strings.SplitN(auth, " ", 2)
            if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
                return nil, ErrInvalidToken
            }

            // Validate token
            userID, err := validator.Validate(ctx, parts[1])
            if err != nil {
                return nil, ErrInvalidToken
            }

            // Add user ID to context for downstream use
            ctx = WithUserID(ctx, userID)

            return handler(ctx, req)
        }
    }
}

// userIDKey is the context key for user ID
type userIDKey struct{}

// WithUserID adds user ID to context
func WithUserID(ctx context.Context, userID string) context.Context {
    return context.WithValue(ctx, userIDKey{}, userID)
}

// UserIDFrom extracts user ID from context
func UserIDFrom(ctx context.Context) (string, bool) {
    userID, ok := ctx.Value(userIDKey{}).(string)
    return userID, ok
}
```

## Route-Specific Middleware (Selector)

Use `selector` to apply middleware to specific routes:

```go
import "github.com/go-kratos/kratos/v2/middleware/selector"

// HTTP Server with selective middleware
httpSrv := http.NewServer(
    http.Middleware(
        recovery.Recovery(),
        // Apply auth middleware only to specific paths
        selector.Server(auth.Server(validator)).
            Prefix("/v1/admin/").
            Match(func(ctx context.Context, operation string) bool {
                // Custom match logic
                return strings.HasPrefix(operation, "/helloworld.Greeter/Admin")
            }).
            Build(),
    ),
)
```

### Selector Matching Rules

```go
selector.Server(middlewares...).
    Path("/helloworld.Greeter/SayHello", "/helloworld.Greeter/SayHi").  // Exact match
    Regex(`/helloworld.Greeter/Get[0-9]+`).                             // Regex match
    Prefix("/helloworld.", "/admin.").                                  // Prefix match
    Match(func(ctx context.Context, operation string) bool {            // Custom match
        return strings.Contains(operation, "Admin")
    }).
    Build()
```

**Note**: Selector matches on `operation` (gRPC path format: `/package.Service/Method`), not HTTP routes.

## Logging Middleware

```go
import "github.com/go-kratos/kratos/v2/middleware/logging"

// Server-side logging
httpSrv := http.NewServer(
    http.Middleware(
        logging.Server(logger),
    ),
)

// Client-side logging
conn, err := http.NewClient(
    ctx,
    http.WithMiddleware(
        logging.Client(logger),
    ),
)
```

## Tracing Middleware (OpenTelemetry)

```go
import (
    "github.com/go-kratos/kratos/v2/middleware/tracing"
    "go.opentelemetry.io/otel/trace"
)

// Server-side tracing
httpSrv := http.NewServer(
    http.Middleware(
        tracing.Server(
            tracing.WithTracerProvider(tracerProvider),
            tracing.WithPropagator(propagator),
        ),
    ),
)

// Client-side tracing
conn, err := http.NewClient(
    ctx,
    http.WithMiddleware(
        tracing.Client(
            tracing.WithTracerProvider(tracerProvider),
            tracing.WithPropagator(propagator),
        ),
    ),
)
```

## Rate Limiting Middleware

```go
import (
    "github.com/go-kratos/kratos/v2/middleware/ratelimit"
    "github.com/go-kratos/aegis/ratelimit/bbr"
)

// BBR rate limiting (server-side)
httpSrv := http.NewServer(
    http.Middleware(
        ratelimit.Server(ratelimit.WithLimiter(bbr.New())),
    ),
)
```

## Circuit Breaker Middleware

```go
import (
    "github.com/go-kratos/kratos/v2/middleware/circuitbreaker"
    "github.com/go-kratos/aegis/circuitbreaker"
)

// Circuit breaker (client-side)
conn, err := http.NewClient(
    ctx,
    http.WithMiddleware(
        circuitbreaker.Client(
            circuitbreaker.WithBreaker(sre.New()),
        ),
    ),
)
```

## Recovery Middleware

```go
import "github.com/go-kratos/kratos/v2/middleware/recovery"

httpSrv := http.NewServer(
    http.Middleware(
        recovery.Recovery(
            recovery.WithHandler(func(ctx context.Context, req, err interface{}) error {
                // Custom panic handler
                log.Errorf("panic recovered: %v", err)
                return errors.InternalServer("PANIC", "internal server error")
            }),
        ),
    ),
)
```

## ✅ Correct vs ❌ Incorrect Examples

### ✅ Correct: Proper Middleware Chain

```go
httpSrv := http.NewServer(
    http.Middleware(
        recovery.Recovery(),        // Always first
        tracing.Server(),           // Tracing early
        logging.Server(logger),     // Logging after tracing
        validate.Validator(),       // Validation before business logic
        auth.Server(validator),     // Auth before handlers
    ),
)
```

### ❌ Incorrect: Wrong Order

```go
httpSrv := http.NewServer(
    http.Middleware(
        validate.Validator(),       // Wrong: should be after logging/tracing
        auth.Server(validator),     // Wrong: recovery should be first
        recovery.Recovery(),
    ),
)
```

### ✅ Correct: Using Transport Context

```go
func CustomMiddleware() middleware.Middleware {
    return func(handler middleware.Handler) middleware.Handler {
        return func(ctx context.Context, req interface{}) (reply interface{}, err error) {
            if tr, ok := transport.FromServerContext(ctx); ok {
                // Use transport information
                operation := tr.Operation()
                headers := tr.RequestHeader()
                // ...
            }
            return handler(ctx, req)
        }
    }
}
```

### ❌ Incorrect: Ignoring Transport Check

```go
func BadMiddleware() middleware.Middleware {
    return func(handler middleware.Handler) middleware.Handler {
        return func(ctx context.Context, req interface{}) (reply interface{}, err error) {
            tr := transport.FromServerContext(ctx)  // Wrong: ignoring ok check
            // Will panic if not from server transport
            headers := tr.RequestHeader()
            return handler(ctx, req)
        }
    }
}
```

## References

- [Kratos Middleware](https://go-kratos.dev/docs/component/middleware/overview)
- [Aegis (Resilience)](https://github.com/go-kratos/aegis)
- [OpenTelemetry](https://opentelemetry.io/)
