# API Definition Patterns

This guide covers API definition patterns in kratos using Protocol Buffers with Google API design guidelines.

## Overview

Kratos uses Protobuf for API definition, supporting both REST (HTTP/JSON) and gRPC transports from a single source of truth. The API design follows [Google API Design Guide](https://cloud.google.com/apis/design/).

## Key Concepts

- **Proto-first**: Define APIs in `.proto` files, generate Go code
- **Transport duality**: Single proto generates both HTTP and gRPC handlers
- **Google API annotations**: Use `google.api.http` for HTTP mapping
- **Code generation**: Use `kratos proto` CLI for consistent code generation

## Complete API Workflow

### 1. Define Proto File

```protobuf
syntax = "proto3";

package helloworld.v1;

import "google/api/annotations.proto";

option go_package = "github.com/go-kratos/kratos-layout/api/helloworld/v1;v1";

// The greeting service definition.
service Greeter {
  // Sends a greeting
  rpc SayHello (HelloRequest) returns (HelloReply)  {
    option (google.api.http) = {
      get: "/helloworld/{name}"
    };
  }

  // Create a greeting
  rpc CreateHello (CreateHelloRequest) returns (HelloReply) {
    option (google.api.http) = {
      post: "/helloworld"
      body: "*"
    };
  }
}

// The request message containing the user's name.
message HelloRequest {
  string name = 1;
}

message CreateHelloRequest {
  string name = 1;
  string message = 2;
}

// The response message containing the greetings
message HelloReply {
  string message = 1;
}
```

### 2. Generate Client Code

```bash
kratos proto client api/helloworld/v1/greeter.proto
```

Generates:
- `greeter.pb.go` - Protobuf message types
- `greeter_grpc.pb.go` - gRPC client/server interfaces
- `greeter_http.pb.go` - HTTP handlers and clients

### 3. Generate Server Stub

```bash
kratos proto server api/helloworld/v1/greeter.proto -t internal/service
```

Generates `internal/service/greeter.go`:

```go
package service

import (
    "context"
    pb "helloworld/api/helloworld/v1"
)

type GreeterService struct {
    pb.UnimplementedGreeterServer
}

func NewGreeterService() pb.GreeterServer {
    return &GreeterService{}
}

func (s *GreeterService) SayHello(ctx context.Context, req *pb.HelloRequest) (*pb.HelloReply, error) {
    return &pb.HelloReply{}, nil
}

func (s *GreeterService) CreateHello(ctx context.Context, req *pb.CreateHelloRequest) (*pb.HelloReply, error) {
    return &pb.HelloReply{}, nil
}
```

### 4. Register in Server

```go
// internal/server/http.go
func NewHTTPServer(c *conf.Server, greeter *service.GreeterService, logger log.Logger) *http.Server {
    var opts = []http.ServerOption{
        http.Middleware(
            recovery.Recovery(),
            logging.Server(logger),
        ),
    }
    if c.Http.Network != "" {
        opts = append(opts, http.Network(c.Http.Network))
    }
    if c.Http.Addr != "" {
        opts = append(opts, http.Address(c.Http.Addr))
    }
    if c.Http.Timeout != nil {
        opts = append(opts, http.Timeout(c.Http.Timeout.AsDuration()))
    }
    srv := http.NewServer(opts...)
    v1.RegisterGreeterHTTPServer(srv, greeter)
    return srv
}
```

## HTTP Mapping Patterns

### GET with Path Parameters

```protobuf
rpc GetUser(GetUserRequest) returns (User) {
  option (google.api.http) = {
    get: "/v1/users/{user_id}"
  };
}

message GetUserRequest {
  string user_id = 1;
}
```

### POST with Body

```protobuf
rpc CreateUser(CreateUserRequest) returns (User) {
  option (google.api.http) = {
    post: "/v1/users"
    body: "*"
  };
}

message CreateUserRequest {
  string name = 1;
  string email = 2;
}
```

### PUT with Body

```protobuf
rpc UpdateUser(UpdateUserRequest) returns (User) {
  option (google.api.http) = {
    put: "/v1/users/{user_id}"
    body: "*"
  };
}

message UpdateUserRequest {
  string user_id = 1;
  string name = 2;
}
```

### DELETE

```protobuf
rpc DeleteUser(DeleteUserRequest) returns (google.protobuf.Empty) {
  option (google.api.http) = {
    delete: "/v1/users/{user_id}"
  };
}

message DeleteUserRequest {
  string user_id = 1;
}
```

### Multiple Bindings

```protobuf
rpc GetUser(GetUserRequest) returns (User) {
  option (google.api.http) = {
    get: "/v1/users/{user_id}"
    additional_bindings {
      get: "/v1/users/email/{email}"
    }
  };
}
```

## CRUD API Patterns

### Standard CRUD Operations

```protobuf
service UserService {
  // Create
  rpc CreateUser(CreateUserRequest) returns (User) {
    option (google.api.http) = {
      post: "/v1/users"
      body: "user"
    };
  }

  // Read
  rpc GetUser(GetUserRequest) returns (User) {
    option (google.api.http) = {
      get: "/v1/users/{user_id}"
    };
  }

  // Update
  rpc UpdateUser(UpdateUserRequest) returns (User) {
    option (google.api.http) = {
      put: "/v1/users/{user_id}"
      body: "user"
    };
  }

  // Delete
  rpc DeleteUser(DeleteUserRequest) returns (google.protobuf.Empty) {
    option (google.api.http) = {
      delete: "/v1/users/{user_id}"
    };
  }

  // List
  rpc ListUsers(ListUsersRequest) returns (ListUsersResponse) {
    option (google.api.http) = {
      get: "/v1/users"
    };
  }
}

message CreateUserRequest {
  User user = 1;
}

message GetUserRequest {
  string user_id = 1;
}

message UpdateUserRequest {
  string user_id = 1;
  User user = 2;
}

message DeleteUserRequest {
  string user_id = 1;
}

message ListUsersRequest {
  int32 page_size = 1;
  string page_token = 2;
}

message ListUsersResponse {
  repeated User users = 1;
  string next_page_token = 2;
}

message User {
  string user_id = 1;
  string name = 2;
  string email = 3;
  google.protobuf.Timestamp create_time = 4;
  google.protobuf.Timestamp update_time = 5;
}
```

## ✅ Correct vs ❌ Incorrect Examples

### ✅ Correct: Proper HTTP Mapping

```protobuf
// Use RESTful resource naming
rpc GetUser(GetUserRequest) returns (User) {
  option (google.api.http) = {
    get: "/v1/users/{user_id}"
  };
}

// Use body for POST/PUT with complex data
rpc CreateUser(CreateUserRequest) returns (User) {
  option (google.api.http) = {
    post: "/v1/users"
    body: "*"
  };
}
```

### ❌ Incorrect: Improper HTTP Mapping

```protobuf
// Avoid using verbs in URL paths
rpc GetUser(GetUserRequest) returns (User) {
  option (google.api.http) = {
    get: "/v1/getUser"  // Wrong: verb in path
  };
}

// Don't forget body for POST with data
rpc CreateUser(CreateUserRequest) returns (User) {
  option (google.api.http) = {
    post: "/v1/users"
    // Missing: body: "*"
  };
}
```

### ✅ Correct: Proper Request/Response Types

```protobuf
// Use specific request/response messages
rpc GetUser(GetUserRequest) returns (User);

message GetUserRequest {
  string user_id = 1;
}
```

### ❌ Incorrect: Using Raw Types

```protobuf
// Avoid using primitive types directly
rpc GetUser(string) returns (User);  // Wrong: no request message
```

### ✅ Correct: Proto File Organization

```bash
api/
├── helloworld/
│   └── v1/
│       ├── greeter.proto      # Service definition
│       ├── greeter.pb.go      # Generated
│       ├── greeter_grpc.pb.go # Generated
│       ├── greeter_http.pb.go # Generated
│       └── errors.proto       # Error definitions
```

### ❌ Incorrect: Flat Structure

```bash
# Wrong: all proto files in root
api/
├── greeter.proto
├── user.proto
├── order.proto
```

## Naming Conventions

### Package Names

```protobuf
// ✅ Correct: versioned package with domain
package helloworld.v1;
option go_package = "github.com/go-kratos/kratos-layout/api/helloworld/v1;v1";

// ❌ Incorrect: unversioned
package helloworld;
```

### Service Names

```protobuf
// ✅ Correct: noun, singular
service UserService { }
service OrderService { }

// ❌ Incorrect: verb or plural
service CreateUser { }
service Users { }
```

### Method Names

```protobuf
// ✅ Correct: verb + noun
rpc CreateUser(CreateUserRequest) returns (User);
rpc GetUser(GetUserRequest) returns (User);
rpc ListUsers(ListUsersRequest) returns (ListUsersResponse);

// ❌ Incorrect: inconsistent naming
rpc UserCreate(CreateUserRequest) returns (User);
rpc FetchUser(GetUserRequest) returns (User);
rpc GetUsers(ListUsersRequest) returns (ListUsersResponse);
```

## Advanced Patterns

### Custom HTTP Options

```protobuf
import "google/api/annotations.proto";

service FileService {
  rpc UploadFile(stream UploadFileRequest) returns (File) {
    option (google.api.http) = {
      post: "/v1/files:upload"
      body: "*"
    };
  }
}
```

### Field Masks for Partial Updates

```protobuf
import "google/protobuf/field_mask.proto";

rpc UpdateUser(UpdateUserRequest) returns (User) {
  option (google.api.http) = {
    patch: "/v1/users/{user.user_id}"
    body: "*"
  };
}

message UpdateUserRequest {
  User user = 1;
  google.protobuf.FieldMask update_mask = 2;  // Fields to update
}
```

## References

- [Google API Design Guide](https://cloud.google.com/apis/design/)
- [Google API Annotations](https://github.com/googleapis/googleapis/tree/master/google/api)
- [Protocol Buffers Style Guide](https://developers.google.com/protocol-buffers/docs/style)
