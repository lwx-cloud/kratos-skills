# Request Validation Patterns

> Version-sensitive. Compare the target repository with the [compatibility baseline](compatibility.md) before changing validation dependencies.

## Contents

- [Choose the validation path](#choose-the-validation-path)
- [Configure Buf and Protobuf](#configure-buf-and-protobuf)
- [Use the Kratos middleware](#use-the-kratos-middleware)
- [Validate outside transport middleware](#validate-outside-transport-middleware)
- [Migrate from PGV](#migrate-from-pgv)
- [Verification](#verification)

## Choose the validation path

Use the repository's existing validation stack:

| Repository state | Action |
| --- | --- |
| Protovalidate annotations already exist | Keep Protovalidate and use `validate.ProtoValidate()` |
| Generated messages implement `Validate() error` | Preserve the legacy path until migration is approved |
| Both forms exist during migration | Use `validate.ProtoValidate()`; it supports both runtime Protovalidate and legacy `Validate()` methods |
| No validation exists | Prefer Protovalidate for new APIs unless repository constraints require PGV |

The core `github.com/go-kratos/kratos/v2/middleware/validate.Validator()` is deprecated in the compile-tested baseline. Use the contrib middleware for Protovalidate.

For a new module, copy the compatible Kratos, contrib validation, and Protovalidate requirements from `scripts/compilecheck/go.mod`. In an existing repository, change dependencies through its normal upgrade process.

## Configure Buf and Protobuf

Use the repository's existing module path and generation layout. A Buf v2 dependency declaration looks like:

```yaml
version: v2

modules:
  - path: proto

deps:
  - buf.build/bufbuild/protovalidate:<version-matching-the-runtime>
```

Update dependencies with the repository-owned target or:

```bash
buf dep update
```

Define constraints in the API source:

```protobuf
syntax = "proto3";

package user.v1;

import "buf/validate/validate.proto";

option go_package = "example.com/project/api/user/v1;v1";

message CreateUserRequest {
  string name = 1 [(buf.validate.field).string = {
    min_len: 1
    max_len: 100
  }];

  string email = 2 [(buf.validate.field).string.email = true];

  int32 age = 3 [(buf.validate.field).int32 = {
    gte: 0
    lte: 150
  }];
}
```

Keep cross-field rules beside the message using CEL:

```protobuf
message TimeRange {
  option (buf.validate.message).cel = {
    id: "time_range.end_after_start"
    message: "end_time must be after start_time"
    expression: "this.end_time > this.start_time"
  };

  int64 start_time = 1;
  int64 end_time = 2;
}
```

Run `buf lint` and `buf generate` after changing annotations. Protovalidate evaluates rules at runtime; it does not generate `.pb.validate.go` files.

## Use the Kratos middleware

Install the middleware on each transport that accepts validated messages:

```go
package server

import (
	validate "github.com/go-kratos/kratos/contrib/middleware/validate/v2"
	"github.com/go-kratos/kratos/v2/middleware/recovery"
	"github.com/go-kratos/kratos/v2/transport/grpc"
	"github.com/go-kratos/kratos/v2/transport/http"
)

func HTTPOptions() []http.ServerOption {
	return []http.ServerOption{
		http.Middleware(
			recovery.Recovery(),
			validate.ProtoValidate(),
		),
	}
}

func GRPCOptions() []grpc.ServerOption {
	return []grpc.ServerOption{
		grpc.Middleware(
			recovery.Recovery(),
			validate.ProtoValidate(),
		),
	}
}
```

The middleware validates values implementing `proto.Message`. It returns a Kratos bad-request error with the validation error as its cause. Translate the public error shape only when the repository has an established error contract.

Middleware order is observable. Place tracing and request logging outside validation when rejected requests must appear in those signals.

## Validate outside transport middleware

Reuse Protovalidate when messages enter through jobs, consumers, or internal orchestration:

```go
package validation

import (
	"buf.build/go/protovalidate"
	"google.golang.org/protobuf/proto"
)

func Message(msg proto.Message) error {
	return protovalidate.Validate(msg)
}
```

Create a reusable validator instance only when custom resolver or initialization behavior is required. Keep that instance in dependency injection rather than constructing it for every request.

## Migrate from PGV

Migrate contract-first and keep the service deployable throughout:

1. Add equivalent `(buf.validate.field)` and message CEL rules.
2. Add the Protovalidate runtime and `validate.ProtoValidate()` middleware.
3. Regenerate Protobuf outputs and run contract tests with both valid and invalid messages.
4. Remove PGV annotations, plugins, generated validation files, and dependencies only after every request type is covered.

`validate.ProtoValidate()` also invokes a legacy `Validate() error` method, which supports a staged migration. Confirm behavior against the contrib version actually selected by `go.mod`.

## Verification

Complete validation work only when:

- `buf lint` and the repository generation target pass;
- every modified request message has valid and invalid tests;
- HTTP and gRPC rejection behavior matches the public error contract;
- generated-file changes are intentional; and
- no deprecated core `middleware/validate.Validator()` call remains in the changed path.

## Sources

- [Kratos v2.9.2 deprecated core validator](https://github.com/go-kratos/kratos/blob/v2.9.2/middleware/validate/validate.go)
- [Kratos contrib Protovalidate middleware](https://pkg.go.dev/github.com/go-kratos/kratos/contrib/middleware/validate/v2)
- [Protovalidate documentation](https://buf.build/docs/protovalidate/)
