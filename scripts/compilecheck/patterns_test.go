package compilecheck

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	aegiscb "github.com/go-kratos/aegis/circuitbreaker"
	"github.com/go-kratos/aegis/circuitbreaker/sre"
	"github.com/go-kratos/aegis/ratelimit/bbr"
	validate "github.com/go-kratos/kratos/contrib/middleware/validate/v2"
	"github.com/go-kratos/kratos/v2/config"
	"github.com/go-kratos/kratos/v2/config/env"
	"github.com/go-kratos/kratos/v2/config/file"
	kratosencoding "github.com/go-kratos/kratos/v2/encoding"
	"github.com/go-kratos/kratos/v2/errors"
	"github.com/go-kratos/kratos/v2/metadata"
	"github.com/go-kratos/kratos/v2/middleware"
	kratosjwt "github.com/go-kratos/kratos/v2/middleware/auth/jwt"
	"github.com/go-kratos/kratos/v2/middleware/circuitbreaker"
	kratosmetrics "github.com/go-kratos/kratos/v2/middleware/metrics"
	kratoslimit "github.com/go-kratos/kratos/v2/middleware/ratelimit"
	"github.com/go-kratos/kratos/v2/middleware/recovery"
	kratostracing "github.com/go-kratos/kratos/v2/middleware/tracing"
	"github.com/go-kratos/kratos/v2/registry"
	"github.com/go-kratos/kratos/v2/selector"
	selectorfilter "github.com/go-kratos/kratos/v2/selector/filter"
	"github.com/go-kratos/kratos/v2/selector/p2c"
	"github.com/go-kratos/kratos/v2/selector/random"
	"github.com/go-kratos/kratos/v2/selector/wrr"
	kratosgrpc "github.com/go-kratos/kratos/v2/transport/grpc"
	kratoshttp "github.com/go-kratos/kratos/v2/transport/http"
	jwt "github.com/golang-jwt/jwt/v5"
	"go.opentelemetry.io/otel/propagation"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/trace/noop"
)

type claims struct {
	UserID string `json:"user_id"`
	jwt.RegisteredClaims
}

type compileCodec struct{}

func (compileCodec) Name() string { return "compilecheck" }
func (compileCodec) Marshal(v any) ([]byte, error) {
	return json.Marshal(v)
}
func (compileCodec) Unmarshal(data []byte, v any) error {
	return json.Unmarshal(data, v)
}

type compileRegistry struct{}

func (compileRegistry) Register(context.Context, *registry.ServiceInstance) error   { return nil }
func (compileRegistry) Deregister(context.Context, *registry.ServiceInstance) error { return nil }
func (compileRegistry) GetService(context.Context, string) ([]*registry.ServiceInstance, error) {
	return nil, nil
}
func (compileRegistry) Watch(context.Context, string) (registry.Watcher, error) { return nil, nil }

var _ registry.Registrar = compileRegistry{}
var _ registry.Discovery = compileRegistry{}

