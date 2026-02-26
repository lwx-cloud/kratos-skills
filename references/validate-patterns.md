# Request Validation Patterns

This guide covers request validation using **protovalidate** (by Buf) in kratos.

## Overview

> **Note**: `protoc-gen-validate` (PGV) is now in maintenance mode. **protovalidate** is the recommended successor with better CEL support, no code generation, and consistent multi-language implementations.

Kratos uses [protovalidate](https://github.com/bufbuild/protovalidate) for runtime request validation based on proto field constraints.

## Key Differences: PGV vs Protovalidate

| Feature | protoc-gen-validate (Legacy) | protovalidate (Current) |
|---------|------------------------------|-------------------------|
| **Code Generation** | Required (.pb.validate.go) | None (runtime reflection) |
| **Import Path** | `validate/validate.proto` | `buf/validate/validate.proto` |
| **Annotation** | `(validate.rules)` | `(buf.validate.field)` |
| **Validation Logic** | Generated Go code | CEL expressions |
| **Multi-language** | Inconsistent | Consistent (Go, Java, Python, etc.) |
| **Custom Rules** | Limited | Full CEL support |
| **Performance** | Compile-time | Microsecond-level with lazy loading |

## Installation

### 1. Add Protovalidate Dependency

```bash
# Using Buf (recommended)
go get buf.build/go/protovalidate

# Or using GitHub
go get github.com/bufbuild/protovalidate-go
```

### 2. Buf Configuration (buf.yaml)

```yaml
version: v2

modules:
  - path: proto

deps:
  - buf.build/bufbuild/protovalidate:v0.14.1
```

Then run:
```bash
buf dep update
```

### 3. Buf CLI Installation

```bash
# macOS/Linux
curl -sSL "https://github.com/bufbuild/buf/releases/latest/download/buf-$(uname -s)-$(uname -m)" -o /usr/local/bin/buf
chmod +x /usr/local/bin/buf

# Or using Homebrew
brew install buf

# Verify installation
buf --version
```

### 4. Download Protovalidate Proto Files

```bash
# Copy validate.proto to your third_party directory
cp $(go env GOMODCACHE)/buf.build/go/protovalidate@*/buf/validate/validate.proto third_party/buf/validate/

# Or use buf export
buf export buf.build/bufbuild/protovalidate -o third_party/
```

## Buf CLI Commands

Buf CLI 是 protovalidate 的配套工具，用于管理 proto 依赖、代码生成和 lint。

### Common Commands

```bash
# Initialize buf.yaml
buf config init

# Fetch dependencies (download protovalidate proto files)
buf dep update

# Lint proto files
buf lint

# Format proto files
buf format -w

# Generate code (using buf.gen.yaml)
buf generate

# Export dependencies to local directory
buf export buf.build/bufbuild/protovalidate -o third_party/

# Check breaking changes
buf breaking --against '.git#branch=main'

# Push to Buf Schema Registry (BSR)
buf push
```

### buf.yaml Configuration

```yaml
version: v2

# Module configuration
modules:
  - path: proto
    name: buf.build/your-org/your-repo

# Dependencies (includes protovalidate)
deps:
  - buf.build/bufbuild/protovalidate:v0.14.1

# Lint configuration
lint:
  use:
    - DEFAULT
  except:
    - PACKAGE_VERSION_SUFFIX

# Breaking change detection
breaking:
  use:
    - FILE
```

### buf.gen.yaml (Code Generation)

```yaml
version: v2

# Plugins for code generation
plugins:
  # Go code generation
  - local: protoc-gen-go
    out: .
    opt: paths=source_relative

  # gRPC Go generation
  - local: protoc-gen-go-grpc
    out: .
    opt: paths=source_relative

  # Kratos HTTP generation
  - local: protoc-gen-go-http
    out: .
    opt: paths=source_relative

  # Kratos errors generation
  - local: protoc-gen-go-errors
    out: .
    opt: paths=source_relative

# Input configuration
inputs:
  - directory: proto
```

### Makefile Integration

```makefile
.PHONY: buf-dep buf-lint buf-gen buf-breaking

# Update dependencies
buf-dep:
	buf dep update

# Lint proto files
buf-lint:
	buf lint

# Generate code
buf-gen:
	buf generate

# Check breaking changes
buf-breaking:
	buf breaking --against '.git#branch=main'

# Format proto files
buf-format:
	buf format -w

# Full validation pipeline
buf-check: buf-lint buf-breaking
```

## Proto Validation Rules

### Basic Import

```protobuf
syntax = "proto3";

package api.user.v1;

import "buf/validate/validate.proto";

option go_package = "user/api/user/v1;v1";
```

### Numeric Fields

```protobuf
message UserRequest {
  // id must be greater than 0
  int64 id = 1 [
    (buf.validate.field).int64 = { gt: 0 }
  ];

  // age must be in range [0, 150]
  int32 age = 2 [
    (buf.validate.field).int32 = { gte: 0, lte: 150 }
  ];

  // status must be 1, 2, or 3
  uint32 status = 3 [
    (buf.validate.field).uint32 = { in: [1, 2, 3] }
  ];

  // score cannot be 0 or 99.99
  float score = 4 [
    (buf.validate.field).float = { not_in: [0, 99.99] }
  ];

  // price must be non-negative
  double price = 5 [
    (buf.validate.field).double = { gte: 0 }
  ];
}
```

### Boolean Fields

```protobuf
message Config {
  // state must be true
  bool enabled = 1 [
    (buf.validate.field).bool = { const: true }
  ];
}
```

### String Fields

```protobuf
message User {
  // exact length
  string phone = 1 [
    (buf.validate.field).string = { len: 11 }
  ];

  // min/max length
  string name = 2 [
    (buf.validate.field).string = { min_len: 1, max_len: 100 }
  ];

  // pattern (regex)
  string hex_code = 3 [
    (buf.validate.field).string = { pattern: "(?i)^[0-9a-f]+$" }
  ];

  // email validation
  string email = 4 [
    (buf.validate.field).string = { email: true }
  ];

  // UUID validation
  string uuid = 5 [
    (buf.validate.field).string = { uuid: true }
  ];

  // URI validation
  string url = 6 [
    (buf.validate.field).string = { uri: true }
  ];

  // hostname validation
  string host = 7 [
    (buf.validate.field).string = { hostname: true }
  ];

  // IP address validation
  string ip = 8 [
    (buf.validate.field).string = { ip: true }
  ];

  // IPv4 validation
  string ipv4 = 9 [
    (buf.validate.field).string = { ip = { version: 4 } }
  ];

  // IPv6 validation
  string ipv6 = 10 [
    (buf.validate.field).string = { ip = { version: 6 } }
  ];
}
```

### Message Fields

```protobuf
message CreateUserRequest {
  // user cannot be unset (required field)
  User user = 1 [
    (buf.validate.field).required = true
  ];
}

message User {
  string name = 1;
  string email = 2;
}
```

### Repeated Fields

```protobuf
message BatchRequest {
  // at least one item required, max 100
  repeated int64 ids = 1 [
    (buf.validate.field).repeated = { min_items: 1, max_items: 100 }
  ];

  // unique items
  repeated string tags = 2 [
    (buf.validate.field).repeated = { unique: true }
  ];

  // validate items (each item must be > 0)
  repeated int32 scores = 3 [
    (buf.validate.field).repeated = {
      items: {
        int32: { gt: 0 }
      }
    }
  ];
}
```

### Map Fields

```protobuf
message Metadata {
  // min/max pairs
  map<string, string> labels = 1 [
    (buf.validate.field).map = { min_pairs: 1, max_pairs: 10 }
  ];

  // validate keys and values
  map<string, int32> scores = 2 [
    (buf.validate.field).map = {
      keys: { string: { min_len: 1 } }
      values: { int32: { gte: 0, lte: 100 } }
    }
  ];
}
```

### Enum Fields

```protobuf
enum Status {
  STATUS_UNSPECIFIED = 0;
  STATUS_ACTIVE = 1;
  STATUS_INACTIVE = 2;
}

message Task {
  // status must be defined (not UNSPECIFIED)
  Status status = 1 [
    (buf.validate.field).enum = { defined_only: true }
  ];
}
```

### Oneof Fields

```protobuf
message Contact {
  oneof contact_method {
    option (buf.validate.oneof).required = true;

    string email = 1 [(buf.validate.field).string.email = true];
    string phone = 2 [(buf.validate.field).string.len = 11];
  }
}
```

### Conditional Validation (CEL)

```protobuf
import "buf/validate/validate.proto";

message PasswordChange {
  string old_password = 1;

  string new_password = 2 [
    (buf.validate.field).string = {
      min_len: 8
    },
    (buf.validate.field).cel = {
      id: "password_strength"
      message: "password must contain at least one number and one letter"
      expression: "this.matches('^(?=.*[a-zA-Z])(?=.*\\d).+$')"
    }
  ];

  // Cross-field validation: confirm_password must match new_password
  string confirm_password = 3 [
    (buf.validate.field).cel = {
      id: "password_match"
      message: "passwords do not match"
      expression: "this == new_password"
    }
  ];
}

// Conditional required field
message Order {
  string customer_id = 1 [(buf.validate.field).required = true];

  // shipping_address is required only if delivery_type is "SHIP"
  string shipping_address = 2 [
    (buf.validate.field).cel = {
      id: "shipping_required"
      message: "shipping address is required for delivery type SHIP"
      expression: "delivery_type != 'SHIP' || this != ''"
    }
  ];

  string delivery_type = 3;
}
```

### Ignore Options

```protobuf
message UpdateRequest {
  // ID is always required
  int64 id = 1 [(buf.validate.field).required = true];

  // Name is optional (can be empty to skip update)
  string name = 2 [
    (buf.validate.field).ignore = IGNORE_IF_UNPOPULATED,
    (buf.validate.field).string = { min_len: 1, max_len: 100 }
  ];

  // Email is optional
  string email = 3 [
    (buf.validate.field).ignore = IGNORE_IF_UNPOPULATED,
    (buf.validate.field).string = { email: true }
  ];
}
```

Ignore options:
- `IGNORE_UNSPECIFIED` (default): Always validate
- `IGNORE_IF_UNPOPULATED`: Skip validation if field has zero value
- `IGNORE_ALWAYS`: Always skip validation

## Go Implementation

### Basic Validation

```go
package main

import (
    "context"
    "fmt"

    "buf.build/go/protovalidate"
    pb "user/api/user/v1"
)

func main() {
    // Create validator (can be reused, thread-safe)
    validator, err := protovalidate.New()
    if err != nil {
        panic(err)
    }

    // Create request
    req := &pb.CreateUserRequest{
        Name:  "John",
        Email: "invalid-email", // Invalid
        Age:   -1,              // Invalid
    }

    // Validate
    if err := validator.Validate(req); err != nil {
        fmt.Printf("Validation error: %v\n", err)
    }
}
```

### Validation with Custom Options

```go
package main

import (
    "buf.build/go/protovalidate"
    "buf.build/go/protovalidate/resolve"
)

func main() {
    // With legacy PGV support (for migration)
    validator, err := protovalidate.New(
        protovalidate.WithResolver(resolve.DefaultResolver()),
    )

    // With custom disable lazy loading
    validator, err := protovalidate.New(
        protovalivate.WithDisableLazy(),
    )
}
```

## Kratos Middleware Integration

### Custom Protovalidate Middleware

```go
package middleware

import (
    "context"

    "buf.build/go/protovalidate"
    "github.com/go-kratos/kratos/v2/errors"
    "github.com/go-kratos/kratos/v2/middleware"
)

// Validator returns a middleware that validates proto messages using protovalidate
func Validator(opts ...protovalidate.Option) middleware.Middleware {
    v, err := protovalidate.New(opts...)
    if err != nil {
        panic(err)
    }

    return func(handler middleware.Handler) middleware.Handler {
        return func(ctx context.Context, req interface{}) (reply interface{}, err error) {
            if msg, ok := req.(protovalidate.ProtoMessage); ok {
                if err := v.Validate(msg); err != nil {
                    return nil, errors.BadRequest(
                        "VALIDATION_ERROR",
                        err.Error(),
                    )
                }
            }
            return handler(ctx, req)
        }
    }
}
```

### HTTP Server Usage

```go
package server

import (
    "buf.build/go/protovalidate"
    "github.com/go-kratos/kratos/v2/middleware/recovery"
    "github.com/go-kratos/kratos/v2/transport/http"
    "user/internal/middleware"
)

func NewHTTPServer(c *conf.Server, logger log.Logger) *http.Server {
    var opts = []http.ServerOption{
        http.Middleware(
            recovery.Recovery(),
            middleware.Validator(),  // Protovalidate middleware
            logging.Server(logger),
        ),
    }

    return http.NewServer(opts...)
}
```

### gRPC Server Usage

```go
package server

import (
    "github.com/go-kratos/kratos/v2/middleware/recovery"
    "github.com/go-kratos/kratos/v2/transport/grpc"
    "user/internal/middleware"
)

func NewGRPCServer(c *conf.Server, logger log.Logger) *grpc.Server {
    var opts = []grpc.ServerOption{
        grpc.Middleware(
            recovery.Recovery(),
            middleware.Validator(),  // Protovalidate middleware
            logging.Server(logger),
        ),
    }

    return grpc.NewServer(opts...)
}
```

## Migration from proto-gen-validate

### Automated Migration

Buf provides a migration tool:

```bash
# Clone protovalidate repository
git clone https://github.com/bufbuild/protovalidate.git
cd protovalidate

# Step 1: Add protovalidate annotations alongside PGV
go run ./tools/protovalidate-migrate -w /path/to/your/protos

# Step 2: After code migration, remove legacy PGV annotations
go run ./tools/protovalidate-migrate -w --remove-legacy /path/to/your/protos
```

### Manual Migration Cheat Sheet

| PGV (Old) | Protovalidate (New) |
|-----------|---------------------|
| `import "validate/validate.proto"` | `import "buf/validate/validate.proto"` |
| `(validate.rules).<TYPE>.required` | `(buf.validate.field).required = true` |
| `(validate.rules).<TYPE>.ignore_empty` | `(buf.validate.field).ignore = IGNORE_IF_UNPOPULATED` |
| `(validate.rules).message.skip` | `(buf.validate.field).ignore = IGNORE_ALWAYS` |
| `(validate.rules).string.min_len` | `(buf.validate.field).string.min_len` |
| `(validate.rules).string.max_len` | `(buf.validate.field).string.max_len` |
| `(validate.rules).string.len` | `(buf.validate.field).string.len` |
| `(validate.rules).string.pattern` | `(buf.validate.field).string.pattern` |
| `(validate.rules).string.email` | `(buf.validate.field).string.email` |
| `(validate.rules).string.uuid` | `(buf.validate.field).string.uuid` |
| `(validate.rules).string.uri` | `(buf.validate.field).string.uri` |
| `(validate.rules).string.hostname` | `(buf.validate.field).string.hostname` |
| `(validate.rules).string.ip` | `(buf.validate.field).string.ip` |
| `(validate.rules).string.ipv4` | `(buf.validate.field).string.ip = {version: 4}` |
| `(validate.rules).string.ipv6` | `(buf.validate.field).string.ip = {version: 6}` |
| `(validate.rules).int32.gt` | `(buf.validate.field).int32.gt` |
| `(validate.rules).int32.gte` | `(buf.validate.field).int32.gte` |
| `(validate.rules).int32.lt` | `(buf.validate.field).int32.lt` |
| `(validate.rules).int32.lte` | `(buf.validate.field).int32.lte` |
| `(validate.rules).int32.in` | `(buf.validate.field).int32.in` |
| `(validate.rules).int32.not_in` | `(buf.validate.field).int32.not_in` |
| `(validate.rules).int64.gt` | `(buf.validate.field).int64.gt` |
| `(validate.rules).uint32.gt` | `(buf.validate.field).uint32.gt` |
| `(validate.rules).float.gt` | `(buf.validate.field).float.gt` |
| `(validate.rules).double.gt` | `(buf.validate.field).double.gt` |
| `(validate.rules).bool.const` | `(buf.validate.field).bool.const` |
| `(validate.rules).enum.defined_only` | `(buf.validate.field).enum.defined_only` |
| `(validate.rules).repeated.min_items` | `(buf.validate.field).repeated.min_items` |
| `(validate.rules).repeated.max_items` | `(buf.validate.field).repeated.max_items` |
| `(validate.rules).repeated.unique` | `(buf.validate.field).repeated.unique` |
| `(validate.rules).map.min_pairs` | `(buf.validate.field).map.min_pairs` |
| `(validate.rules).map.max_pairs` | `(buf.validate.field).map.max_pairs` |
| `(validate.required)` (oneof) | `(buf.validate.oneof).required` |
| `(validate.ignored)` | Removed (use ignore options) |
| `(validate.disabled)` | Removed |

## Complete Example

```protobuf
syntax = "proto3";

package api.user.v1;

import "buf/validate/validate.proto";
import "google/api/annotations.proto";

option go_package = "user/api/user/v1;v1";

service UserService {
  rpc CreateUser(CreateUserRequest) returns (User) {
    option (google.api.http) = {
      post: "/v1/users"
      body: "*"
    };
  }

  rpc GetUser(GetUserRequest) returns (User) {
    option (google.api.http) = {
      get: "/v1/users/{id}"
    };
  }

  rpc UpdateUser(UpdateUserRequest) returns (User) {
    option (google.api.http) = {
      put: "/v1/users/{id}"
      body: "*"
    };
  }
}

message CreateUserRequest {
  string name = 1 [
    (buf.validate.field).string = {
      min_len: 1
      max_len: 100
    }
  ];

  string email = 2 [
    (buf.validate.field).string.email = true
  ];

  string phone = 3 [
    (buf.validate.field).string = {
      len: 11
      pattern: "^1[3-9]\\d{9}$"
    }
  ];

  int32 age = 4 [
    (buf.validate.field).int32 = {
      gte: 0
      lte: 150
    }
  ];
}

message GetUserRequest {
  int64 id = 1 [
    (buf.validate.field).int64.gt = 0
  ];
}

message UpdateUserRequest {
  int64 id = 1 [
    (buf.validate.field).int64.gt = 0
  ];

  string name = 2 [
    (buf.validate.field).ignore = IGNORE_IF_UNPOPULATED,
    (buf.validate.field).string = { min_len: 1, max_len: 100 }
  ];

  string email = 3 [
    (buf.validate.field).ignore = IGNORE_IF_UNPOPULATED,
    (buf.validate.field).string.email = true
  ];
}

message User {
  int64 id = 1;
  string name = 2;
  string email = 3;
  string phone = 4;
  int32 age = 5;
}
```

## Best Practices

### ✅ Always Follow

- Use `required` for mandatory fields
- Use `ignore = IGNORE_IF_UNPOPULATED` for optional update fields
- Use CEL for complex cross-field validation
- Create a single validator instance and reuse it (thread-safe)

### ❌ Avoid

- Don't use both PGV and protovalidate simultaneously (confusing)
- Don't forget to handle validation errors in middleware
- Don't validate at the database layer (do it at API layer)

## References

### Protovalidate
- [Protovalidate Documentation](https://buf.build/docs/protovalidate/)
- [Migration Guide from PGV](https://buf.build/docs/migration-guides/migrate-from-protoc-gen-validate/)
- [Protovalidate GitHub](https://github.com/bufbuild/protovalidate)
- [Protovalidate-Go GitHub](https://github.com/bufbuild/protovalidate-go)

### Buf CLI
- [Buf CLI Documentation](https://buf.build/docs/cli/)
- [Buf Installation](https://buf.build/docs/cli/installation/)
- [Buf Configuration](https://buf.build/docs/configuration/)
- [Code Generation](https://buf.build/docs/generate/overview/)

### Other
- [CEL Language](https://github.com/google/cel-spec)
- [Kratos Middleware](https://go-kratos.dev/docs/component/middleware/validate)

