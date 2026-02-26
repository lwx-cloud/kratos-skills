# OpenAPI Generation Guide

This guide covers OpenAPI/Swagger documentation generation from proto files.

## Overview

Kratos can generate OpenAPI 3.0 documentation from protobuf definitions using `protoc-gen-openapi`. This allows you to:
- Auto-generate API documentation
- Import into Postman, Swagger UI, or other API tools
- Maintain single source of truth (proto files)

## Installation

```bash
# Install protoc-gen-openapi
go install github.com/google/gnostic/cmd/protoc-gen-openapi@latest

# Or install to $GOPATH/bin
go get -u github.com/google/gnostic/cmd/protoc-gen-openapi
```

## Basic Usage

### Generate OpenAPI from Proto

```bash
protoc --proto_path=. \
    --proto_path=./third_party \
    --openapi_out=. \
    api/user/v1/user.proto
```

### Output Options

```bash
# Generate with YAML output
protoc --proto_path=. \
    --proto_path=./third_party \
    --openapi_out=yaml=true:. \
    api/user/v1/user.proto

# Generate to specific directory
protoc --proto_path=. \
    --proto_path=./third_party \
    --openapi_out=path=docs/openapi:. \
    api/user/v1/user.proto
```

## Proto Annotations

### Basic OpenAPI Info

```protobuf
syntax = "proto3";

package api.user.v1;

import "google/api/annotations.proto";
import "openapi/v3/annotations.proto";

option go_package = "user/api/user/v1;v1";

// User Service API
//
// Service for managing users in the system.
// Provides CRUD operations for user management.
service UserService {
    option (openapi.v3.operation) = {
        summary: "User Service"
        description: "API for user management"
        tags: ["users"]
    };

    rpc CreateUser(CreateUserRequest) returns (User) {
        option (google.api.http) = {
            post: "/v1/users"
            body: "*"
        };
        option (openapi.v3.operation) = {
            summary: "Create a new user"
            description: "Creates a new user with the provided information"
            tags: ["users"]
        };
    }

    rpc GetUser(GetUserRequest) returns (User) {
        option (google.api.http) = {
            get: "/v1/users/{id}"
        };
        option (openapi.v3.operation) = {
            summary: "Get user by ID"
            description: "Retrieves a user by their unique identifier"
            tags: ["users"]
        };
    }
}
```

### Schema Annotations

```protobuf
// User represents a user in the system
message User {
    option (openapi.v3.schema) = {
        title: "User"
        description: "A user in the system"
        required: ["name", "email"]
    };

    // User ID
    int64 id = 1 [
        (openapi.v3.property) = {
            description: "Unique identifier for the user"
            example: { string_value: "12345" }
        }
    ];

    // User name
    string name = 2 [
        (openapi.v3.property) = {
            description: "Full name of the user"
            example: { string_value: "John Doe" }
            min_length: 1
            max_length: 100
        }
    ];

    // Email address
    string email = 3 [
        (openapi.v3.property) = {
            description: "Email address of the user"
            format: "email"
            example: { string_value: "john@example.com" }
        }
    ];

    // User status
    Status status = 4 [
        (openapi.v3.property) = {
            description: "Current status of the user"
            enum: ["ACTIVE", "INACTIVE"]
        }
    ];
}
```

### Request/Response Examples

```protobuf
message CreateUserRequest {
    option (openapi.v3.schema) = {
        example: {
            yaml_value: "name: John Doe\nemail: john@example.com"
        }
    };

    string name = 1;
    string email = 2;
}

message CreateUserResponse {
    User user = 1;

    option (openapi.v3.schema) = {
        example: {
            yaml_value: "user:\n  id: 12345\n  name: John Doe\n  email: john@example.com"
        }
    };
}
```

## Complete Example

