# Rate Limiting Patterns

This guide covers rate limiting patterns for traffic control in kratos.

## Overview

Rate limiting controls the rate of requests to protect services from being overwhelmed. Kratos provides server-side rate limiting middleware.

## Algorithms

| Algorithm | Description | Use Case |
|-----------|-------------|----------|
| Token Bucket | Allows bursts up to bucket size | API endpoints with burst capacity |
| Leaky Bucket | Smooth rate limiting | Steady traffic control |
| BBR | Bottleneck Bandwidth and RTT | Adaptive based on system load |

## Installation

```bash
go get github.com/go-kratos/kratos/v2/middleware/ratelimit
go get github.com/go-kratos/aegis/ratelimit
```

## Token Bucket Rate Limiter

### Basic Usage

```go
package server

import (
    "github.com/go-kratos/kratos/v2/middleware/ratelimit"
    "github.com/go-kratos/kratos/v2/transport/http"
    "github.com/go-kratos/aegis/ratelimit"
)

func NewHTTPServer(c *conf.Server, logger log.Logger) *http.Server {
    // Create token bucket limiter
    limiter := ratelimit.NewTokenBucket(
        100,           // capacity (tokens)
        100,           // fill rate (tokens per second)
    )

    var opts = []http.ServerOption{
        http.Middleware(
            recovery.Recovery(),
            ratelimit.Server(
                ratelimit.WithLimiter(limiter),
            ),
            logging.Server(logger),
        ),
    }

    return http.NewServer(opts...)
}
```

## BBR Rate Limiter (Adaptive)

BBR (Bottleneck Bandwidth and RTT) is Google's congestion control algorithm, adapted for rate limiting.

```go
import (
    "github.com/go-kratos/aegis/ratelimit/bbr"
)

func NewHTTPServer(c *conf.Server, logger log.Logger) *http.Server {
    // BBR limiter (adaptive based on system load)
    limiter, err := bbr.NewLimiter()
    if err != nil {
        panic(err)
    }

    var opts = []http.ServerOption{
        http.Middleware(
            recovery.Recovery(),
            ratelimit.Server(
                ratelimit.WithLimiter(limiter),
            ),
            logging.Server(logger),
        ),
    }

    return http.NewServer(opts...)
}
```

## Per-Client Rate Limiting

### IP-Based Limiting

```go
package middleware

import (
    "sync"
    "github.com/go-kratos/aegis/ratelimit"
)

type ipLimiter struct {
    limiters map[string]ratelimit.Limiter
    mu       sync.RWMutex
    rate     int
    capacity int
}

func newIPLimiter(rate, capacity int) *ipLimiter {
    return &ipLimiter{
        limiters: make(map[string]ratelimit.Limiter),
        rate:     rate,
        capacity: capacity,
    }
}

func (l *ipLimiter) Allow(ip string) error {
    l.mu.RLock()
    limiter, ok := l.limiters[ip]
    l.mu.RUnlock()

    if !ok {
        l.mu.Lock()
        limiter = ratelimit.NewTokenBucket(l.capacity, l.rate)
        l.limiters[ip] = limiter
        l.mu.Unlock()
    }

    return limiter.Allow()
}

// Usage in middleware
func IPLimitMiddleware(rate, capacity int) middleware.Middleware {
    limiter := newIPLimiter(rate, capacity)

    return func(handler middleware.Handler) middleware.Handler {
        return func(ctx context.Context, req interface{}) (interface{}, error) {
            if tr, ok := transport.FromServerContext(ctx); ok {
                // Extract IP from transport
                ip := extractIP(tr)
                if err := limiter.Allow(ip); err != nil {
                    return nil, errors.TooManyRequests("RATE_LIMIT", "rate limit exceeded")
                }
            }
            return handler(ctx, req)
        }
    }
}
```

### User-Based Limiting

```go
type userLimiter struct {
    limiters map[string]ratelimit.Limiter
    mu       sync.RWMutex
}

func (l *userLimiter) Allow(userID string) error {
    l.mu.RLock()
    limiter, ok := l.limiters[userID]
    l.mu.RUnlock()

    if !ok {
        l.mu.Lock()
        // Different limits for different user tiers
        limiter = ratelimit.NewTokenBucket(1000, 1000) // Premium user
        l.limiters[userID] = limiter
        l.mu.Unlock()
    }

    return limiter.Allow()
}
```

## Route-Specific Rate Limiting

