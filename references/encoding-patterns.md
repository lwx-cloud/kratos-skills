# Encoding Patterns

This guide covers serialization and encoding in kratos.

## Overview

Kratos provides a flexible encoding layer for serializing/deserializing request and response bodies. It supports multiple content types and allows custom encoders.

## Default Encodings

Kratos supports these content types by default:

| Content-Type | Codec | Description |
|-------------|-------|-------------|
| `application/json` | JSON | Default encoding |
| `application/x-protobuf` | Protobuf | Binary protobuf encoding |
| `application/x-www-form-urlencoded` | Form | Form data encoding |
| `application/octet-stream` | Bytes | Raw bytes |

## Codec Interface

```go
package encoding

// Codec defines the encoding interface
type Codec interface {
    // Marshal returns the wire format of v
    Marshal(v interface{}) ([]byte, error)
    // Unmarshal parses the wire format into v
    Unmarshal(data []byte, v interface{}) error
    // Name returns the name of the Codec
    Name() string
}
```

## Using Custom Codec

### Creating a Custom Codec

```go
package encoding

import (
    "github.com/go-kratos/kratos/v2/encoding"
    yaml "gopkg.in/yaml.v3"
)

// YAMLCodec implements encoding.Codec for YAML
type YAMLCodec struct{}

func (c *YAMLCodec) Marshal(v interface{}) ([]byte, error) {
    return yaml.Marshal(v)
}

func (c *YAMLCodec) Unmarshal(data []byte, v interface{}) error {
    return yaml.Unmarshal(data, v)
}

func (c *YAMLCodec) Name() string {
    return "yaml"
}
```

### Registering Custom Codec

```go
package main

import (
    "github.com/go-kratos/kratos/v2/encoding"
)

func init() {
    // Register YAML codec
    encoding.RegisterCodec(&YAMLCodec{})
}
```

### Server-Side Content Negotiation

```go
package server

import (
    "github.com/go-kratos/kratos/v2/transport/http"
)

func NewHTTPServer(c *conf.Server, logger log.Logger) *http.Server {
    var opts = []http.ServerOption{
        http.Address(c.Http.Addr),
        // Request/Response encoding is automatic based on Content-Type
        // Accept headers support: application/json, application/x-protobuf, etc.
    }

    return http.NewServer(opts...)
}
```

## HTTP Request/Response Encoding

### Request Body Encoding

```go
// Client request with specific encoding
import (
    "github.com/go-kratos/kratos/v2/encoding/json"
)

// Automatic based on Content-Type header
// application/json -> JSON codec
// application/x-protobuf -> Protobuf codec
```

### Response Encoding

```go
package service

import (
    "github.com/go-kratos/kratos/v2/transport/http"
)

func (s *UserService) GetUser(ctx context.Context, req *pb.GetUserRequest) (*pb.User, error) {
    // Response encoding is automatic based on Accept header
    // or request Content-Type (for POST/PUT)
    return s.uc.GetUser(ctx, req.Id)
}
```

## gRPC Encoding

```go
// gRPC uses protobuf encoding by default
// Custom codec can be registered for specific content types

package server

import (
    "github.com/go-kratos/kratos/v2/transport/grpc"
)

func NewGRPCServer(c *conf.Server, logger log.Logger) *grpc.Server {
    var opts = []grpc.ServerOption{
        grpc.Address(c.Grpc.Addr),
        // gRPC always uses protobuf encoding for messages
    }

    return grpc.NewServer(opts...)
}
```

## Form Encoding

### Parsing Form Data

```go
package service

import (
    "github.com/go-kratos/kratos/v2/transport/http"
    "github.com/go-kratos/kratos/v2/encoding/form"
)

type CreateUserForm struct {
    Name  string `form:"name"`
    Email string `form:"email"`
    Age   int    `form:"age"`
}

func (s *UserService) CreateUserFromForm(ctx http.Context) error {
    var form CreateUserForm
    if err := ctx.Bind(&form); err != nil {
        return err
    }
    // Process form data...
}
```

### Form Codec Usage

```go
import (
    "github.com/go-kratos/kratos/v2/encoding/form"
)

func main() {
    // Marshal struct to form values
    data := &CreateUserForm{
        Name:  "John",
        Email: "john@example.com",
    }

    // Encode to URL-encoded string
    encoded, err := form.Marshal(data)
    // "name=John&email=john%40example.com"

    // Decode from form data
    var decoded CreateUserForm
    err = form.Unmarshal(encoded, &decoded)
}
```

## Encoding Best Practices

### ✅ Correct Usage

```go
// Use proto messages for API responses
// They have built-in JSON and Protobuf codec support

message User {
    int64 id = 1;
    string name = 2;
    string email = 3;
}

// Kratos automatically handles encoding based on headers
func (s *UserService) GetUser(ctx context.Context, req *pb.GetUserRequest) (*pb.User, error) {
    return &pb.User{
        Id:    1,
        Name:  "John",
        Email: "john@example.com",
    }, nil
}
```

### ❌ Incorrect Usage

```go
// Don't return raw Go structs without codec support
func (s *UserService) GetUser(ctx context.Context, req *pb.GetUserRequest) (*UserModel, error) {
    // UserModel is a database model without proto definition
    // Won't have proper encoding support
    return &UserModel{}, nil
}
```

### ✅ Custom Codec for Special Types

```go
// Register custom codec for special serialization needs
func init() {
    encoding.RegisterCodec(&MessagePackCodec{})
}

// Client can request via Accept: application/x-msgpack
```

## References

- [Kratos Encoding](https://go-kratos.dev/docs/component/encoding)
- [Protocol Buffers](https://developers.google.com/protocol-buffers)