```protobuf
syntax = "proto3";

package api.order.v1;

import "google/api/annotations.proto";
import "google/protobuf/timestamp.proto";
import "validate/validate.proto";

option go_package = "order/api/order/v1;v1";

// Order Service API
service OrderService {
    // Create a new order
    rpc CreateOrder(CreateOrderRequest) returns (Order) {
        option (google.api.http) = {
            post: "/v1/orders"
            body: "*"
        };
    }

    // Get order details
    rpc GetOrder(GetOrderRequest) returns (Order) {
        option (google.api.http) = {
            get: "/v1/orders/{order_id}"
        };
    }

    // List orders
    rpc ListOrders(ListOrdersRequest) returns (ListOrdersResponse) {
        option (google.api.http) = {
            get: "/v1/orders"
        };
    }
}

// Order message
message Order {
    string order_id = 1;
    string user_id = 2;
    repeated OrderItem items = 3;
    double total_amount = 4;
    OrderStatus status = 5;
    google.protobuf.Timestamp created_at = 6;
}

// Order item
message OrderItem {
    string product_id = 1;
    string product_name = 2;
    int32 quantity = 3;
    double unit_price = 4;
}

// Order status enum
enum OrderStatus {
    ORDER_STATUS_UNSPECIFIED = 0;
    ORDER_STATUS_PENDING = 1;
    ORDER_STATUS_CONFIRMED = 2;
    ORDER_STATUS_SHIPPED = 3;
    ORDER_STATUS_DELIVERED = 4;
    ORDER_STATUS_CANCELLED = 5;
}

// Create order request
message CreateOrderRequest {
    string user_id = 1 [(validate.rules).string.min_len = 1];
    repeated OrderItem items = 2 [(validate.rules).repeated.min_items = 1];
    string shipping_address = 3;
}

// Get order request
message GetOrderRequest {
    string order_id = 1 [(validate.rules).string.min_len = 1];
}

// List orders request
message ListOrdersRequest {
    string user_id = 1;
    int32 page_size = 2 [(validate.rules).int32.lte = 100];
    string page_token = 3;
}

// List orders response
message ListOrdersResponse {
    repeated Order orders = 1;
    string next_page_token = 2;
    int32 total_size = 3;
}
```

## Makefile Integration

```makefile
.PHONY: openapi
openapi:
	@protoc --proto_path=. \
		--proto_path=./third_party \
		--openapi_out=yaml=true:./docs \
		$(API_PROTO_FILES)
```

## Serving Swagger UI

### HTTP Handler

```go
package server

import (
    "net/http"
    "os"

    "github.com/gorilla/mux"
)

// RegisterOpenAPI registers OpenAPI documentation routes
func RegisterOpenAPI(router *mux.Router) {
    // Serve OpenAPI spec
    router.HandleFunc("/openapi.yaml", func(w http.ResponseWriter, r *http.Request) {
        data, err := os.ReadFile("docs/openapi.yaml")
        if err != nil {
            http.Error(w, err.Error(), http.StatusInternalServerError)
            return
        }
        w.Header().Set("Content-Type", "application/yaml")
        w.Write(data)
    })

    // Redirect to Swagger UI
    router.HandleFunc("/swagger", func(w http.ResponseWriter, r *http.Request) {
        http.Redirect(w, r, "/swagger-ui/", http.StatusMovedPermanently)
    })
}
```

## Using Swagger UI Docker

```yaml
# docker-compose.yaml
version: '3.8'
services:
  swagger-ui:
    image: swaggerapi/swagger-ui
    ports:
      - "8080:8080"
    environment:
      - SWAGGER_JSON=/openapi/openapi.yaml
    volumes:
      - ./docs:/openapi
```

## Best Practices

### ✅ Document All Endpoints

```protobuf
// ❌ Avoid undocumented services
service UserService {
    rpc CreateUser(CreateUserRequest) returns (User);
}

// ✅ Document with OpenAPI annotations
service UserService {
    option (openapi.v3.operation) = {
        summary: "User Service API"
        description: "Complete user management API"
    };

    rpc CreateUser(CreateUserRequest) returns (User) {
        option (google.api.http) = { post: "/v1/users" body: "*" };
        option (openapi.v3.operation) = {
            summary: "Create user"
            description: "Creates a new user account"
            tags: ["users"]
        };
    }
}
```

### ✅ Include Examples

```protobuf
message CreateUserRequest {
    option (openapi.v3.schema) = {
        example: {
            yaml_value: "name: John Doe\nemail: john@example.com\nage: 30"
        }
    };
}
```

### ✅ Use Validation Rules

```protobuf
message UserRequest {
    // These validation rules will be documented in OpenAPI
    string email = 1 [
        (validate.rules).string.email = true,
        (openapi.v3.property) = {
            format: "email"
        }
    ];

    int32 age = 2 [
        (validate.rules).int32 = { gte: 0, lte: 150 },
        (openapi.v3.property) = {
            minimum: 0
            maximum: 150
        }
    ];
}
```

## References

- [Kratos OpenAPI Guide](https://go-kratos.dev/docs/guide/openapi)
- [OpenAPI Specification](https://swagger.io/specification/)
- [protoc-gen-openapi](https://github.com/google/gnostic)