```go
import (
    "github.com/go-kratos/kratos/v2/middleware/selector"
)

func NewHTTPServer(c *conf.Server, logger log.Logger) *http.Server {
    // Public API limiter
    publicLimiter := ratelimit.NewTokenBucket(100, 100)

    // Admin API limiter (higher limit)
    adminLimiter := ratelimit.NewTokenBucket(1000, 1000)

    var opts = []http.ServerOption{
        http.Middleware(
            recovery.Recovery(),
            // Public APIs
            selector.Server(
                ratelimit.Server(ratelimit.WithLimiter(publicLimiter)),
            ).
                Prefix("/api/v1/public/").
                Build(),
            // Admin APIs
            selector.Server(
                ratelimit.Server(ratelimit.WithLimiter(adminLimiter)),
            ).
                Prefix("/api/v1/admin/").
                Build(),
            logging.Server(logger),
        ),
    }

    return http.NewServer(opts...)
}
```

## Distributed Rate Limiting

For distributed systems, use Redis-based rate limiting:

```go
package ratelimit

import (
    "context"
    "time"
    "github.com/go-redis/redis/v8"
)

type redisLimiter struct {
    client *redis.Client
    key    string
    rate   int
    window time.Duration
}

func (l *redisLimiter) Allow(ctx context.Context) error {
    pipe := l.client.Pipeline()

    now := time.Now().Unix()
    windowStart := now - int64(l.window.Seconds())

    // Remove old entries
    pipe.ZRemRangeByScore(ctx, l.key, "0", fmt.Sprintf("%d", windowStart))

    // Count current requests
    count := pipe.ZCard(ctx, l.key)

    // Add current request
    pipe.ZAdd(ctx, l.key, &redis.Z{
        Score:  float64(now),
        Member: now,
    })

    // Set expiry
    pipe.Expire(ctx, l.key, l.window)

    _, err := pipe.Exec(ctx)
    if err != nil {
        return err
    }

    if count.Val() >= int64(l.rate) {
        return errors.New("rate limit exceeded")
    }

    return nil
}
```

## Custom Limiter

Implement the `Limiter` interface:

```go
type Limiter interface {
    Allow() error
}

// Custom limiter implementation
type customLimiter struct {
    semaphore chan struct{}
}

func NewCustomLimiter(maxConcurrent int) Limiter {
    return &customLimiter{
        semaphore: make(chan struct{}, maxConcurrent),
    }
}

func (l *customLimiter) Allow() error {
    select {
    case l.semaphore <- struct{}{}:
        return nil
    default:
        return errors.New("too many concurrent requests")
    }
}
```

## Configuration Examples

### Different Limits for Different APIs

```go
func configureMiddleware() []middleware.Middleware {
    // Health check - no limit
    // Public APIs - 100 req/s
    // Auth APIs - 10 req/s (prevent brute force)
    // Upload APIs - 10 req/min

    publicLimiter := ratelimit.NewTokenBucket(100, 100)
    authLimiter := ratelimit.NewTokenBucket(10, 10)
    uploadLimiter := ratelimit.NewTokenBucket(10, 0.16) // 10 per minute

    return []middleware.Middleware{
        selector.Server().
            Path("/health", "/ready").
            Build(), // No limit

        selector.Server(
            ratelimit.Server(ratelimit.WithLimiter(publicLimiter)),
        ).
            Prefix("/api/v1/").
            Build(),

        selector.Server(
            ratelimit.Server(ratelimit.WithLimiter(authLimiter)),
        ).
            Path("/api/v1/auth/login", "/api/v1/auth/register").
            Build(),

        selector.Server(
            ratelimit.Server(ratelimit.WithLimiter(uploadLimiter)),
        ).
            Path("/api/v1/upload").
            Build(),
    }
}
```

## ✅ Correct vs ❌ Incorrect Examples

### ✅ Correct: Set Appropriate Limits

```go
// Correct: different limits for different endpoints
loginLimiter := ratelimit.NewTokenBucket(5, 5)        // 5 req/s (prevent brute force)
apiLimiter := ratelimit.NewTokenBucket(1000, 1000)   // 1000 req/s (normal API)
```

### ❌ Incorrect: One Size Fits All

```go
// Wrong: same limit for all endpoints
limiter := ratelimit.NewTokenBucket(100, 100)

// Applied to both login (should be strict) and public API (can be lenient)
```

### ✅ Correct: Error Handling

```go
// Correct: return proper error
if err := limiter.Allow(); err != nil {
    return nil, errors.TooManyRequests("RATE_LIMIT", "too many requests")
}
```

### ❌ Incorrect: Silent Failure

```go
// Wrong: ignoring rate limit error
limiter.Allow() // Error ignored!
```

## References

- [Kratos Rate Limit Middleware](https://go-kratos.dev/docs/component/middleware/ratelimit)
- [Aegis Rate Limit](https://github.com/go-kratos/aegis/tree/main/ratelimit)
- [Token Bucket Algorithm](https://en.wikipedia.org/wiki/Token_bucket)
