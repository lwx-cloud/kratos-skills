# Recovery Patterns

This guide covers panic recovery in kratos.

## Overview

The recovery middleware catches panics and converts them to errors, preventing the entire service from crashing due to unhandled exceptions.

## Installation

```go
import "github.com/go-kratos/kratos/v2/middleware/recovery"
```

## Basic Usage

### HTTP Server

```go
package server

import (
    "github.com/go-kratos/kratos/v2/middleware/recovery"
    "github.com/go-kratos/kratos/v2/transport/http"
)

func NewHTTPServer(c *conf.Server, logger log.Logger) *http.Server {
    var opts = []http.ServerOption{
        http.Middleware(
            recovery.Recovery(),  // Must be first to catch all panics
            validate.Validator(),
            logging.Server(logger),
        ),
    }

    return http.NewServer(opts...)
}
```

### gRPC Server

```go
package server

import (
    "github.com/go-kratos/kratos/v2/middleware/recovery"
    "github.com/go-kratos/kratos/v2/transport/grpc"
)

func NewGRPCServer(c *conf.Server, logger log.Logger) *grpc.Server {
    var opts = []grpc.ServerOption{
        grpc.Middleware(
            recovery.Recovery(),  // Must be first to catch all panics
            validate.Validator(),
            logging.Server(logger),
        ),
    }

    return grpc.NewServer(opts...)
}
```

## Configuration Options

### With Handler

Customize how recovered panics are handled.

```go
package server

import (
    "github.com/go-kratos/kratos/v2/errors"
    "github.com/go-kratos/kratos/v2/middleware/recovery"
)

func NewHTTPServer(c *conf.Server, logger log.Logger) *http.Server {
    var opts = []http.ServerOption{
        http.Middleware(
            recovery.Recovery(
                recovery.WithHandler(func(ctx context.Context, req, err interface{}) error {
                    // Log the panic
                    logger.Log(log.LevelError,
                        "panic", err,
                        "request", req,
                    )

                    // Return a user-friendly error
                    return errors.InternalServer("PANIC_RECOVERY", "internal server error")
                }),
            ),
            logging.Server(logger),
        ),
    }

    return http.NewServer(opts...)
}
```

### With Logger

Add custom logging for panic recovery.

```go
package server

import (
    "github.com/go-kratos/kratos/v2/log"
    "github.com/go-kratos/kratos/v2/middleware/recovery"
)

func NewHTTPServer(c *conf.Server, logger log.Logger) *http.Server {
    helper := log.NewHelper(logger)

    var opts = []http.ServerOption{
        http.Middleware(
            recovery.Recovery(
                recovery.WithLogger(helper),
            ),
            logging.Server(logger),
        ),
    }

    return http.NewServer(opts...)
}
```

## Complete Example

### Service with Recovery

```go
package service

import (
    "context"

    pb "user/api/user/v1"
    "user/internal/biz"
)

type UserService struct {
    pb.UnimplementedUserServer
    uc  *biz.UserUsecase
    log *log.Helper
}

func (s *UserService) GetUser(ctx context.Context, req *pb.GetUserRequest) (*pb.User, error) {
    // This panic will be caught by recovery middleware
    if req.Id == 0 {
        panic("invalid user id")
    }

    return s.uc.GetUser(ctx, req.Id)
}

func (s *UserService) ProcessBatch(ctx context.Context, req *pb.BatchRequest) (*pb.BatchResponse, error) {
    // Simulate unexpected panic
    if len(req.Ids) > 1000 {
        panic("batch size too large")
    }

    // Process the batch
    return &pb.BatchResponse{}, nil
}
```

### Custom Recovery Handler

```go
package middleware

import (
    "context"
    "fmt"
    "runtime/debug"

    "github.com/go-kratos/kratos/v2/errors"
    "github.com/go-kratos/kratos/v2/log"
    "github.com/go-kratos/kratos/v2/middleware"
    "github.com/go-kratos/kratos/v2/middleware/recovery"
)

// CustomRecovery returns a custom recovery middleware
func CustomRecovery(logger log.Logger) middleware.Middleware {
    helper := log.NewHelper(logger)

    return recovery.Recovery(
        recovery.WithHandler(func(ctx context.Context, req, err interface{}) error {
            // Get stack trace
            stack := debug.Stack()

            // Log detailed panic info
            helper.WithContext(ctx).Errorf(
                "panic recovered: %v\nRequest: %+v\nStack: %s",
                err,
                req,
                string(stack),
            )

            // Send alert (e.g., to sentry, pagerduty)
            sendAlert(fmt.Sprintf("panic: %v", err), stack)

            // Return sanitized error to client
            return errors.InternalServer("INTERNAL_ERROR", "an unexpected error occurred")
        }),
    )
}

func sendAlert(message string, stack []byte) {
    // Integration with alerting system
    // e.g., Sentry, PagerDuty, Slack
}
```

### Server with Custom Recovery

```go
package server

import (
    "github.com/go-kratos/kratos/v2/transport/http"
    "user/internal/middleware"
)

func NewHTTPServer(c *conf.Server, logger log.Logger) *http.Server {
    var opts = []http.ServerOption{
        http.Middleware(
            middleware.CustomRecovery(logger),  // Custom recovery with alerting
            validate.Validator(),
            logging.Server(logger),
        ),
    }

    return http.NewServer(opts...)
}
```

## Best Practices

### ✅ Always Place Recovery First

```go
http.Middleware(
    recovery.Recovery(),  // First middleware to catch all panics
    validate.Validator(),
    auth.Server(...),     // Recovery should wrap all other middleware
    logging.Server(logger),
)
```

### ✅ Log Stack Traces

```go
recovery.WithHandler(func(ctx context.Context, req, err interface{}) error {
    stack := debug.Stack()
    logger.Errorf("panic: %v\nstack: %s", err, string(stack))
    return errors.InternalServer("INTERNAL_ERROR", "internal server error")
})
```

### ❌ Don't Ignore Panics

```go
// Don't use empty recovery handler
recovery.Recovery(
    recovery.WithHandler(func(ctx context.Context, req, err interface{}) error {
        return nil  // ❌ Silently ignoring panics is dangerous
    }),
)
```

### ✅ Send Alerts for Critical Panics

```go
recovery.WithHandler(func(ctx context.Context, req, err interface{}) error {
    // Log and send alert
    logPanic(err, req)
    alertOpsTeam(err)

    return errors.InternalServer("INTERNAL_ERROR", "internal server error")
})
```

## Testing Recovery

```go
package service_test

import (
    "context"
    "testing"

    "github.com/go-kratos/kratos/v2/middleware/recovery"
    "github.com/stretchr/testify/assert"
)

func TestRecovery(t *testing.T) {
    // Create handler that panics
    handler := func(ctx context.Context, req interface{}) (interface{}, error) {
        panic("test panic")
    }

    // Wrap with recovery
    recoveryMiddleware := recovery.Recovery()
    wrapped := recoveryMiddleware(handler)

    // Call should not panic, should return error
    _, err := wrapped(context.Background(), "test")

    assert.Error(t, err)
    assert.Contains(t, err.Error(), "panic")
}
```

## References

- [Kratos Recovery Middleware](https://go-kratos.dev/docs/component/middleware/recovery)

