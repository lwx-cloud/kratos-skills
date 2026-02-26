# Transport Patterns

This guide covers HTTP and gRPC transport patterns in kratos.

## Overview

Kratos provides unified transport abstractions for HTTP and gRPC:
- `transport/http` - HTTP server and client based on gorilla/mux
- `transport/grpc` - gRPC server and client

Both implement the `Transporter` interface for consistency.

## HTTP Server

### Basic Server Configuration

```go
package server

import (
    "github.com/go-kratos/kratos/v2/log"
    "github.com/go-kratos/kratos/v2/middleware/recovery"
    "github.com/go-kratos/kratos/v2/middleware/logging"
    "github.com/go-kratos/kratos/v2/transport/http"
    v1 "helloworld/api/helloworld/v1"
    "helloworld/internal/service"
)

func NewHTTPServer(c *conf.Server, greeter *service.GreeterService, logger log.Logger) *http.Server {
    var opts = []http.ServerOption{
        http.Middleware(
            recovery.Recovery(),
            logging.Server(logger),
        ),
    }

    if c.Http.Network != "" {
        opts = append(opts, http.Network(c.Http.Network))
    }
    if c.Http.Addr != "" {
        opts = append(opts, http.Address(c.Http.Addr))
    }
    if c.Http.Timeout != nil {
        opts = append(opts, http.Timeout(c.Http.Timeout.AsDuration()))
    }

    srv := http.NewServer(opts...)
    v1.RegisterGreeterHTTPServer(srv, greeter)
    return srv
}
```

### Server Options

```go
// Network configuration (default: tcp)
http.Network("tcp")

// Address binding (default: :0 - random port)
http.Address(":8000")

// Request timeout
http.Timeout(time.Second * 5)

// Custom logger
http.Logger(logger)

// Middleware chain
http.Middleware(
    recovery.Recovery(),
    logging.Server(logger),
    validate.Validator(),
)

// Request decoder (default: JSON)
http.RequestDecoder(customDecoder)

// Response encoder (default: JSON)
http.ResponseEncoder(customEncoder)

// Error encoder
http.ErrorEncoder(customErrorEncoder)

// TLS configuration
http.TLSConfig(&tls.Config{
    Certificates: []tls.Certificate{cert},
})

// Route filters
http.Filter(filterFunc1, filterFunc2)
```

### Custom Encoders/Decoders

```go
// Custom Response Encoder
func CustomResponseEncoder(w http.ResponseWriter, r *http.Request, v interface{}) error {
    codec, _ := http.CodecForRequest(r, "Accept")
    data, err := codec.Marshal(v)
    if err != nil {
        return err
    }
    w.Header().Set("Content-Type", httputil.ContentType(codec.Name()))
    w.Header().Set("X-Custom-Header", "value")
    w.Write(data)
    return nil
}

// Use in server
srv := http.NewServer(
    http.ResponseEncoder(CustomResponseEncoder),
)
```

## HTTP Client

### Basic Client

```go
conn, err := http.NewClient(
    context.Background(),
    http.WithEndpoint("127.0.0.1:8000"),
)
if err != nil {
    log.Fatal(err)
}
defer conn.Close()

// Make request
client := v1.NewGreeterHTTPClient(conn)
reply, err := client.SayHello(context.Background(), &v1.HelloRequest{Name: "kratos"})
```

### Client with Middleware

```go
conn, err := http.NewClient(
    context.Background(),
    http.WithEndpoint("127.0.0.1:8000"),
    http.WithMiddleware(
        recovery.Recovery(),
        logging.Client(logger),
    ),
    http.WithTimeout(time.Second * 5),
)
```

### Client with Service Discovery

```go
conn, err := http.NewClient(
    context.Background(),
    http.WithEndpoint("discovery:///helloworld"),
    http.WithDiscovery(discovery),
    http.WithBalancer(wrr.NewBuilder()),
)
```

## gRPC Server

### Basic Server Configuration

```go
package server

import (
    "github.com/go-kratos/kratos/v2/log"
    "github.com/go-kratos/kratos/v2/middleware/recovery"
    "github.com/go-kratos/kratos/v2/middleware/logging"
    "github.com/go-kratos/kratos/v2/transport/grpc"
    v1 "helloworld/api/helloworld/v1"
    "helloworld/internal/service"
)

func NewGRPCServer(c *conf.Server, greeter *service.GreeterService, logger log.Logger) *grpc.Server {
    var opts = []grpc.ServerOption{
        grpc.Middleware(
            recovery.Recovery(),
            logging.Server(logger),
        ),
    }

    if c.Grpc.Network != "" {
        opts = append(opts, grpc.Network(c.Grpc.Network))
    }
    if c.Grpc.Addr != "" {
        opts = append(opts, grpc.Address(c.Grpc.Addr))
    }
    if c.Grpc.Timeout != nil {
        opts = append(opts, grpc.Timeout(c.Grpc.Timeout.AsDuration()))
    }

    srv := grpc.NewServer(opts...)
    v1.RegisterGreeterServer(srv, greeter)
    return srv
}
```

### gRPC Server Options

