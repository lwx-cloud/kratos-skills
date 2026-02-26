# Error Handling Patterns

This guide covers error handling patterns in kratos.

## Overview

Kratos provides a structured error model with the following fields:
- **code**: HTTP status code (also convertible to gRPC status)
- **reason**: Business error code (unique string identifier)
- **message**: Human-readable error message
- **metadata**: Additional extensible information

## Error Structure

HTTP response format:
```json
{
  "code": 500,
  "reason": "USER_NOT_FOUND",
  "message": "user with id 123 not found",
  "metadata": {
    "user_id": "123",
    "retry_after": "60"
  }
}
```

## Error Definition with Proto

### 1. Install protoc-gen-go-errors

```bash
go install github.com/go-kratos/kratos/cmd/protoc-gen-go-errors/v2@latest
```

### 2. Define Errors in Proto

```protobuf
syntax = "proto3";

package api.helloworld.v1;
import "errors/errors.proto";

option go_package = "github.com/go-kratos/kratos-layout/api/helloworld/v1;v1";

enum ErrorReason {
  // Set default error code for all errors in this enum
  option (errors.default_code) = 500;

  // Specific errors with custom codes
  USER_NOT_FOUND = 0 [(errors.code) = 404];
  CONTENT_MISSING = 1 [(errors.code) = 400];
  INVALID_EMAIL = 2 [(errors.code) = 400];
  UNAUTHORIZED = 3 [(errors.code) = 401];
  FORBIDDEN = 4 [(errors.code) = 403];
  INTERNAL_ERROR = 5 [(errors.code) = 500];
}
```

### 3. Generate Error Code

```bash
# Using Makefile
make errors

# Or directly with protoc
protoc --proto_path=. \
  --proto_path=./third_party \
  --go_out=paths=source_relative:. \
  --go-errors_out=paths=source_relative:. \
  api/helloworld/v1/errors.proto
```

### 4. Generated Code

```go
// api/helloworld/v1/errors_errors.pb.go
func IsUserNotFound(err error) bool {
    if err == nil {
        return false
    }
    e := errors.FromError(err)
    return e.Reason == ErrorReason_USER_NOT_FOUND.String() && e.Code == 404
}

func ErrorUserNotFound(format string, args ...interface{}) *errors.Error {
    return errors.New(404, ErrorReason_USER_NOT_FOUND.String(), fmt.Sprintf(format, args...))
}

func IsContentMissing(err error) bool {
    if err == nil {
        return false
    }
    e := errors.FromError(err)
    return e.Reason == ErrorReason_CONTENT_MISSING.String() && e.Code == 400
}

func ErrorContentMissing(format string, args ...interface{}) *errors.Error {
    return errors.New(400, ErrorReason_CONTENT_MISSING.String(), fmt.Sprintf(format, args...))
}
```

## Using Errors

### Creating Errors

```go
import (
    "github.com/go-kratos/kratos/v2/errors"
    v1 "helloworld/api/helloworld/v1"
)

// Using generated error functions
err := v1.ErrorUserNotFound("user %s not found", userID)

// Using errors.New directly
err := errors.New(404, "USER_NOT_FOUND", "user not found")

// Using standard error helpers
err := errors.BadRequest("INVALID_PARAM", "name is required")
err := errors.Unauthorized("UNAUTHORIZED", "invalid token")
err := errors.Forbidden("FORBIDDEN", "access denied")
err := errors.NotFound("USER_NOT_FOUND", "user not found")
err := errors.InternalServer("INTERNAL_ERROR", "something went wrong")
err := errors.ServiceUnavailable("SERVICE_UNAVAILABLE", "service temporarily unavailable")
```

### Adding Metadata

```go
err := v1.ErrorUserNotFound("user %s not found", userID)
err = err.WithMetadata(map[string]string{
    "user_id": userID,
    "requested_at": time.Now().String(),
})
```

### Error Assertion

```go
// Using generated IsXXX functions
if v1.IsUserNotFound(err) {
    // Handle user not found
}

// Using errors.Is
if errors.Is(err, errors.BadRequest("USER_NAME_EMPTY", "")) {
    // Handle bad request
}

// Using errors.FromError to inspect
if e := errors.FromError(err); e != nil {
    if e.Code == 404 && e.Reason == "USER_NOT_FOUND" {
        // Handle specific error
    }
}
```

## ✅ Correct vs ❌ Incorrect Examples

### ✅ Correct: Structured Errors

