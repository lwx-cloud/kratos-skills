# Transport Patterns

> HTTP and gRPC options follow the [compatibility baseline](compatibility.md). Use the target repository's server constructors, middleware order, and client lifecycle.

## Contents

- [Construct servers](#construct-servers)
- [Construct clients](#construct-clients)
- [Configure discovery and TLS](#configure-discovery-and-tls)
- [Preserve transport context](#preserve-transport-context)
- [Register transports in the application](#register-transports-in-the-application)
- [Verification](#verification)

## Construct servers

Inject typed configuration, services, and middleware into transport constructors:

```go
package server

import (
	"github.com/go-kratos/kratos/v2/transport/http"

	v1 "example.com/project/api/user/v1"
	"example.com/project/internal/conf"
	"example.com/project/internal/service"
)

func NewHTTPServer(c *conf.Server, svc *service.UserService, extra ...http.ServerOption) *http.Server {
	options := append([]http.ServerOption{
		http.Network(c.Http.Network),
		http.Address(c.Http.Addr),
		http.Timeout(c.Http.Timeout.AsDuration()),
	}, extra...)

	srv := http.NewServer(options...)
	v1.RegisterUserServiceHTTPServer(srv, svc)
	return srv
}
```

Use the equivalent gRPC options and register the generated gRPC service. Keep middleware construction separate when it has dependencies of its own.

Server timeouts bound handler execution. Coordinate them with ingress, client, database, and shutdown budgets.

## Construct clients

Create clients through dependency injection and return their cleanup path:

```go
package client

import (
	"context"
	"time"

	kratosgrpc "github.com/go-kratos/kratos/v2/transport/grpc"
	"google.golang.org/grpc"
)

func NewGRPC(ctx context.Context, endpoint string) (*grpc.ClientConn, error) {
	return kratosgrpc.DialInsecure(
		ctx,
		kratosgrpc.WithEndpoint(endpoint),
		kratosgrpc.WithTimeout(2*time.Second),
	)
}
```

Use `http.NewClient` for generated Kratos HTTP clients. Set bounded timeouts and close clients during application cleanup. Pass request contexts into generated client calls.

Install client middleware for tracing, metrics, authentication, retries, and circuit breaking according to observable execution order.

## Configure discovery and TLS

Discovery clients use the `discovery:///service-name` endpoint with a `registry.Discovery` implementation:

```go
conn, err := kratosgrpc.DialInsecure(
	ctx,
	kratosgrpc.WithEndpoint("discovery:///user-service"),
	kratosgrpc.WithDiscovery(discovery),
	kratosgrpc.WithNodeFilter(filters...),
)
```

Read [registry patterns](registry-patterns.md) and [selector patterns](selector-patterns.md) for service naming, metadata, builders, and filters.

For TLS clients, use `Dial` plus `WithTLSConfig`. Set `ServerName`, trust roots, minimum protocol version, and client certificates according to deployment policy. Use plaintext dialing only on explicitly trusted paths.

## Preserve transport context

Propagate the incoming context through service, biz, data, and outbound calls. Transport metadata is available through server or client context:

```go
if tr, ok := transport.FromServerContext(ctx); ok {
	operation := tr.Operation()
	headers := tr.RequestHeader()
	_ = operation
	_ = headers
}
```

Use generated operations for logs, metrics, selectors, and policy decisions. Keep HTTP-specific request or response access behind a checked type assertion when it is genuinely required.

## Register transports in the application

Construct all enabled servers through Wire and pass them to the Kratos application:

```go
func newApp(logger log.Logger, hs *http.Server, gs *grpc.Server) *kratos.App {
	return kratos.New(
		kratos.Logger(logger),
		kratos.Server(hs, gs),
	)
}
```

Keep graceful shutdown bounded and include client, telemetry, registry, database, and config cleanup in the application lifecycle.

## Verification

Complete a transport change when:

- generated services are registered on every intended transport;
- server, client, and shutdown timeouts form a coherent budget;
- request context and metadata reach every outbound call;
- TLS and discovery behavior match the deployed environment;
- client and server middleware run on the intended side and order; and
- constructors expose cleanup for every client or listener they own.

## Sources

- [Kratos HTTP transport](https://go-kratos.dev/docs/component/transport/http/)
- [Kratos gRPC transport](https://go-kratos.dev/docs/component/transport/grpc/)
- [gRPC Go](https://github.com/grpc/grpc-go)
