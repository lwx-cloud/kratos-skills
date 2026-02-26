# Logging Patterns

This guide covers logging patterns in kratos.

## Overview

Kratos provides a simple, pluggable logging interface that can adapt to various logging libraries.

## Core Concepts

| Component | Purpose |
|-----------|---------|
| `Logger` | Low-level interface for adapting log libraries |
| `Helper` | High-level interface with log levels |
| `Filter` | Log filtering/modification |
| `Valuer` | Dynamic log values (timestamp, trace ID, etc.) |

## Basic Usage

### Default Logger

```go
import "github.com/go-kratos/kratos/v2/log"

// Use default logger
log.Info("info message")
log.Warn("warning message")
log.Error("error message")
```

### Helper with Levels

```go
import "github.com/go-kratos/kratos/v2/log"

func main() {
    logger := log.NewStdLogger(os.Stdout)
    helper := log.NewHelper(logger)

    helper.Debug("debug message")
    helper.Info("info message")
    helper.Warn("warning: %s", "something happened")
    helper.Error("error: %v", err)
    helper.Fatal("fatal error") // Will exit

    // With formatting
    helper.Infof("user %s logged in", username)
    helper.Debugw("key", "value") // key-value format
}
```

## Kratos Layout Integration

### Entry Point (main.go)

```go
func main() {
    // Initialize logger
    logger := log.With(log.NewStdLogger(os.Stdout),
        "ts", log.DefaultTimestamp,
        "caller", log.DefaultCaller,
        "service.id", id,
        "service.name", Name,
        "service.version", Version,
    )

    // Inject into layers
    dataData, cleanup, err := data.NewData(bc.Data, logger)
}
```

### Service Layer

```go
type GreeterService struct {
    log *log.Helper
}

func NewGreeterService(uc *biz.GreeterUsecase, logger log.Logger) *GreeterService {
    return &GreeterService{
        uc:  uc,
        log: log.NewHelper(logger),
    }
}

func (s *GreeterService) SayHello(ctx context.Context, req *pb.HelloRequest) (*pb.HelloReply, error) {
    s.log.WithContext(ctx).Infof("SayHello: %s", req.Name)
    return &pb.HelloReply{}, nil
}
```

## Log Adapters

### Zap

```bash
go get github.com/go-kratos/kratos/contrib/log/zap/v2
```

```go
import kratoszap "github.com/go-kratos/kratos/contrib/log/zap/v2"

zapLogger, _ := zap.NewProduction()
logger := kratoszap.NewLogger(zapLogger)

// Use with kratos
helper := log.NewHelper(logger)
helper.Info("message")
```

### Logrus

```bash
go get github.com/go-kratos/kratos/contrib/log/logrus/v2
```

```go
import "github.com/go-kratos/kratos/contrib/log/logrus/v2"

logrusLogger := logrus.New()
logger := logrus.NewLogger(logrusLogger)
```

### Fluentd

```bash
go get github.com/go-kratos/kratos/contrib/log/fluent/v2
```

```go
import "github.com/go-kratos/kratos/contrib/log/fluent/v2"

logger, err := fluent.NewLogger("unix:///var/run/fluent/fluent.sock")
if err != nil {
    log.Fatal(err)
}
```

## Valuers (Dynamic Values)

### Built-in Valuers

```go
// Timestamp
logger := log.With(logger,
    "ts", log.DefaultTimestamp,           // e.g., "2006-01-02T15:04:05Z07:00"
    "ts_unix", log.DefaultTimestampUnix,   // Unix timestamp
)

// Caller
logger := log.With(logger,
    "caller", log.DefaultCaller,           // e.g., "main.go:42"
)

// Trace ID (requires tracing middleware)
logger := log.With(logger,
    "trace_id", tracing.TraceID(),
    "span_id", tracing.SpanID(),
)
```

### Custom Valuer

```go
func RequestID() log.Valuer {
    return func(ctx context.Context) interface{} {
        if ctx == nil {
            return ""
        }
        if id, ok := ctx.Value(requestIDKey{}).(string); ok {
            return id
        }
        return ""
    }
}

// Usage
logger := log.With(logger,
    "request_id", RequestID(),
)
```

## Log Filtering

### Level Filtering

```go
import "github.com/go-kratos/kratos/v2/log"

// Filter level
filteredLogger := log.NewFilter(logger,
    log.FilterLevel(log.LevelInfo), // Only Info and above
)

helper := log.NewHelper(filteredLogger)
helper.Debug("filtered out") // Won't be logged
helper.Info("will be logged")
```

### Key/Value Filtering

```go
// Mask sensitive fields
filteredLogger := log.NewFilter(logger,
    log.FilterKey("password", "token", "secret"),
    log.FilterValue("sensitive-value"),
)

// Custom filter function
filteredLogger := log.NewFilter(logger,
    log.FilterFunc(func(level log.Level, keyvals ...interface{}) bool {
        // Return true to filter out
        for i := 0; i < len(keyvals); i += 2 {
            if keyvals[i] == "password" {
                keyvals[i+1] = "***"
            }
        }
        return false
    }),
)
```

## Structured Logging

```go
// JSON output
logger := log.NewStdLogger(os.Stdout, log.WithEncoder(log.JsonEncoder))

helper := log.NewHelper(logger)
helper.Infow(
    "msg", "user action",
    "action", "login",
    "user_id", "123",
    "ip", "192.168.1.1",
)
// Output: {"level":"info","msg":"user action","action":"login","user_id":"123","ip":"192.168.1.1"}
```

## Contextual Logging

```go
// Add context to all logs
func RequestMiddleware(logger log.Logger) middleware.Middleware {
    return func(handler middleware.Handler) middleware.Handler {
        return func(ctx context.Context, req interface{}) (interface{}, error) {
            requestID := generateRequestID()
            ctx = context.WithValue(ctx, requestIDKey{}, requestID)

            // Create contextual logger
            ctxLogger := log.WithContext(ctx, logger)
            ctx = log.NewContext(ctx, ctxLogger)

            return handler(ctx, req)
        }
    }
}
```

## References

- [Kratos Logging](https://go-kratos.dev/docs/component/log)
- [Zap Logger](https://github.com/uber-go/zap)
- [Logrus](https://github.com/sirupsen/logrus)
