# OpenAPI Generation

Treat Protobuf API definitions and HTTP annotations as the source of truth. Use the repository's pinned `protoc-gen-openapi`, Buf, or Make target; inspect those files before changing generation commands.

## Contents

- [Generation](#generation)
- [Contract annotations](#contract-annotations)
- [Compatibility](#compatibility)
- [Serving documentation](#serving-documentation)
- [Verification](#verification)

## Generation

Prefer the repository-owned target because it fixes plugin versions, include paths, options, and output location:

```bash
make openapi
```

When the repository exposes a direct command, preserve its existing parameters:

```bash
protoc \
  --proto_path=. \
  --proto_path=third_party \
  --openapi_out=yaml=true:docs/openapi \
  api/user/v1/user.proto
```

Pin tool versions in the same mechanism as the other generators. A local installation, CI image, `tools.go`, Buf remote plugin, or Make variable is valid when it is already repository policy.

## Contract Annotations

Start with the HTTP mapping; it determines the public operation:

```protobuf
rpc CreateUser(CreateUserRequest) returns (User) {
  option (google.api.http) = {
    post: "/v1/users"
    body: "*"
  };
  option (openapi.v3.operation) = {
    summary: "Create user"
    tags: "users"
  };
}
```

Add schema metadata where it contributes contract detail beyond comments and validation rules:

```protobuf
message CreateUserRequest {
  string email = 1 [
    (buf.validate.field).string.email = true,
    (openapi.v3.property) = {
      description: "Account email"
      format: "email"
    }
  ];
}
```

Match the repository's validation system; read [validate-patterns.md](validate-patterns.md) before changing PGV or Protovalidate annotations. Keep examples synthetic and stable.

## Compatibility

Review generated changes as public API changes:

- Paths, methods, request bodies, path parameters, and response schemas must match generated Kratos handlers.
- Required fields, enum values, field types, and error shapes affect clients even when Go code still compiles.
- Operation IDs and tags may drive client names or documentation navigation.
- Removed or renamed schemas require an explicit migration plan.
- Generated output should be reproducible from a clean tree with the pinned toolchain.

Commit generated specifications only when repository policy does so. Keep generation output in one location rather than maintaining a second handwritten specification.

## Serving Documentation

Separate specification generation from UI hosting. If the service exposes the specification or Swagger UI, define:

- environments where the route is enabled;
- authentication and network exposure;
- cache headers and content type;
- whether the served artifact is embedded at build time or read from disk;
- a version relationship between the running service and published document.

Production exposure is a deployment policy decision, not a generator default.

## Verification

Complete an OpenAPI change when the pinned repository target succeeds, a second run is clean, every intended operation and schema appears, paths match generated handlers, compatibility changes are reviewed, examples contain no secrets, and documentation serving has an explicit exposure policy.

## References

- [Kratos OpenAPI Guide](https://go-kratos.dev/docs/guide/openapi)
- [protoc-gen-openapi](https://github.com/google/gnostic/tree/main/cmd/protoc-gen-openapi)
- [OpenAPI Specification](https://spec.openapis.org/oas/latest.html)
