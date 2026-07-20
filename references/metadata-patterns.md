# Metadata Patterns

Read [compatibility.md](compatibility.md) before copying version-sensitive APIs.

Use Kratos metadata for bounded cross-service context such as tenant, locale, request, or routing identifiers. Keep credentials in the authentication mechanism that owns them.

## Server Metadata

Read inbound values from the server context:

```go
md, ok := metadata.FromServerContext(ctx)
if !ok {
    return nil, errors.Unauthorized("MISSING_CONTEXT", "request context is missing")
}
tenantID := md.Get("x-tenant-id")
```

Treat inbound metadata as untrusted input. Define an allowlist, normalize keys at the boundary, validate value size and syntax, and translate missing or invalid values into stable Kratos errors.

Set transport response headers through the server transport:

```go
if tr, ok := transport.FromServerContext(ctx); ok {
    tr.ReplyHeader().Set("x-request-id", requestID)
}
```

## Client Metadata

Append keys while preserving unrelated client metadata. A repeated key is replaced by the later value:

```go
ctx = metadata.AppendToClientContext(
    ctx,
    "x-tenant-id", tenantID,
    "x-request-id", requestID,
)
reply, err := client.GetUser(ctx, req)
```

Create a fresh client metadata context only when replacement is intentional:

```go
ctx = metadata.NewClientContext(ctx, metadata.New(map[string][]string{
    "x-tenant-id": []string{tenantID},
}))
```

Pass the caller's `ctx` through client calls so cancellation, deadlines, tracing, and metadata remain connected. Centralize propagation in a client middleware when the same allowlist applies to many calls.

## Propagation Policy

For every key, define:

| Decision | Required answer |
| --- | --- |
| Owner | Which boundary creates and validates it? |
| Direction | Inbound, outbound, or both? |
| Trust | May callers set it, or must the service overwrite it? |
| Cardinality | Is the value bounded enough for logs and traces? |
| Privacy | May it cross service or region boundaries? |

Use trace propagation from OpenTelemetry middleware rather than copying trace headers manually. Use JWT claims or another authenticated identity source for authorization decisions; metadata may carry a derived, validated identity for downstream convenience only when policy permits it.

## Verification

Complete a metadata change when every key has an owner and direction, HTTP and gRPC propagation are tested, overwrite and missing-value behavior are explicit, untrusted values are validated, and cancellation and deadlines survive the client boundary.

## References

- [Kratos Metadata](https://go-kratos.dev/docs/component/metadata)
