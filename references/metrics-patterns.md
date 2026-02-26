# Metrics Patterns

This guide covers metrics collection with Prometheus in kratos.

## Overview

Kratos provides metrics middleware for collecting request metrics, compatible with Prometheus.

## Installation

```bash
go get github.com/go-kratos/kratos/v2/middleware/metrics
go get github.com/prometheus/client_golang/prometheus
```

## Basic Usage

### Server Metrics

```go
package server

import (
    "github.com/go-kratos/kratos/v2/middleware/metrics"
    "github.com/go-kratos/kratos/v2/transport/http"
    "github.com/prometheus/client_golang/prometheus"
)

func NewHTTPServer(c *conf.Server, logger log.Logger) *http.Server {
    // Create metrics collectors
    requestDuration := prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "http_request_duration_seconds",
            Help:    "HTTP request duration in seconds",
            Buckets: prometheus.DefBuckets,
        },
        []string{"method", "path"},
    )

    requestCount := prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "http_request_total",
            Help: "Total number of HTTP requests",
        },
        []string{"method", "path", "status"},
    )

    // Register collectors
    prometheus.MustRegister(requestDuration, requestCount)

    var opts = []http.ServerOption{
        http.Middleware(
            recovery.Recovery(),
            metrics.Server(
                metrics.WithSeconds(requestDuration),
                metrics.WithRequests(requestCount),
            ),
            logging.Server(logger),
        ),
    }

    return http.NewServer(opts...)
}
```

### Metrics Endpoint

```go
package server

import (
    "github.com/gorilla/mux"
    "github.com/prometheus/client_golang/prometheus/promhttp"
)

// Add metrics route
func NewMetricsServer(addr string) *http.Server {
    router := mux.NewRouter()
    router.Handle("/metrics", promhttp.Handler())

    return &http.Server{
        Addr:    addr,
        Handler: router,
    }
}
```

## Custom Metrics

### Counter

```go
var (
    userCreatedCounter = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "user_created_total",
            Help: "Total number of users created",
        },
        []string{"source"},
    )
)

func init() {
    prometheus.MustRegister(userCreatedCounter)
}

func (uc *UserUsecase) CreateUser(ctx context.Context, u *User) (*User, error) {
    // ... create user

    userCreatedCounter.WithLabelValues("api").Inc()

    return user, nil
}
```

### Gauge

```go
var (
    activeConnections = prometheus.NewGaugeVec(
        prometheus.GaugeOpts{
            Name: "active_connections",
            Help: "Number of active connections",
        },
        []string{"service"},
    )
)

func (s *Server) handleConnection(conn net.Conn) {
    activeConnections.WithLabelValues("grpc").Inc()
    defer activeConnections.WithLabelValues("grpc").Dec()

    // ... handle connection
}
```

### Histogram

```go
var (
    dbQueryDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "db_query_duration_seconds",
            Help:    "Database query duration in seconds",
            Buckets: []float64{0.001, 0.01, 0.1, 0.5, 1, 2, 5},
        },
        []string{"operation", "table"},
    )
)

func (r *userRepo) GetByID(ctx context.Context, id int64) (*User, error) {
    start := time.Now()
    defer func() {
        dbQueryDuration.WithLabelValues("select", "user").Observe(time.Since(start).Seconds())
    }()

    // ... query database
}
```

## References

- [Kratos Metrics](https://go-kratos.dev/docs/component/metrics)
- [Prometheus Go Client](https://github.com/prometheus/client_golang)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/naming/)
