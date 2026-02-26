# Tracing (OpenTelemetry) Patterns

This guide covers distributed tracing with OpenTelemetry in kratos.

## Overview

Kratos uses [OpenTelemetry](https://opentelemetry.io/) for distributed tracing, supporting Jaeger, Zipkin, and other OTLP-compatible backends.

## Installation

```bash
go get github.com/go-kratos/kratos/v2/middleware/tracing
go get go.opentelemetry.io/otel
go get go.opentelemetry.io/otel/exporters/jaeger
go get go.opentelemetry.io/otel/sdk/trace
```

## Basic Setup

### 1. Initialize Tracer Provider

```go
package main

import (
    "go.opentelemetry.io/otel/attribute"
    "go.opentelemetry.io/otel/exporters/jaeger"
    "go.opentelemetry.io/otel/sdk/resource"
    sdktrace "go.opentelemetry.io/otel/sdk/trace"
    semconv "go.opentelemetry.io/otel/semconv/v1.4.0"
)

func initTracer(serviceName, endpoint string) (*sdktrace.TracerProvider, error) {
    // Create Jaeger exporter
    exp, err := jaeger.New(
        jaeger.WithCollectorEndpoint(
            jaeger.WithEndpoint(endpoint),
        ),
    )
    if err != nil {
        return nil, err
    }

    tp := sdktrace.NewTracerProvider(
        sdktrace.WithBatcher(exp),
        sdktrace.WithResource(resource.NewWithAttributes(
            semconv.SchemaURL,
            semconv.ServiceNameKey.String(serviceName),
            attribute.String("environment", "production"),
            attribute.String("version", "1.0.0"),
        )),
    )

    return tp, nil
}
```

### 2. Server Tracing

```go
package server

import (
    "github.com/go-kratos/kratos/v2/middleware/tracing"
    "github.com/go-kratos/kratos/v2/transport/http"
    sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

func NewHTTPServer(c *conf.Server, tp *sdktrace.TracerProvider, logger log.Logger) *http.Server {
    var opts = []http.ServerOption{
        http.Middleware(
            recovery.Recovery(),
            tracing.Server(
                tracing.WithTracerProvider(tp),
            ),
            logging.Server(logger),
        ),
    }

    return http.NewServer(opts...)
}
```

### 3. Client Tracing

```go
package client

import (
    "github.com/go-kratos/kratos/v2/middleware/tracing"
    "github.com/go-kratos/kratos/v2/transport/grpc"
)

func NewGRPCClient(tp *sdktrace.TracerProvider) (*grpc.ClientConn, error) {
    return grpc.DialInsecure(
        context.Background(),
        grpc.WithEndpoint("discovery:///helloworld"),
        grpc.WithMiddleware(
            tracing.Client(
                tracing.WithTracerProvider(tp),
            ),
        ),
    )
}
```

## Extracting Trace Information

### From Context

```go
import (
    "go.opentelemetry.io/otel/trace"
)

func (s *UserService) GetUser(ctx context.Context, req *pb.GetUserRequest) (*pb.User, error) {
    span := trace.SpanFromContext(ctx)

    // Get trace ID
    traceID := span.SpanContext().TraceID().String()

    // Add to logs
    s.log.WithContext(ctx).Infof("Processing request, trace_id=%s", traceID)

    // ... business logic
}
```

### Custom Span Attributes

```go
func (uc *UserUsecase) CreateUser(ctx context.Context, u *biz.User) (*biz.User, error) {
    span := trace.SpanFromContext(ctx)

    // Add attributes
    span.SetAttributes(
        attribute.String("user.email", u.Email),
        attribute.Int64("user.id", u.ID),
    )

    // Add event
    span.AddEvent("validating user", trace.WithAttributes(
        attribute.String("validation.type", "email"),
    ))

    return uc.repo.Save(ctx, u)
}
```

## Manual Span Creation

```go
import (
    "go.opentelemetry.io/otel"
    "go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("user-service")

func (uc *UserUsecase) ComplexOperation(ctx context.Context) error {
    // Create child span
    ctx, span := tracer.Start(ctx, "ComplexOperation",
        trace.WithAttributes(
            attribute.String("operation.type", "batch"),
        ),
    )
    defer span.End()

    // Step 1
    ctx, step1Span := tracer.Start(ctx, "Step1")
    if err := uc.doStep1(ctx); err != nil {
        step1Span.RecordError(err)
        span.SetStatus(codes.Error, "step 1 failed")
        return err
    }
    step1Span.End()

    // Step 2
    ctx, step2Span := tracer.Start(ctx, "Step2")
    if err := uc.doStep2(ctx); err != nil {
        step2Span.RecordError(err)
        span.SetStatus(codes.Error, "step 2 failed")
        return err
    }
    step2Span.End()

    span.SetStatus(codes.Ok, "success")
    return nil
}
```

## Propagating Trace Context

### HTTP to gRPC

```go
func (s *GatewayService) ProxyRequest(ctx context.Context, req *pb.Request) (*pb.Response, error) {
    // Extract trace from incoming HTTP
    propagator := propagation.TraceContext{}
    carrier := propagation.HeaderCarrier(metadata.MD{})
    propagator.Inject(ctx, carrier)

    // Pass to gRPC client
    ctx = metadata.NewOutgoingContext(ctx, metadata.MD(carrier))

    return s.grpcClient.Call(ctx, req)
}
```

## Different Exporters

### Jaeger

```go
import "go.opentelemetry.io/otel/exporters/jaeger"

exp, err := jaeger.New(
    jaeger.WithAgentEndpoint(
        jaeger.WithAgentHost("localhost"),
        jaeger.WithAgentPort("6831"),
    ),
)
// or
exp, err := jaeger.New(
    jaeger.WithCollectorEndpoint(
        jaeger.WithEndpoint("http://localhost:14268/api/traces"),
    ),
)
```

### OTLP (OpenTelemetry Protocol)

```go
import "go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"

exp, err := otlptracegrpc.New(ctx,
    otlptracegrpc.WithEndpoint("localhost:4317"),
    otlptracegrpc.WithInsecure(),
)
```

### Zipkin

```go
import "go.opentelemetry.io/otel/exporters/zipkin"

exp, err := zipkin.New("http://localhost:9411/api/v2/spans")
```

## Sampling Configuration

```go
// Always sample (development)
tp := sdktrace.NewTracerProvider(
    sdktrace.WithSampler(sdktrace.AlwaysSample()),
)

// Never sample (testing)
tp := sdktrace.NewTracerProvider(
    sdktrace.WithSampler(sdktrace.NeverSample()),
)

// Probability sampling (production)
tp := sdktrace.NewTracerProvider(
    sdktrace.WithSampler(sdktrace.TraceIDRatioBased(0.1)), // 10% sampling
)

// Parent-based with fallback
tp := sdktrace.NewTracerProvider(
    sdktrace.WithSampler(sdktrace.ParentBased(
        sdktrace.TraceIDRatioBased(0.1),
    )),
)
```

## References

- [Kratos Tracing](https://go-kratos.dev/docs/component/middleware/tracing)
- [OpenTelemetry Go](https://opentelemetry.io/docs/instrumentation/go/)
- [Jaeger](https://www.jaegertracing.io/)
