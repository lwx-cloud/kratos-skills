# OpenTelemetry Tracing Patterns

Read [compatibility.md](compatibility.md) and the repository's observability bootstrap before changing providers, exporters, or semantic-convention versions.

## Contents

- [Provider lifecycle](#provider-lifecycle)
- [Kratos middleware](#kratos-middleware)
- [Business spans](#business-spans)
- [Logs and propagation](#logs-and-propagation)
- [Sampling and attributes](#sampling-and-attributes)
- [Verification](#verification)

## Provider Lifecycle

Prefer OTLP so the service exports to an OpenTelemetry Collector instead of binding application code to a tracing backend. Build the exporter and provider once during startup, install the same resource identity used by metrics, and flush on shutdown:

```go
exporter, err := otlptracegrpc.New(ctx,
    otlptracegrpc.WithEndpoint(endpoint),
    otlptracegrpc.WithTLSCredentials(credentials.NewTLS(tlsConfig)),
)
if err != nil {
    return nil, err
}

provider := sdktrace.NewTracerProvider(
    sdktrace.WithBatcher(exporter),
    sdktrace.WithResource(resource),
    sdktrace.WithSampler(sdktrace.ParentBased(
        sdktrace.TraceIDRatioBased(sampleRatio),
    )),
)
```

Return the provider shutdown function through the repository's cleanup path and call it with a bounded context. Development may use an insecure local collector only through explicit configuration.

## Kratos Middleware

Install tracing on every inbound and outbound transport boundary:

```go
http.Middleware(
    recovery.Recovery(),
    tracing.Server(
        tracing.WithTracerProvider(provider),
        tracing.WithPropagator(propagator),
    ),
)

grpc.WithMiddleware(
    tracing.Client(
        tracing.WithTracerProvider(provider),
        tracing.WithPropagator(propagator),
    ),
)
```

Use one propagator configuration across services, normally W3C Trace Context plus Baggage. Kratos transport middleware extracts and injects headers; application code should pass `ctx` rather than reconstruct trace carriers.

## Business Spans

Transport middleware already creates server and client spans. Add a child span only for meaningful operations whose latency or failure cannot be understood from those spans:

```go
ctx, span := tracer.Start(ctx, "user.create")
defer span.End()

user, err := repo.Save(ctx, candidate)
if err != nil {
    span.RecordError(err)
    span.SetStatus(codes.Error, "save user")
    return nil, err
}
return user, nil
```

End each span exactly once and pass its derived context to child calls. Record errors on the span that owns the failed operation; preserve the returned domain or Kratos error for boundary translation.

## Logs and Propagation

Correlate structured logs without manual string extraction:

```go
logger = log.With(
    logger,
    "trace.id", tracing.TraceID(),
    "span.id", tracing.SpanID(),
)
```

Keep baggage small and governed. Limit baggage and span attributes to bounded, non-sensitive correlation and operation data.

## Sampling and Attributes

- Use parent-based sampling so downstream services respect an existing trace decision.
- Configure ratios by environment and retain error visibility through collector or tail-sampling policy when required.
- Use OpenTelemetry semantic conventions for service and transport attributes.
- Keep attribute names stable and values bounded; favor operation, result class, dependency, or deployment dimensions.
- Avoid duplicate manual spans around already-instrumented HTTP, gRPC, SQL, or messaging clients.

## Verification

Complete a tracing change when provider and OTLP exporter startup succeed, server and client middleware continue one trace across a real call, error paths record status, attributes and baggage are bounded and non-sensitive, sampling matches policy, logs contain trace correlation, and shutdown flushes within its deadline.

## References

- [Kratos Tracing Middleware](https://go-kratos.dev/docs/component/middleware/tracing)
- [OpenTelemetry Go](https://opentelemetry.io/docs/languages/go/)
- [OTLP Exporters](https://opentelemetry.io/docs/languages/go/exporters/)