func TestDocumentedAPIsCompile(t *testing.T) {
	kratosencoding.RegisterCodec(compileCodec{})
	if kratosencoding.GetCodec("compilecheck") == nil {
		t.Fatal("registered codec is unavailable")
	}
	_ = kratoshttp.RequestDecoder(kratoshttp.DefaultRequestDecoder)
	_ = kratoshttp.ResponseEncoder(kratoshttp.DefaultResponseEncoder)
	_ = kratoshttp.ErrorEncoder(kratoshttp.DefaultErrorEncoder)

	serverCtx := metadata.NewServerContext(context.Background(), metadata.New(map[string][]string{
		"x-tenant-id": {"tenant-1"},
	}))
	serverMD, ok := metadata.FromServerContext(serverCtx)
	if !ok || serverMD.Get("x-tenant-id") != "tenant-1" {
		t.Fatal("server metadata is unavailable")
	}
	clientCtx := metadata.AppendToClientContext(context.Background(), "x-request-id", "request-1")
	clientCtx = metadata.NewClientContext(clientCtx, metadata.New(map[string][]string{
		"x-tenant-id": {"tenant-1"},
	}))
	if _, ok := metadata.FromClientContext(clientCtx); !ok {
		t.Fatal("client metadata is unavailable")
	}

	tracerProvider := noop.NewTracerProvider()
	propagator := propagation.TraceContext{}
	var serverTracing middleware.Middleware = kratostracing.Server(
		kratostracing.WithTracerProvider(tracerProvider),
		kratostracing.WithPropagator(propagator),
	)
	var clientTracing middleware.Middleware = kratostracing.Client(
		kratostracing.WithTracerProvider(tracerProvider),
		kratostracing.WithPropagator(propagator),
	)
	if serverTracing == nil || clientTracing == nil {
		t.Fatal("tracing middleware is nil")
	}
	_ = kratostracing.TraceID()
	_ = kratostracing.SpanID()

	instance := &registry.ServiceInstance{
		ID:        "user-service-1",
		Name:      "user-service",
		Version:   "v2",
		Metadata:  map[string]string{"region": "cn"},
		Endpoints: []string{"grpc://127.0.0.1:9000"},
	}
	if err := (compileRegistry{}).Register(context.Background(), instance); err != nil {
		t.Fatal(err)
	}

	var validation middleware.Middleware = validate.ProtoValidate()
	if validation == nil {
		t.Fatal("validation middleware is nil")
	}

	keyFunc := func(*jwt.Token) (any, error) { return []byte("compile-check-only"), nil }
	var authentication middleware.Middleware = kratosjwt.Server(
		keyFunc,
		kratosjwt.WithSigningMethod(jwt.SigningMethodHS256),
		kratosjwt.WithClaims(func() jwt.Claims { return &claims{} }),
	)
	if authentication == nil {
		t.Fatal("authentication middleware is nil")
	}

	var breaker middleware.Middleware = circuitbreaker.Client(
		circuitbreaker.WithCircuitBreaker(func() aegiscb.CircuitBreaker {
			return sre.NewBreaker(
				sre.WithSuccess(0.6),
				sre.WithRequest(100),
				sre.WithWindow(3*time.Second),
				sre.WithBucket(10),
			)
		}),
	)
	if breaker == nil {
		t.Fatal("circuit breaker middleware is nil")
	}

	var limiter middleware.Middleware = kratoslimit.Server(
		kratoslimit.WithLimiter(bbr.NewLimiter(
			bbr.WithWindow(10*time.Second),
			bbr.WithBucket(100),
			bbr.WithCPUThreshold(800),
		)),
	)
	if limiter == nil {
		t.Fatal("rate-limit middleware is nil")
	}

	var recovered middleware.Middleware = recovery.Recovery(
		recovery.WithHandler(func(context.Context, any, any) error {
			return errors.InternalServer("INTERNAL_ERROR", "internal server error")
		}),
	)
	if recovered == nil {
		t.Fatal("recovery middleware is nil")
	}

	provider := sdkmetric.NewMeterProvider()
	meter := provider.Meter("compilecheck")
	requests, err := kratosmetrics.DefaultRequestsCounter(
		meter,
		kratosmetrics.DefaultServerRequestsCounterName,
	)
	if err != nil {
		t.Fatal(err)
	}
	seconds, err := kratosmetrics.DefaultSecondsHistogram(
		meter,
		kratosmetrics.DefaultServerSecondsHistogramName,
	)
	if err != nil {
		t.Fatal(err)
	}
	var measured middleware.Middleware = kratosmetrics.Server(
		kratosmetrics.WithRequests(requests),
		kratosmetrics.WithSeconds(seconds),
	)
	if measured == nil {
		t.Fatal("metrics middleware is nil")
	}

	var _ selector.Builder = wrr.NewBuilder()
	var _ selector.Builder = p2c.NewBuilder()
	var _ selector.Builder = random.NewBuilder()
	selector.SetGlobalSelector(p2c.NewBuilder())

	versionFilter := selectorfilter.Version("v2")
	regionFilter := func(_ context.Context, nodes []selector.Node) []selector.Node { return nodes }
	_ = kratosgrpc.WithNodeFilter(versionFilter, regionFilter)
	_ = kratoshttp.WithNodeFilter(versionFilter, regionFilter)
	_ = kratosgrpc.WithTimeout(2 * time.Second)
	_ = kratoshttp.WithTimeout(2 * time.Second)
	_ = kratoshttp.Network("tcp")
	_ = kratoshttp.Address(":8000")

	configuration := config.New(config.WithSource(
		file.NewSource("configs/config.yaml"),
		env.NewSource("APP_"),
	))
	if configuration == nil {
		t.Fatal("configuration is nil")
	}
}
