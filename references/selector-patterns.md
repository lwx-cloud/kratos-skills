# Selector Patterns

> Version-sensitive. Compare selector APIs with the [compatibility baseline](compatibility.md) before applying examples.

## Contents

- [Understand the client path](#understand-the-client-path)
- [Choose a selector](#choose-a-selector)
- [Filter discovered nodes](#filter-discovered-nodes)
- [Implement a custom selector](#implement-a-custom-selector)
- [Verification](#verification)

## Understand the client path

In the compile-tested baseline, Kratos discovery clients use the global `selector.Builder` to create a selector for each client:

- WRR is the default selector;
- `selector.SetGlobalSelector` accepts a `selector.Builder`, not a constructed selector;
- HTTP and gRPC clients expose `WithNodeFilter`;
- HTTP and gRPC clients do not expose `WithSelector`; and
- a custom selector implements `Select` plus `Apply`, normally through a builder.

Configure the global builder before constructing clients. Treat changing it as process-wide behavior.

## Choose a selector

Keep the default WRR unless measurements justify another strategy:

```go
package balancing

import (
	"github.com/go-kratos/kratos/v2/selector"
	"github.com/go-kratos/kratos/v2/selector/p2c"
)

func UseP2C() {
	selector.SetGlobalSelector(p2c.NewBuilder())
}
```

Available builders in the baseline include:

```go
selector.SetGlobalSelector(wrr.NewBuilder())
selector.SetGlobalSelector(p2c.NewBuilder())
selector.SetGlobalSelector(random.NewBuilder())
```

Use one process-wide choice unless the repository already provides a deliberate per-client integration through lower-level gRPC options. Avoid changing global selection inside request handling or after clients are constructed.

## Filter discovered nodes

Filters run in the order supplied and narrow the discovery result before balancing:

```go
package client

import (
	"context"

	"github.com/go-kratos/kratos/v2/registry"
	"github.com/go-kratos/kratos/v2/selector"
	selectorfilter "github.com/go-kratos/kratos/v2/selector/filter"
	kratosgrpc "github.com/go-kratos/kratos/v2/transport/grpc"
	"google.golang.org/grpc"
)

func NewClient(ctx context.Context, discovery registry.Discovery) (*grpc.ClientConn, error) {
	return kratosgrpc.DialInsecure(
		ctx,
		kratosgrpc.WithEndpoint("discovery:///user-service"),
		kratosgrpc.WithDiscovery(discovery),
		kratosgrpc.WithNodeFilter(
			selectorfilter.Version("v2"),
			func(_ context.Context, nodes []selector.Node) []selector.Node {
				selected := make([]selector.Node, 0, len(nodes))
				for _, node := range nodes {
					if node.Metadata()["region"] == "cn-east" {
						selected = append(selected, node)
					}
				}
				return selected
			},
		),
	)
}
```

Use the generated RPC operation and discovery metadata as observed in the target system. An empty result produces `selector.ErrNoAvailable`, so expose filter mismatches through logs or metrics.

## Implement a custom selector

Prefer the built-in builders. A custom implementation must satisfy the current interfaces:

```go
type Selector interface {
	Select(context.Context, ...SelectOption) (Node, DoneFunc, error)
	Apply([]Node)
}

type Builder interface {
	Build() Selector
}
```

Start from `selector.DefaultBuilder` when only the balancing algorithm or weighted-node model changes. Implement the lower-level `selector.Balancer` or `selector.WeightedNodeBuilder` instead of recreating discovery updates, filters, peer context, and done callbacks.

Preserve these invariants:

- `Apply` atomically replaces or reconciles the current node view;
- `Select` applies every `SelectOption`, including node filters;
- successful selection returns both a node and a non-nil done callback;
- the done callback receives the request result exactly once; and
- concurrent `Apply` and `Select` calls are safe.

## Verification

Complete selector work only when:

- the selected builder matches the installed Kratos version;
- discovery produces nodes with the metadata used by filters;
- empty and partially healthy node sets are tested;
- the chosen selector is configured before client construction; and
- client calls report the selected peer and feed completion results back to the selector.

## Sources

- [Kratos v2.9.2 selector interfaces](https://github.com/go-kratos/kratos/blob/v2.9.2/selector/selector.go)
- [Kratos v2.9.2 global selector](https://github.com/go-kratos/kratos/blob/v2.9.2/selector/global.go)
- [Kratos v2.9.2 gRPC client options](https://github.com/go-kratos/kratos/blob/v2.9.2/transport/grpc/client.go)
- [Kratos v2.9.2 default selector](https://github.com/go-kratos/kratos/blob/v2.9.2/selector/default_selector.go)