```go
// Network configuration
grpc.Network("tcp")

// Address binding
grpc.Address(":9000")

// Request timeout
grpc.Timeout(time.Second * 5)

// Middleware chain
grpc.Middleware(
    recovery.Recovery(),
    logging.Server(logger),
)

// TLS configuration
grpc.TLSConfig(&tls.Config{
    Certificates: []tls.Certificate{cert},
})

// Unary interceptors (native gRPC)
grpc.UnaryInterceptor(interceptor1, interceptor2)

// Stream interceptors
grpc.StreamInterceptor(interceptor1, interceptor2)
```

## gRPC Client

### Basic Client

```go
conn, err := grpc.DialInsecure(
    context.Background(),
    grpc.WithEndpoint("127.0.0.1:9000"),
)
if err != nil {
    log.Fatal(err)
}
defer conn.Close()

// Use client
client := v1.NewGreeterClient(conn)
reply, err := client.SayHello(context.Background(), &v1.HelloRequest{Name: "kratos"})
```

### Client with TLS

```go
conn, err := grpc.Dial(
    context.Background(),
    grpc.WithEndpoint("secure-server:443"),
    grpc.WithTLSConfig(&tls.Config{
        ServerName: "secure-server",
    }),
)
```

### Client with Discovery

```go
conn, err := grpc.DialInsecure(
    context.Background(),
    grpc.WithEndpoint("discovery:///helloworld"),
    grpc.WithDiscovery(etcdDiscovery),
    grpc.WithNodeFilter(filter.Version("2.0.0")),
)
```

## ✅ Correct vs ❌ Incorrect Examples

### ✅ Correct: Server Initialization

```go
// Use dependency injection, accept config
func NewHTTPServer(c *conf.Server, greeter *service.GreeterService, logger log.Logger) *http.Server {
    srv := http.NewServer(
        http.Address(c.Http.Addr),
        http.Middleware(
            recovery.Recovery(),
            logging.Server(logger),
        ),
    )
    v1.RegisterGreeterHTTPServer(srv, greeter)
    return srv
}
```

### ❌ Incorrect: Hard-coded Configuration

```go
// Wrong: hard-coded values, no DI
func NewHTTPServer() *http.Server {
    srv := http.NewServer(
        http.Address(":8000"),  // Hard-coded!
    )
    // Missing middleware
    return srv
}
```

### ✅ Correct: Proper Error Handling

```go
conn, err := http.NewClient(ctx, http.WithEndpoint(endpoint))
if err != nil {
    return fmt.Errorf("failed to create client: %w", err)
}
defer conn.Close()
```

### ❌ Incorrect: Ignoring Errors

```go
// Wrong: ignoring error
conn, _ := http.NewClient(ctx, http.WithEndpoint(endpoint))
// Missing defer close
```

### ✅ Correct: Context Propagation

```go
func (s *Service) Call(ctx context.Context, req *Request) (*Response, error) {
    // Pass context to client calls
    resp, err := s.client.SayHello(ctx, &pb.HelloRequest{Name: req.Name})
    if err != nil {
        return nil, err
    }
    return &Response{Message: resp.Message}, nil
}
```

### ❌ Incorrect: Background Context

```go
func (s *Service) Call(ctx context.Context, req *Request) (*Response, error) {
    // Wrong: losing context propagation
    resp, err := s.client.SayHello(context.Background(), &pb.HelloRequest{Name: req.Name})
    // ...
}
```

## Transport Context

### Accessing Transport Information

```go
import "github.com/go-kratos/kratos/v2/transport"

func middleware(handler middleware.Handler) middleware.Handler {
    return func(ctx context.Context, req interface{}) (reply interface{}, err error) {
        if tr, ok := transport.FromServerContext(ctx); ok {
            kind := tr.Kind()           // "http" or "grpc"
            endpoint := tr.Endpoint()    // server address
            operation := tr.Operation()  // path: /helloworld.Greeter/SayHello

            // HTTP specific
            if ht, ok := tr.(*http.Transport); ok {
                request := ht.Request()
                header := request.Header
            }

            // gRPC specific
            if gt, ok := tr.(*grpc.Transport); ok {
                header := gt.RequestHeader()
            }
        }
        return handler(ctx, req)
    }
}
```

## Dual Transport Registration

### Registering Both HTTP and gRPC

```go
// cmd/server/wire.go
func wireApp(*conf.Server, *conf.Data, log.Logger) (*kratos.App, error) {
    panic(wire.Build(server.ProviderSet, data.ProviderSet, biz.ProviderSet,
        service.ProviderSet, newApp))
}

// cmd/server/main.go
func newApp(logger log.Logger, hs *http.Server, gs *grpc.Server) *kratos.App {
    return kratos.New(
        kratos.Name(Name),
        kratos.Version(Version),
        kratos.Metadata(map[string]string{}),
        kratos.Logger(logger),
        kratos.Server(
            hs,  // HTTP server
            gs,  // gRPC server
        ),
    )
}
```

## References

- [Kratos HTTP Transport](https://go-kratos.dev/docs/component/transport/http)
- [Kratos gRPC Transport](https://go-kratos.dev/docs/component/transport/grpc)
- [gorilla/mux](https://github.com/gorilla/mux)
- [gRPC Go](https://github.com/grpc/grpc-go)
