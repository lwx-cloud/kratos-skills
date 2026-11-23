# API Definition Patterns

> Generator behavior follows the [compatibility baseline](compatibility.md). Use repository-owned Buf, Make, or Kratos CLI commands.

## Contents

- [Start from the contract](#start-from-the-contract)
- [Map HTTP semantics](#map-http-semantics)
- [Design request and response messages](#design-request-and-response-messages)
- [Preserve compatibility](#preserve-compatibility)
- [Generate and register](#generate-and-register)
- [Verification](#verification)

## Start from the contract

Define the public API in versioned Protobuf packages when the repository is proto-first:

```protobuf
syntax = "proto3";

package user.v1;

import "google/api/annotations.proto";

option go_package = "example.com/project/api/user/v1;v1";

service UserService {
  rpc CreateUser(CreateUserRequest) returns (User) {
    option (google.api.http) = {
      post: "/v1/users"
      body: "*"
    };
  }

  rpc GetUser(GetUserRequest) returns (User) {
    option (google.api.http) = {
      get: "/v1/users/{user_id}"
    };
  }
}

message CreateUserRequest {
  string name = 1;
  string email = 2;
}

message GetUserRequest {
  string user_id = 1;
}

message User {
  string user_id = 1;
  string name = 2;
  string email = 3;
}
```

Use stable resource nouns, consistent method names, and specific request messages. Define validation and structured errors through the repository's selected contract system.

## Map HTTP semantics

| Operation | HTTP mapping | Body |
| --- | --- | --- |
| Create | `POST /v1/resources` | request or resource field |
| Get | `GET /v1/resources/{resource_id}` | none |
| List | `GET /v1/resources` | none |
| Update | `PATCH /v1/resources/{resource.resource_id}` | updated resource |
| Delete | `DELETE /v1/resources/{resource_id}` | none |
| Custom action | `POST /v1/resources/{resource_id}:action` | action request |

Bind each path variable to a request field and keep body mappings disjoint from path fields. Use additional bindings only when one RPC genuinely supports multiple stable HTTP forms.

## Design request and response messages

- Use dedicated request messages even when an RPC currently has one field.
- Use `google.protobuf.FieldMask` for partial updates.
- Use opaque page tokens and a bounded page size for lists.
- Represent absence explicitly with optional fields or wrapper/message semantics appropriate to the repository's Protobuf edition.
- Keep transport fields separate from persistence-specific columns and ORM models.

Example partial update:

```protobuf
import "google/protobuf/field_mask.proto";

message UpdateUserRequest {
  User user = 1;
  google.protobuf.FieldMask update_mask = 2;
}
```

Define idempotency behavior for creates, retries, and custom actions when duplicate execution could cause harm.

## Preserve compatibility

- Keep existing field numbers and wire types.
- Reserve removed field numbers and names.
- Add fields with backward-compatible defaults.
- Keep package and HTTP versioning aligned with repository policy.
- Treat enum zero values as an explicit unspecified state.
- Run the repository's breaking-change check before approving public contract changes.

For intentional breaking changes, document callers, rollout order, migration window, and generated-client impact before implementation.

## Generate and register

Use the commands already defined by the project. Typical outputs include message types, gRPC interfaces, Kratos HTTP bindings, structured errors, and validation artifacts.

Register generated services in the matching transport constructor:

```go
srv := http.NewServer(options...)
v1.RegisterUserServiceHTTPServer(srv, service)
```

Change `.proto` sources and generator configuration rather than editing generated `.pb.go`, `_grpc.pb.go`, `_http.pb.go`, error, or validation files.

## Verification

Complete an API change when:

- `go_package`, package version, HTTP annotations, path fields, and body mappings are valid;
- validation and structured errors cover modified requests;
- compatibility checks pass or an approved migration accounts for every caller;
- repository generation produces the expected tracked outputs;
- HTTP and gRPC contract tests cover success and representative failures; and
- generated files contain no manual edits.

## Sources

- [Google API design guide](https://cloud.google.com/apis/design/)
- [Google API annotations](https://github.com/googleapis/googleapis/tree/master/google/api)
- [Protocol Buffers style guide](https://protobuf.dev/programming-guides/style/)
