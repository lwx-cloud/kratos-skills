# Encoding Patterns

Read [compatibility.md](compatibility.md) before copying transport APIs. Start from generated Protobuf contracts and the repository's existing HTTP customization.

## Contents

- [Default behavior](#default-behavior)
- [Custom codecs](#custom-codecs)
- [HTTP customization](#http-customization)
- [Boundary rules](#boundary-rules)
- [Verification](#verification)

## Default Behavior

Kratos selects registered codecs by content subtype. Generated gRPC services use Protobuf; generated HTTP handlers normally encode Protobuf messages through the transport's default request, response, and error codecs.

Keep API responses as generated message types. Translate database entities and internal domain objects before returning from `internal/service`, so wire representation remains owned by the API contract.

## Custom Codecs

A codec must be concurrency-safe and return a static, non-empty name:

```go
type Codec interface {
    Marshal(any) ([]byte, error)
    Unmarshal([]byte, any) error
    Name() string
}
```

Register a custom codec once during process initialization:

```go
type YAMLCodec struct{}

func (YAMLCodec) Name() string                  { return "yaml" }
func (YAMLCodec) Marshal(v any) ([]byte, error) { return yaml.Marshal(v) }
func (YAMLCodec) Unmarshal(data []byte, v any) error {
    return yaml.Unmarshal(data, v)
}

func init() {
    encoding.RegisterCodec(YAMLCodec{})
}
```

Registration is process-global and a duplicate lowercase name replaces the previous codec. Use a custom codec only when clients and media types are explicitly governed; JSON and Protobuf cover most service contracts.

## HTTP Customization

Customize generated HTTP behavior through server options:

```go
server := http.NewServer(
    http.RequestDecoder(decodeRequest),
    http.ResponseEncoder(encodeResponse),
    http.ErrorEncoder(encodeError),
)
```

Wrap the defaults when only one behavior changes. A custom response envelope or error body is an API contract change: update OpenAPI, generated clients or gateways, compatibility tests, and consumers together.

Match `Content-Type` and `Accept` behavior explicitly. Reject unsupported media types and malformed input with stable Kratos errors; keep internal error details out of encoded responses.

## Boundary Rules

- Define JSON names, enum representation, timestamps, optional fields, and unknown-field behavior in the contract.
- Bound request bodies before decoding and use decoders with bounded allocation behavior.
- Keep encoding deterministic when responses are signed, cached, or compared in tests.
- Preserve HTTP status and Kratos error semantics when changing envelopes.
- Test browser, gateway, and generated-client behavior for any non-default media type.
- Keep secrets and raw internal errors out of serialization diagnostics.

## Verification

Complete an encoding change when codec lookup and registration are tested, supported and unsupported content types behave explicitly, malformed and oversized input is bounded, success and error responses preserve the public contract, and generated HTTP and gRPC clients remain compatible.

## References

- [Kratos Encoding](https://go-kratos.dev/docs/component/encoding)
- [Kratos HTTP Transport](https://go-kratos.dev/docs/component/transport/http)
