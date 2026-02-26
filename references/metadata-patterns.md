# Metadata Patterns

This guide covers metadata propagation in kratos for distributed tracing and context passing.

## Overview

Metadata allows passing information between services without modifying request/response payloads. Common use cases:
- Authentication tokens
- Request IDs
- Trace context
- User context

## Server-Side Metadata

### Reading Metadata

```go
package service

import (
    "github.com/go-kratos/kratos/v2/metadata"
)

func (s *UserService) GetUser(ctx context.Context, req *pb.GetUserRequest) (*pb.User, error) {
    // Get metadata from context
    md, ok := metadata.FromServerContext(ctx)
    if !ok {
        return nil, errors.Unauthorized("MISSING_METADATA", "metadata not found")
    }

    // Read specific key
    userID := md.Get("x-user-id")
    requestID := md.Get("x-request-id")

    s.log.WithContext(ctx).Infof("Request from user: %s", userID)

    return s.uc.GetUser(ctx, req.Id)
}
```

### Setting Response Metadata

```go
func (s *UserService) GetUser(ctx context.Context, req *pb.GetUserRequest) (*pb.User, error) {
    if tr, ok := transport.FromServerContext(ctx); ok {
        tr.ReplyHeader().Set("x-custom-header", "value")
        tr.ReplyHeader().Set("x-request-id", generateRequestID())
    }

    return s.uc.GetUser(ctx, req.Id)
}
```

## Client-Side Metadata

### Sending Metadata

```go
package client

import (
    "github.com/go-kratos/kratos/v2/metadata"
    "github.com/go-kratos/kratos/v2/transport/grpc"
)

func callService(ctx context.Context) {
    // Add metadata to context
    ctx = metadata.AppendToClientContext(ctx,
        "x-user-id", "12345",
        "x-request-id", generateRequestID(),
        "x-trace-id", traceID,
    )

    resp, err := client.GetUser(ctx, &pb.GetUserRequest{Id: "1"})
}
```

## Metadata Middleware

### Custom Metadata Middleware

```go
package middleware

import (
    "github.com/go-kratos/kratos/v2/metadata"
    "github.com/go-kratos/kratos/v2/middleware"
    "github.com/go-kratos/kratos/v2/transport"
)

func Metadata() middleware.Middleware {
    return func(handler middleware.Handler) middleware.Handler {
        return func(ctx context.Context, req interface{}) (reply interface{}, err error) {
            if tr, ok := transport.FromServerContext(ctx); ok {
                // Extract metadata from transport
                md := metadata.MD{}

                // Copy headers to metadata
                for _, key := range []string{"x-user-id", "x-request-id", "x-trace-id"} {
                    if val := tr.RequestHeader().Get(key); val != "" {
                        md.Set(key, val)
                    }
                }

                ctx = metadata.NewServerContext(ctx, md)
            }

            return handler(ctx, req)
        }
    }
}
```

## References

- [Kratos Metadata](https://go-kratos.dev/docs/component/metadata)
