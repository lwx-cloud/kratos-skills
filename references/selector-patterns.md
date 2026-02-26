# Selector Patterns

This guide covers load balancing and node selection in kratos.

## Overview

Selector provides client-side load balancing for service discovery. It selects the most appropriate service instance from multiple available nodes.

## Selector Interface

```go
package selector

import (
    "context"
)

// Selector is the load balancer
type Selector interface {
    // Select returns a suitable Node based on the strategy
    Select(ctx context.Context, opts ...SelectOption) (selected Node, done DoneFunc, err error)
    // Update updates the available Nodes
    Update(nodes []Node) error
}

// Node represents a service instance
type Node interface {
    // Address is the service address
    Address() string
    // ServiceName is the service name
    ServiceName() string
    // InitialWeight returns the initial weight
    InitialWeight() *int64
    // Version is the service version
    Version() string
    // Metadata is the service metadata
    Metadata() map[string]string
}
```

## Built-in Selectors

### Random Selector

Randomly selects a node from available instances.

```go
package client

import (
    "github.com/go-kratos/kratos/v2/selector/random"
    "github.com/go-kratos/kratos/v2/transport/grpc"
)

func NewGRPCClient() (*grpc.Client, error) {
    return grpc.DialInsecure(
        context.Background(),
        grpc.WithEndpoint("discovery:///user-service"),
        grpc.WithDiscovery(discovery),
        grpc.WithNodeFilter(func(ctx context.Context, nodes []selector.Node) []selector.Node {
            // Filter nodes by version or metadata
            var filtered []selector.Node
            for _, n := range nodes {
                if n.Version() == "v1.0.0" {
                    filtered = append(filtered, n)
                }
            }
            return filtered
        }),
    )
}
```

### Weighted Random Selector

Selects nodes based on assigned weights.

```go
package client

import (
    "github.com/go-kratos/kratos/v2/selector/weighted"
)

func NewGRPCClient() (*grpc.Client, error) {
    return grpc.DialInsecure(
        context.Background(),
        grpc.WithEndpoint("discovery:///user-service"),
        grpc.WithDiscovery(discovery),
        // Uses weighted selector by default with weighted.New()
    )
}
```

### P2C (Power of Two Choices)

Selects the better of two randomly chosen nodes based on load.

```go
package client

import (
    "github.com/go-kratos/kratos/v2/selector/p2c"
)

func NewGRPCClient() (*grpc.Client, error) {
    return grpc.DialInsecure(
        context.Background(),
        grpc.WithEndpoint("discovery:///user-service"),
        grpc.WithDiscovery(discovery),
        grpc.WithSelector(p2c.New()),
    )
}
```

### WRR (Weighted Round Robin)

Selects nodes in a round-robin fashion respecting weights.

```go
package client

import (
    "github.com/go-kratos/kratos/v2/selector/wrr"
)

func NewGRPCClient() (*grpc.Client, error) {
    return grpc.DialInsecure(
        context.Background(),
        grpc.WithEndpoint("discovery:///user-service"),
        grpc.WithDiscovery(discovery),
        grpc.WithSelector(wrr.New()),
    )
}
```

## Node Filtering

### Custom Node Filter

```go
package client

import (
    "github.com/go-kratos/kratos/v2/selector"
)

// FilterByVersion filters nodes by version
func FilterByVersion(version string) selector.NodeFilter {
    return func(ctx context.Context, nodes []selector.Node) []selector.Node {
        var filtered []selector.Node
        for _, n := range nodes {
            if n.Version() == version {
                filtered = append(filtered, n)
            }
        }
        return filtered
    }
}

// FilterByMetadata filters nodes by metadata
func FilterByMetadata(key, value string) selector.NodeFilter {
    return func(ctx context.Context, nodes []selector.Node) []selector.Node {
        var filtered []selector.Node
        for _, n := range nodes {
            if v, ok := n.Metadata()[key]; ok && v == value {
                filtered = append(filtered, n)
            }
        }
        return filtered
    }
}

func NewGRPCClient() (*grpc.Client, error) {
    return grpc.DialInsecure(
        context.Background(),
        grpc.WithEndpoint("discovery:///user-service"),
        grpc.WithDiscovery(discovery),
        grpc.WithNodeFilter(
            FilterByVersion("v1.0.0"),
            FilterByMetadata("region", "us-west"),
        ),
    )
}
```

