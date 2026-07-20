# Metrics Patterns

> Version-sensitive. Compare the target repository with the [compatibility baseline](compatibility.md). Kratos metrics middleware consumes OpenTelemetry instruments rather than Prometheus vector collectors.

## Contents

- [Build the meter provider](#build-the-meter-provider)
- [Create Kratos request instruments](#create-kratos-request-instruments)
- [Expose Prometheus metrics](#expose-prometheus-metrics)
- [Add business metrics](#add-business-metrics)
- [Control cardinality](#control-cardinality)
- [Verification](#verification)

## Build the meter provider

Reuse the repository's existing OpenTelemetry provider and exporter. For a Prometheus deployment, install an exporter version compatible with the repository's OTel SDK and register it as a reader:

```go
package telemetry

import (
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/prometheus"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
)

func NewMeterProvider() (*sdkmetric.MeterProvider, error) {
	exporter, err := prometheus.New()
	if err != nil {
		return nil, err
	}

	provider := sdkmetric.NewMeterProvider(
		sdkmetric.WithReader(exporter),
	)
	otel.SetMeterProvider(provider)
	return provider, nil
}
```

Create one provider during application startup, inject it where needed, and shut it down with a bounded context. Do not create providers or register exporters per request.

## Create Kratos request instruments

Kratos supplies helpers with the expected OpenTelemetry types:

```go
package telemetry

import (
	"go.opentelemetry.io/otel/metric"

	kratosmetrics "github.com/go-kratos/kratos/v2/middleware/metrics"
	"github.com/go-kratos/kratos/v2/middleware"
)

func ServerMetrics(meter metric.Meter) (middleware.Middleware, error) {
	requests, err := kratosmetrics.DefaultRequestsCounter(
		meter,
		kratosmetrics.DefaultServerRequestsCounterName,
	)
	if err != nil {
		return nil, err
	}

	seconds, err := kratosmetrics.DefaultSecondsHistogram(
		meter,
		kratosmetrics.DefaultServerSecondsHistogramName,
	)
	if err != nil {
		return nil, err
	}

	return kratosmetrics.Server(
		kratosmetrics.WithRequests(requests),
		kratosmetrics.WithSeconds(seconds),
	), nil
}
```

Use `kratosmetrics.Client` and the client metric names for outbound transport metrics. Install the middleware on the correct side and keep operation names stable.

When explicit histogram boundaries are required, register the matching view before creating instruments:

```go
view := kratosmetrics.DefaultSecondsHistogramView(
	kratosmetrics.DefaultServerSecondsHistogramName,
)
provider := sdkmetric.NewMeterProvider(
	sdkmetric.WithReader(exporter),
	sdkmetric.WithView(view),
)
```

## Expose Prometheus metrics

The OTel Prometheus exporter registers a collector with the configured Prometheus registerer. Expose the registry through a dedicated operational endpoint:

```go
package telemetry

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func Handler() http.Handler {
	return promhttp.Handler()
}
```

Keep the metrics endpoint outside public API authentication when infrastructure must scrape it, but protect it with network policy or dedicated operational authentication.

## Add business metrics

Create business instruments from the same provider:

```go
created, err := meter.Int64Counter(
	"users_created",
	metric.WithDescription("Number of users successfully created"),
	metric.WithUnit("{user}"),
)
if err != nil {
	return err
}

created.Add(ctx, 1, metric.WithAttributes(
	attribute.String("source", source),
))
```

Record a counter only after the business operation succeeds. Record latency with histograms and current values with observable gauges or up-down counters, following the SDK version already in the repository.

## Control cardinality

Use bounded attributes such as transport kind, generated operation, status code, error reason, region, and deployment environment.

Exclude identifiers with unbounded values:

- user, order, request, trace, and session IDs;
- raw URL paths containing resource IDs;
- complete error messages; and
- arbitrary client-supplied headers.

Prefer the generated Kratos operation over the raw HTTP path. Keep the error reason vocabulary finite and owned by the service contract.

## Verification

Complete metrics work only when:

- the provider and exporter versions match the target `go.mod`;
- request counter and duration histogram types compile against Kratos;
- success and representative failure paths emit expected attributes;
- `/metrics` or the selected exporter produces data in the deployed environment;
- label cardinality is bounded; and
- provider shutdown is wired into application cleanup.

## Sources

- [Kratos v2.9.2 metrics middleware](https://github.com/go-kratos/kratos/blob/v2.9.2/middleware/metrics/metrics.go)
- [OpenTelemetry Go metrics](https://opentelemetry.io/docs/languages/go/instrumentation/#metrics)
- [OpenTelemetry Prometheus exporter](https://pkg.go.dev/go.opentelemetry.io/otel/exporters/prometheus)
