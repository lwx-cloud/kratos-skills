# Service Discovery Patterns

This guide covers service discovery and registration patterns in kratos.

## Overview

Kratos provides a unified registry interface for service discovery:
- **Registrar**: Register/deregister services
- **Discovery**: Discover service instances
- **Selector**: Client-side load balancing

## Registry Interface

```go
// Registrar for service registration
type Registrar interface {
    Register(ctx context.Context, service *ServiceInstance) error
    Deregister(ctx context.Context, service *ServiceInstance) error
}

// Discovery for service discovery
type Discovery interface {
    Fetch(ctx context.Context, serviceName string) ([]*ServiceInstance, error)
    Watch(ctx context.Context, serviceName string) (Watcher, error)
}

// ServiceInstance represents a service instance
type ServiceInstance struct {
    ID        string            `json:"id"`
    Name      string            `json:"name"`
    Version   string            `json:"version"`
    Metadata  map[string]string `json:"metadata"`
    Endpoints []string          `json:"endpoints"`
}
```

## Supported Registries

| Registry | Import Path |
|----------|-------------|
| etcd | `github.com/go-kratos/kratos/contrib/registry/etcd/v2` |
| Consul | `github.com/go-kratos/consul/registry` |
| Nacos | `github.com/go-kratos/kratos/contrib/registry/nacos/v2` |
| Kubernetes | `github.com/go-kratos/kratos/contrib/registry/kubernetes/v2` |
| Polaris | `github.com/go-kratos/kratos/contrib/registry/polaris/v2` |
| Zookeeper | `github.com/go-kratos/kratos/contrib/registry/zookeeper/v2` |

## Service Registration

### etcd Registration

```go
package main

import (
    "github.com/go-kratos/kratos/contrib/registry/etcd/v2"
    "github.com/go-kratos/kratos/v2"
    clientv3 "go.etcd.io/etcd/client/v3"
)

func main() {
    // Create etcd client
    cli, err := clientv3.New(clientv3.Config{
        Endpoints: []string{"127.0.0.1:2379"},
    })
    if err != nil {
        panic(err)
    }

    // Create registrar
    reg := etcd.New(cli)

    // Create app with registrar
    app := kratos.New(
        kratos.Name("helloworld"),
        kratos.Version("v1.0.0"),
        kratos.Metadata(map[string]string{"region": "cn"}),
        kratos.Server(hs, gs),
        kratos.Registrar(reg),  // Enable auto-registration
    )

    if err := app.Run(); err != nil {
        panic(err)
    }
}
```

### Consul Registration

```go
import (
    "github.com/go-kratos/consul/registry"
    "github.com/hashicorp/consul/api"
)

func main() {
    // Create Consul client
    consulClient, err := api.NewClient(api.DefaultConfig())
    if err != nil {
        panic(err)
    }

    // Create registrar
    reg := registry.New(consulClient)

    app := kratos.New(
        kratos.Name("helloworld"),
        kratos.Version("v1.0.0"),
        kratos.Registrar(reg),
        // ...
    )
    // ...
}
```

### Nacos Registration

```go
import (
    "github.com/go-kratos/kratos/contrib/registry/nacos/v2"
    "github.com/nacos-group/nacos-sdk-go/v2/clients"
    "github.com/nacos-group/nacos-sdk-go/v2/common/constant"
    "github.com/nacos-group/nacos-sdk-go/v2/vo"
)

func main() {
    clientConfig := constant.ClientConfig{
        NamespaceId: "public",
    }
    serverConfigs := []constant.ServerConfig{
        {IpAddr: "127.0.0.1", Port: 8848},
    }

    client, err := clients.NewNamingClient(
        vo.NacosClientParam{
            ClientConfig:  &clientConfig,
            ServerConfigs: serverConfigs,
        },
    )
    if err != nil {
        panic(err)
    }

    reg := nacos.New(client)

    app := kratos.New(
        kratos.Name("helloworld"),
        kratos.Version("v1.0.0"),
        kratos.Registrar(reg),
        // ...
    )
    // ...
}
```

## Service Discovery

### Discovering with etcd

```go
import (
    "github.com/go-kratos/kratos/contrib/registry/etcd/v2"
    "github.com/go-kratos/kratos/v2/transport/grpc"
    clientv3 "go.etcd.io/etcd/client/v3"
)

func main() {
    cli, err := clientv3.New(clientv3.Config{
        Endpoints: []string{"127.0.0.1:2379"},
    })
    if err != nil {
        panic(err)
    }

    // Create discovery
    dis := etcd.New(cli)

    // Create gRPC client with discovery
    conn, err := grpc.DialInsecure(
        context.Background(),
        grpc.WithEndpoint("discovery:///helloworld"),
        grpc.WithDiscovery(dis),
    )
    if err != nil {
        panic(err)
    }
    defer conn.Close()

    // Use client
    client := pb.NewGreeterClient(conn)
    resp, err := client.SayHello(context.Background(), &pb.HelloRequest{Name: "kratos"})
    // ...
}
```

### HTTP Client with Discovery

```go
import (
    "github.com/go-kratos/kratos/contrib/registry/etcd/v2"
    "github.com/go-kratos/kratos/v2/transport/http"
)

func main() {
    dis := etcd.New(cli)

    conn, err := http.NewClient(
        context.Background(),
        http.WithEndpoint("discovery:///helloworld"),
        http.WithDiscovery(dis),
    )
    if err != nil {
        panic(err)
    }
    defer conn.Close()

    client := pb.NewGreeterHTTPClient(conn)
    resp, err := client.SayHello(context.Background(), &pb.HelloRequest{Name: "kratos"})
    // ...
}
```

