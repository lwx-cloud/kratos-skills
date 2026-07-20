# Error Handling Patterns

> Generated error APIs follow the [compatibility baseline](compatibility.md). Preserve the target repository's reason vocabulary and public-message policy.

## Contents

- [Define stable errors](#define-stable-errors)
- [Create and inspect errors](#create-and-inspect-errors)
- [Translate errors at boundaries](#translate-errors-at-boundaries)
- [Preserve causes and metadata](#preserve-causes-and-metadata)
- [Coordinate HTTP and gRPC](#coordinate-http-and-grpc)
- [Verification](#verification)

## Define stable errors

Use Protobuf error definitions when the repository generates structured reasons:

```protobuf
syntax = "proto3";

package user.v1;

import "errors/errors.proto";

option go_package = "example.com/project/api/user/v1;v1";

enum UserErrorReason {
  option (errors.default_code) = 500;

  USER_NOT_FOUND = 0 [(errors.code) = 404];
  USER_CONFLICT = 1 [(errors.code) = 409];
}
```

Treat reason strings as stable machine-readable contract values. Keep public messages safe for callers and place diagnostic detail in wrapped causes, logs, and traces.

## Create and inspect errors

Generated helpers provide consistent reason and code construction:

```go
return nil, v1.ErrorUserNotFound("user not found")
```

For non-generated errors, use the narrowest Kratos constructor:

```go
return nil, errors.BadRequest("INVALID_ARGUMENT", "invalid request")
```

Inspect wrapped errors with Go error chaining and Kratos predicates:

```go
if errors.Is(err, context.DeadlineExceeded) {
	return nil, errors.GatewayTimeout("DEPENDENCY_TIMEOUT", "dependency timed out").WithCause(err)
}
```

## Translate errors at boundaries

Assign each translation to the boundary that understands the source error:

- Data maps ORM not-found, constraint, and availability failures to domain errors.
- Biz maps policy and workflow failures to stable business reasons.
- Service preserves domain errors and adapts only transport-specific failures.
- Middleware owns authentication, validation, rate-limit, recovery, and breaker errors.

Keep the original error as a cause when internal observability needs it. Avoid passing raw SQL, driver, upstream response, or credential detail into public messages.

## Preserve causes and metadata

Use metadata only for bounded, non-sensitive contract fields such as resource type or retry class:

```go
err := errors.Conflict("USER_CONFLICT", "user already exists").
	WithMetadata(map[string]string{"field": "email"}).
	WithCause(cause)
```

Keep metadata keys stable and values bounded. Correlation IDs belong in context, logs, or tracing rather than public error metadata unless the API contract explicitly exposes them.

## Coordinate HTTP and gRPC

Kratos converts structured HTTP codes to gRPC status codes and preserves `ErrorInfo` reason and metadata. Test the codes used by the service, particularly:

| HTTP | gRPC class |
| --- | --- |
| 400 | InvalidArgument |
| 401 | Unauthenticated |
| 403 | PermissionDenied |
| 404 | NotFound |
| 409 | Aborted or AlreadyExists according to mapping policy |
| 429 | ResourceExhausted |
| 500 | Internal |
| 503 | Unavailable |
| 504 | DeadlineExceeded |

Use [validation patterns](validate-patterns.md) for request-rule failures and verify their public error shape with both transports.

## Verification

Complete an error-model change when:

- generated reasons and codes match their source definitions;
- every source failure is translated at its owning boundary;
- public messages and metadata omit internal or sensitive detail;
- causes remain available to logs and traces;
- wrapped-error predicates work; and
- HTTP and gRPC tests cover representative status conversions.

## Sources

- [Kratos errors](https://go-kratos.dev/docs/component/errors/)
- [gRPC status codes](https://grpc.github.io/grpc/core/md_doc_statuscodes.html)
