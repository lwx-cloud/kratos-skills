# Circuit Breaker Patterns

This guide covers circuit breaker patterns for fault tolerance in kratos.

## Overview

Circuit breaker prevents cascading failures in distributed systems. When a service is failing, the circuit breaker opens to fail fast, preventing resource exhaustion.

Kratos uses [Aegis](https://github.com/go-kratos/aegis) for circuit breaker algorithms.

## Circuit Breaker States

```
┌─────────────┐     Failure Threshold      ┌─────────────┐
│   CLOSED    │ ─────────────────────────▶ │    OPEN     │
│  (Normal)   │                            │ (Failing)   │
└─────────────┘                            └─────────────┘
       ▲                                           │
       │        Timeout/Success                   │
       └───────────────────────────────────────────┘
                          │
                          ▼
                   ┌─────────────┐
                   │  HALF-OPEN  │
                   │  (Testing)  │
                   └─────────────┘
```

- **CLOSED**: Normal operation, requests pass through
- **OPEN**: Failure threshold reached, requests fail fast
- **HALF-OPEN**: Testing if service recovered

## Installation

```bash
go get github.com/go-kratos/kratos/v2/middleware/circuitbreaker
go get github.com/go-kratos/aegis/circuitbreaker
```

## Client-Side Circuit Breaker

### Basic Usage

```go
package client

import (
    "github.com/go-kratos/kratos/v2/middleware/circuitbreaker"
    "github.com/go-kratos/kratos/v2/transport/grpc"
    "github.com/go-kratos/aegis/circuitbreaker/sre"
)

func main() {
    // Create circuit breaker
    breaker := sre.NewBreaker()

    // Create gRPC client with circuit breaker
    conn, err := grpc.DialInsecure(
        context.Background(),
        grpc.WithEndpoint("discovery:///helloworld"),
        grpc.WithMiddleware(
            circuitbreaker.Client(
                circuitbreaker.WithBreaker(breaker),
            ),
        ),
    )
    if err != nil {
        panic(err)
    }
    defer conn.Close()
}
```

### SRE Circuit Breaker (Google SRE)

```go
import "github.com/go-kratos/aegis/circuitbreaker/sre"

// Default SRE breaker
breaker := sre.NewBreaker()

// Custom configuration
breaker := sre.NewBreaker(
    // Success rate threshold (0-1)
    sre.WithSuccessThreshold(0.5),

    // Request volume threshold
    sre.WithRequestVolume(100),

    // Bucket size in seconds
    sre.WithBucketSize(10),

    // Window size
    sre.WithWindow(time.Second * 10),
)
```

### Configuration Options

```go
// With custom error filter (only certain errors trigger breaker)
circuitbreaker.Client(
    circuitbreaker.WithBreaker(breaker),
    circuitbreaker.WithFilter(func(err error) bool {
        // Return true to count as failure
        if errors.Is(err, context.DeadlineExceeded) {
            return true
        }
        // Don't trigger on 4xx errors
        if kratosErr := errors.FromError(err); kratosErr != nil {
            return kratosErr.Code >= 500
        }
        return false
    }),
)
```

## Server-Side Circuit Breaker

```go
import (
    "github.com/go-kratos/kratos/v2/middleware/circuitbreaker"
    "github.com/go-kratos/kratos/v2/transport/http"
)

func NewHTTPServer(c *conf.Server, logger log.Logger) *http.Server {
    // Server-side breaker (protects the server)
    breaker := sre.NewBreaker()

    var opts = []http.ServerOption{
        http.Middleware(
            recovery.Recovery(),
            circuitbreaker.Server(
                circuitbreaker.WithBreaker(breaker),
            ),
            logging.Server(logger),
        ),
    }

    return http.NewServer(opts...)
}
```

## Group Circuit Breaker

Share circuit breaker across multiple clients:

```go
package breaker

import (
    "sync"
    "github.com/go-kratos/aegis/circuitbreaker"
    "github.com/go-kratos/aegis/circuitbreaker/sre"
)

var (
    breakers = make(map[string]circuitbreaker.Breaker)
    mu       sync.RWMutex
)

// GetBreaker gets or creates a breaker for service
func GetBreaker(service string) circuitbreaker.Breaker {
    mu.RLock()
    if b, ok := breakers[service]; ok {
        mu.RUnlock()
        return b
    }
    mu.RUnlock()

    mu.Lock()
    defer mu.Unlock()

    if b, ok := breakers[service]; ok {
        return b
    }

    b := sre.NewBreaker(
        sre.WithSuccessThreshold(0.5),
    )
    breakers[service] = b
    return b
}
```

Usage:

```go
breaker := breaker.GetBreaker("user-service")

conn, err := grpc.DialInsecure(
    context.Background(),
    grpc.WithEndpoint("discovery:///user-service"),
    grpc.WithMiddleware(
        circuitbreaker.Client(
            circuitbreaker.WithBreaker(breaker),
        ),
    ),
)
```

## Custom Circuit Breaker

Implement custom breaker by implementing the `Breaker` interface:

```go
type Breaker interface {
    Allow() error
    MarkSuccess()
    MarkFailed()
}
```

Example:

```go
type customBreaker struct {
    failures int64
    total    int64
    mu       sync.RWMutex
}

func (b *customBreaker) Allow() error {
    b.mu.RLock()
    defer b.mu.RUnlock()

    if b.total == 0 {
        return nil
    }

    failureRate := float64(b.failures) / float64(b.total)
    if failureRate > 0.5 {
        return errors.New("circuit breaker open")
    }
    return nil
}

func (b *customBreaker) MarkSuccess() {
    b.mu.Lock()
    b.total++
    b.mu.Unlock()
}

func (b *customBreaker) MarkFailed() {
    b.mu.Lock()
    b.failures++
    b.total++
    b.mu.Unlock()
}
```

## Best Practices

### 1. Set Appropriate Thresholds

```go
// For critical services: lower threshold
criticalBreaker := sre.NewBreaker(
    sre.WithSuccessThreshold(0.9),
    sre.WithRequestVolume(50),
)

// For non-critical: higher threshold
tolerantBreaker := sre.NewBreaker(
    sre.WithSuccessThreshold(0.3),
    sre.WithRequestVolume(10),
)
```

### 2. Error Filtering

```go
// Only count server errors
circuitbreaker.Client(
    circuitbreaker.WithBreaker(breaker),
    circuitbreaker.WithFilter(func(err error) bool {
        if err == nil {
            return false
        }

        // Don't count client errors (4xx)
        if e := errors.FromError(err); e != nil {
            return e.Code >= 500
        }

        // Count connection errors
        if errors.Is(err, syscall.ECONNREFUSED) {
            return true
        }

        return true
    }),
)
```

### 3. Fallback Strategy

```go
func callWithFallback(ctx context.Context, client pb.UserClient) (*pb.User, error) {
    user, err := client.GetUser(ctx, &pb.GetUserRequest{Id: "123"})
    if err != nil {
        // Check if it's circuit breaker error
        if strings.Contains(err.Error(), "circuit breaker") {
            // Return fallback/cached data
            return getCachedUser("123"), nil
        }
        return nil, err
    }
    return user, nil
}
```

## ✅ Correct vs ❌ Incorrect Examples

### ✅ Correct: Client-Side Breaker

```go
// Correct: breaker on client side
conn, err := grpc.DialInsecure(
    ctx,
    grpc.WithEndpoint("discovery:///backend-service"),
    grpc.WithMiddleware(
        circuitbreaker.Client(
            circuitbreaker.WithBreaker(sre.NewBreaker()),
        ),
    ),
)
```

### ❌ Incorrect: No Error Filtering

```go
// Wrong: all errors trigger breaker
conn, err := grpc.DialInsecure(
    ctx,
    grpc.WithMiddleware(
        circuitbreaker.Client(
            circuitbreaker.WithBreaker(breaker),
            // Missing: WithFilter to exclude 4xx errors
        ),
    ),
)
```

### ✅ Correct: Per-Service Breaker

```go
// Correct: separate breaker per service
userBreaker := sre.NewBreaker()
orderBreaker := sre.NewBreaker()

userConn, _ := grpc.DialInsecure(ctx,
    grpc.WithMiddleware(circuitbreaker.Client(
        circuitbreaker.WithBreaker(userBreaker),
    )),
)

orderConn, _ := grpc.DialInsecure(ctx,
    grpc.WithMiddleware(circuitbreaker.Client(
        circuitbreaker.WithBreaker(orderBreaker),
    )),
)
```

## References

- [Kratos Circuit Breaker Middleware](https://go-kratos.dev/docs/component/middleware/circuitbreaker)
- [Aegis Circuit Breaker](https://github.com/go-kratos/aegis/tree/main/circuitbreaker)
- [Google SRE Book - Handling Overload](https://sre.google/sre-book/handling-overload/)