## Load Balancing

### Selector Interface

```go
type Selector interface {
    Select(ctx context.Context, opts ...SelectOption) (selected Node, done DoneFunc, err error)
}

type Node interface {
    Address() string
    Weight() float64
    Version() string
    Metadata() map[string]string
}
```

### Built-in Algorithms

| Algorithm | Import | Description |
|-----------|--------|-------------|
| WRR | `selector/wrr` | Weighted Round Robin (default) |
| P2C | `selector/p2c` | Power of Two Choices |
| Random | `selector/random` | Random selection |

### Using Load Balancer

```go
import (
    "github.com/go-kratos/kratos/v2/selector/wrr"
    "github.com/go-kratos/kratos/v2/selector/filter"
)

func main() {
    // Set global selector (affects all clients)
    selector.SetGlobalSelector(wrr.NewBuilder())

    // Or use with specific client
    conn, err := grpc.DialInsecure(
        context.Background(),
        grpc.WithEndpoint("discovery:///helloworld"),
        grpc.WithDiscovery(dis),
    )
    // ...
}
```

### Node Filtering

```go
import "github.com/go-kratos/kratos/v2/selector/filter"

// Filter by version
versionFilter := filter.Version("v2.0.0")

conn, err := grpc.DialInsecure(
    context.Background(),
    grpc.WithEndpoint("discovery:///helloworld"),
    grpc.WithDiscovery(dis),
    grpc.WithNodeFilter(versionFilter),
)

// Multiple filters
conn, err := grpc.DialInsecure(
    context.Background(),
    grpc.WithEndpoint("discovery:///helloworld"),
    grpc.WithDiscovery(dis),
    grpc.WithNodeFilter(
        filter.Version("v2.0.0"),
        filter.Metadata("region", "cn"),
    ),
)
```

### Custom Filter

```go
nodeFilter := func(ctx context.Context, nodes []selector.Node) []selector.Node {
    filtered := make([]selector.Node, 0, len(nodes))
    for _, n := range nodes {
        // Custom filtering logic
        if n.Metadata()["env"] == "production" {
            filtered = append(filtered, n)
        }
    }
    return filtered
}

conn, err := grpc.DialInsecure(
    context.Background(),
    grpc.WithEndpoint("discovery:///helloworld"),
    grpc.WithDiscovery(dis),
    grpc.WithNodeFilter(nodeFilter),
)
```

## ✅ Correct vs ❌ Incorrect Examples

### ✅ Correct: Using Discovery URL

```go
// Correct: use discovery URL
conn, err := grpc.DialInsecure(
    context.Background(),
    grpc.WithEndpoint("discovery:///helloworld"),
    grpc.WithDiscovery(dis),
)
```

### ❌ Incorrect: Hard-coded Endpoint

```go
// Wrong: hard-coded endpoint
conn, err := grpc.DialInsecure(
    context.Background(),
    grpc.WithEndpoint("127.0.0.1:9000"),  // Won't work with multiple instances
)
```

### ✅ Correct: Proper Registry Setup

```go
// Correct: registry with kratos app
app := kratos.New(
    kratos.Name("helloworld"),
    kratos.Version("v1.0.0"),
    kratos.Metadata(map[string]string{
        "region": "cn",
        "zone": "zone1",
    }),
    kratos.Registrar(reg),
    kratos.Server(hs, gs),
)
```

### ❌ Incorrect: Manual Registration

```go
// Wrong: manual registration without lifecycle management
reg.Register(ctx, &registry.ServiceInstance{
    Name: "helloworld",
    // ...
})
// Missing: deregistration on shutdown
```

## Complete Discovery Workflow

### 1. Start Registry (etcd)

```bash
docker run -d --name etcd \
    -p 2379:2379 \
    -p 2380:2380 \
    quay.io/coreos/etcd:latest \
    /usr/local/bin/etcd \
    --listen-client-urls http://0.0.0.0:2379 \
    --advertise-client-urls http://0.0.0.0:2379
```

### 2. Service Registration

```go
// Server main.go
func main() {
    cli, _ := clientv3.New(clientv3.Config{
        Endpoints: []string{"127.0.0.1:2379"},
    })
    reg := etcd.New(cli)

    hs := server.NewHTTPServer(cfg, svc, logger)
    gs := server.NewGRPCServer(cfg, svc, logger)

    app := kratos.New(
        kratos.ID(id),
        kratos.Name("helloworld"),
        kratos.Version(version),
        kratos.Metadata(map[string]string{}),
        kratos.Logger(logger),
        kratos.Server(hs, gs),
        kratos.Registrar(reg),
    )

    if err := app.Run(); err != nil {
        log.Fatal(err)
    }
}
```

### 3. Service Discovery

```go
// Client main.go
func main() {
    cli, _ := clientv3.New(clientv3.Config{
        Endpoints: []string{"127.0.0.1:2379"},
    })
    dis := etcd.New(cli)

    conn, _ := grpc.DialInsecure(
        context.Background(),
        grpc.WithEndpoint("discovery:///helloworld"),
        grpc.WithDiscovery(dis),
    )
    defer conn.Close()

    client := pb.NewGreeterClient(conn)
    resp, _ := client.SayHello(context.Background(), &pb.HelloRequest{Name: "world"})
    fmt.Println(resp.Message)
}
```

## References

- [Kratos Registry](https://go-kratos.dev/docs/component/registry)
- [Kratos Selector](https://go-kratos.dev/docs/component/selector)
- [etcd](https://etcd.io/)
- [Consul](https://www.consul.io/)
- [Nacos](https://nacos.io/)
