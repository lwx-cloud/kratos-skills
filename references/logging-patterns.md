# Logging Patterns

> Logger and adapter APIs follow the [compatibility baseline](compatibility.md). Preserve the target repository's field names, levels, and sink lifecycle.

## Contents

- [Construct the logger](#construct-the-logger)
- [Log with context](#log-with-context)
- [Use stable fields and levels](#use-stable-fields-and-levels)
- [Adapt external loggers](#adapt-external-loggers)
- [Filter and redact](#filter-and-redact)
- [Verification](#verification)

## Construct the logger

Create one application logger during startup and enrich it with stable valuers:

```go
logger := log.With(
	log.NewStdLogger(os.Stdout),
	"ts", log.DefaultTimestamp,
	"caller", log.DefaultCaller,
	"service.id", id,
	"service.name", name,
	"service.version", version,
)
helper := log.NewHelper(logger)
```

Inject `log.Logger` or `*log.Helper` through constructors. Configure the Kratos global logger only when framework components must share the same sink.

## Log with context

Bind request context before logging so trace and request valuers can resolve:

```go
func (uc *UserUsecase) Create(ctx context.Context, user *User) error {
	uc.log.WithContext(ctx).Infow(
		"operation", "user.create",
		"source", user.Source,
	)
	return nil
}
```

Use generated operation names in transport middleware. Log business events in use cases and persistence diagnostics in data without repeating the same event at every layer.

## Use stable fields and levels

- Debug: local diagnostic detail disabled in normal production operation.
- Info: lifecycle events and meaningful business state transitions.
- Warn: degraded behavior that completed or recovered.
- Error: failed operations requiring investigation.

Keep keys stable across services. Prefer bounded fields such as operation, reason, dependency, region, and retry count. Keep request, user, resource, trace, and session identifiers out of metric labels, but include redacted correlation identifiers in logs when policy permits.

## Adapt external loggers

Kratos contrib adapters connect libraries such as Zap and Logrus to `log.Logger`. Pin the adapter module compatible with the selected Kratos version, configure encoder and sink behavior at startup, and expose cleanup or sync errors through application shutdown.

Keep application code dependent on the Kratos logger interface rather than the adapter's concrete logger unless repository conventions deliberately standardize on that library.

## Filter and redact

Use Kratos filters or adapter hooks to enforce minimum levels and redact named keys. Apply redaction before serialization and export.

Protect:

- authorization and cookie headers;
- passwords, private keys, access and refresh tokens;
- database DSNs and connection credentials;
- sensitive request bodies and personal data; and
- raw upstream errors containing payloads.

## Verification

Complete a logging change when:

- stable structured keys and level policy are documented;
- request context produces trace correlation;
- credentials and sensitive payloads are redacted;
- duplicate events across layers are removed;
- adapter initialization and sink flushing succeed; and
- failure paths remain observable without exposing public secrets.

## Sources

- [Kratos logging](https://go-kratos.dev/docs/component/log/)
- [Kratos log adapters](https://github.com/go-kratos/kratos/tree/main/contrib/log)
