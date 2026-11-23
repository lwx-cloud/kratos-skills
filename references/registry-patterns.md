# Registry and Discovery Patterns

Read [compatibility.md](compatibility.md) before choosing a registry adapter. Inspect the target repository for its existing provider, configuration, and lifecycle wiring before adding another backend.

## Contents

- [Core contracts](#core-contracts)
- [Registration](#registration)
- [Discovery clients](#discovery-clients)
- [Instances and selection](#instances-and-selection)
- [Operational behavior](#operational-behavior)
- [Verification](#verification)

## Core Contracts

Kratos separates server registration from client discovery:

```go
type Registrar interface {
    Register(context.Context, *ServiceInstance) error
    Deregister(context.Context, *ServiceInstance) error
}

type Discovery interface {
    GetService(context.Context, string) ([]*ServiceInstance, error)
    Watch(context.Context, string) (Watcher, error)
}
```

Adapters implement both contracts for systems such as etcd, Consul, Nacos, Kubernetes, Polaris, or ZooKeeper. Verify the adapter's module path and version in the repository rather than inferring it from Kratos core.

## Registration

Give the registrar to the application so startup and graceful shutdown own registration and deregistration:

```go
app := kratos.New(
    kratos.ID(instanceID),
    kratos.Name("user-service"),
    kratos.Version(version),
    kratos.Metadata(map[string]string{
        "region": region,
        "zone":   zone,
    }),
    kratos.Server(httpServer, grpcServer),
    kratos.Registrar(registrar),
)
```

Publish stable service names and unique instance IDs. Ensure advertised endpoints are reachable from consumers and use the real transport schemes, addresses, and TLS posture. Keep metadata bounded to selection inputs such as region, zone, or deployment version.

## Discovery Clients

Use the discovery scheme with the same registered service name:

```go
conn, err := grpc.DialInsecure(
    ctx,
    grpc.WithEndpoint("discovery:///user-service"),
    grpc.WithDiscovery(discovery),
)
```

HTTP generated clients use the equivalent options:

```go
client, err := http.NewClient(
    ctx,
    http.WithEndpoint("discovery:///user-service"),
    http.WithDiscovery(discovery),
)
```

Choose secure dial constructors and credentials when deployment policy requires TLS. Close client connections during application cleanup so discovery watchers stop.

## Instances and Selection

Discovery supplies `registry.ServiceInstance` values; the transport converts their endpoints into selector nodes. Apply version or metadata filters at client construction:

```go
conn, err := grpc.DialInsecure(
    ctx,
    grpc.WithEndpoint("discovery:///user-service"),
    grpc.WithDiscovery(discovery),
    grpc.WithNodeFilter(
        filter.Version("v2"),
        func(_ context.Context, nodes []selector.Node) []selector.Node {
            selected := make([]selector.Node, 0, len(nodes))
            for _, node := range nodes {
                if node.Metadata()["region"] == region {
                    selected = append(selected, node)
                }
            }
            return selected
        },
    ),
)
```

Read [selector-patterns.md](selector-patterns.md) when changing balancing, filters, or global selector configuration.

## Operational Behavior

- Configure registry authentication, TLS, namespaces, and timeouts from repository configuration.
- Decide whether startup fails closed when registration is unavailable; keep the decision visible in deployment health behavior.
- Expect empty instance sets and watch interruptions. Bound retries and preserve caller deadlines.
- Prevent stale or draining instances from receiving new work before shutdown completes.
- Expose registration state, discovery errors, selected service, and instance counts through bounded logs or metrics.
- Test multi-instance changes; a single static endpoint does not exercise discovery behavior.

## Verification

Complete a registry change when application lifecycle registration and deregistration work, advertised endpoints and metadata match real transports, discovery handles empty and changing instance sets, filters select the intended nodes, security matches deployment policy, and every client and watcher is closed during cleanup.

## References

- [Kratos Registry](https://go-kratos.dev/docs/component/registry)
- [Kratos Selector](https://go-kratos.dev/docs/component/selector)