## Custom Selector

### Building a Custom Selector

```go
package selector

import (
    "context"
    "sync"

    "github.com/go-kratos/kratos/v2/selector"
)

// LeastConnectionsSelector selects the node with least active connections
type LeastConnectionsSelector struct {
    nodes []selector.Node
    conns map[string]int
    mu    sync.RWMutex
}

func NewLeastConnections() selector.Selector {
    return &LeastConnectionsSelector{
        conns: make(map[string]int),
    }
}

func (s *LeastConnectionsSelector) Select(ctx context.Context, opts ...selector.SelectOption) (selector.Node, selector.DoneFunc, error) {
    s.mu.RLock()
    defer s.mu.RUnlock()

    if len(s.nodes) == 0 {
        return nil, nil, selector.ErrNoAvailable
    }

    // Find node with least connections
    var selected selector.Node
    minConns := int(^uint(0) >> 1) // Max int

    for _, n := range s.nodes {
        if conns := s.conns[n.Address()]; conns < minConns {
            minConns = conns
            selected = n
        }
    }

    // Increment connection count
    s.mu.RUnlock()
    s.mu.Lock()
    s.conns[selected.Address()]++
    s.mu.Unlock()
    s.mu.RLock()

    done := func(ctx context.Context, di selector.DoneInfo) {
        s.mu.Lock()
        s.conns[selected.Address()]--
        s.mu.Unlock()
    }

    return selected, done, nil
}

func (s *LeastConnectionsSelector) Update(nodes []selector.Node) error {
    s.mu.Lock()
    defer s.mu.Unlock()
    s.nodes = nodes
    return nil
}
```

## Using with HTTP Client

```go
package client

import (
    "github.com/go-kratos/kratos/v2/transport/http"
    "github.com/go-kratos/kratos/v2/selector/random"
)

func NewHTTPClient() (*http.Client, error) {
    return http.NewClient(
        context.Background(),
        http.WithEndpoint("discovery:///user-service"),
        http.WithDiscovery(discovery),
        http.WithSelector(random.New()),
    )
}
```

## Balancer Builder

```go
package client

import (
    "github.com/go-kratos/kratos/v2/selector"
    "github.com/go-kratos/kratos/v2/transport/grpc"
    "google.golang.org/grpc/balancer"
)

// Custom balancer name
const Name = "custom_balancer"

func init() {
    // Register custom balancer
    selector.SetGlobalSelector(NewLeastConnections())
}

func NewGRPCClient() (*grpc.Client, error) {
    return grpc.DialInsecure(
        context.Background(),
        grpc.WithEndpoint("discovery:///user-service"),
        grpc.WithDiscovery(discovery),
        grpc.WithBalancerName(Name),
    )
}
```

## Best Practices

### ✅ Use P2C for Production

```go
// P2C provides good load balancing with minimal overhead
import "github.com/go-kratos/kratos/v2/selector/p2c"

client, err := grpc.DialInsecure(
    context.Background(),
    grpc.WithEndpoint("discovery:///service"),
    grpc.WithDiscovery(discovery),
    grpc.WithSelector(p2c.New()),
)
```

### ✅ Filter Nodes Before Selection

```go
// Filter out unhealthy or unwanted nodes before selection
grpc.WithNodeFilter(
    func(ctx context.Context, nodes []selector.Node) []selector.Node {
        // Only select healthy nodes
        var healthy []selector.Node
        for _, n := range nodes {
            if n.Metadata()["health"] == "healthy" {
                healthy = append(healthy, n)
            }
        }
        return healthy
    },
)
```

### ❌ Don't Use Random in Production

```go
// Avoid pure random for production - it doesn't consider node health
// Use P2C or WRR instead
grpc.WithSelector(random.New()) // ❌ Not recommended for production
```

## References

- [Kratos Selector](https://go-kratos.dev/docs/component/selector)
- [Load Balancing](https://go-kratos.dev/docs/guide/load-balance)