```go
// Use structured errors with proper codes
func (uc *UserUsecase) GetUser(ctx context.Context, id int64) (*User, error) {
    user, err := uc.repo.FindByID(ctx, id)
    if err != nil {
        if errors.Is(err, sql.ErrNoRows) {
            return nil, v1.ErrorUserNotFound("user %d not found", id)
        }
        return nil, errors.InternalServer("INTERNAL_ERROR", err.Error())
    }
    return user, nil
}
```

### ❌ Incorrect: Raw Errors

```go
// Wrong: returning raw errors
func (uc *UserUsecase) GetUser(ctx context.Context, id int64) (*User, error) {
    user, err := uc.repo.FindByID(ctx, id)
    if err != nil {
        return nil, err  // Wrong: raw error
    }
    return user, nil
}

// Wrong: using fmt.Errorf
func (uc *UserUsecase) GetUser(ctx context.Context, id int64) (*User, error) {
    user, err := uc.repo.FindByID(ctx, id)
    if err != nil {
        return nil, fmt.Errorf("user not found: %w", err)  // Wrong
    }
    return user, nil
}
```

### ✅ Correct: Domain-Specific Errors

```go
// Define domain errors in biz layer
var (
    ErrUserNotFound = errors.NotFound("USER_NOT_FOUND", "user not found")
    ErrInvalidEmail = errors.BadRequest("INVALID_EMAIL", "invalid email format")
    ErrDuplicateUser = errors.BadRequest("DUPLICATE_USER", "user already exists")
)

func (uc *UserUsecase) CreateUser(ctx context.Context, u *User) (*User, error) {
    if !isValidEmail(u.Email) {
        return nil, ErrInvalidEmail
    }
    // ...
}
```

### ❌ Incorrect: Generic Errors

```go
// Wrong: generic errors without context
func (uc *UserUsecase) CreateUser(ctx context.Context, u *User) (*User, error) {
    if !isValidEmail(u.Email) {
        return nil, errors.New(400, "BAD_REQUEST", "bad request")  // Too generic
    }
    // ...
}
```

## Error Handling Patterns

### Repository Layer

```go
func (r *userRepo) FindByID(ctx context.Context, id int64) (*biz.User, error) {
    var user UserPO
    result := r.data.db.First(&user, id)
    if result.Error != nil {
        if errors.Is(result.Error, gorm.ErrRecordNotFound) {
            return nil, v1.ErrorUserNotFound("user %d not found", id)
        }
        // Wrap database errors as internal errors
        return nil, errors.InternalServer("DB_ERROR", result.Error.Error())
    }
    return user.ToBiz(), nil
}
```

### Use Case Layer

```go
func (uc *UserUsecase) GetUser(ctx context.Context, id int64) (*biz.User, error) {
    user, err := uc.repo.FindByID(ctx, id)
    if err != nil {
        // Add context to error
        return nil, fmt.Errorf("failed to get user: %w", err)
    }
    return user, nil
}
```

### Service Layer

```go
func (s *UserService) GetUser(ctx context.Context, req *v1.GetUserRequest) (*v1.User, error) {
    user, err := s.uc.GetUser(ctx, req.Id)
    if err != nil {
        // Return error directly - transport layer will serialize it
        return nil, err
    }
    return &v1.User{
        Id:    user.ID,
        Name:  user.Name,
        Email: user.Email,
    }, nil
}
```

## HTTP to gRPC Status Conversion

Kratos automatically converts HTTP status codes to gRPC status codes:

| HTTP Status | gRPC Status |
|-------------|-------------|
| 200 | OK |
| 400 | INVALID_ARGUMENT |
| 401 | UNAUTHENTICATED |
| 403 | PERMISSION_DENIED |
| 404 | NOT_FOUND |
| 429 | RESOURCE_EXHAUSTED |
| 500 | INTERNAL |
| 502 | UNAVAILABLE |
| 503 | UNAVAILABLE |
| 504 | DEADLINE_EXCEEDED |

## Validation Errors

```go
// Using validate middleware
import "github.com/go-kratos/kratos/v2/middleware/validate"

func NewHTTPServer(c *conf.Server, greeter *service.GreeterService, logger log.Logger) *http.Server {
    var opts = []http.ServerOption{
        http.Middleware(
            recovery.Recovery(),
            validate.Validator(),  // Automatically validates proto messages
            logging.Server(logger),
        ),
    }
    // ...
}

// Proto with validation rules
message CreateUserRequest {
    string name = 1 [(validate.rules).string = {
        min_len: 1,
        max_len: 100
    }];
    string email = 2 [(validate.rules).string = {
        email: true
    }];
}
```

## References

- [Kratos Errors](https://go-kratos.dev/docs/component/errors)
- [gRPC Status Codes](https://grpc.github.io/grpc/core/md_doc_statuscodes.html)
- [HTTP Status Codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
