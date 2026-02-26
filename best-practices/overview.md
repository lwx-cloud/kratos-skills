# Kratos Best Practices

This guide covers best practices for building production-ready services with kratos.

## Project Structure

### Recommended Layout

```
myapp/
├── api/                    # Proto API definitions
│   └── helloworld/
│       └── v1/
│           ├── greeter.proto
│           └── errors.proto
├── cmd/                    # Application entry points
│   └── server/
│       ├── main.go
│       ├── wire.go
│       └── wire_gen.go
├── configs/               # Configuration files
│   └── config.yaml
├── internal/              # Private application code
│   ├── server/           # Transport servers
│   ├── service/          # Service layer (API handlers)
│   ├── biz/              # Business logic
│   ├── data/             # Data access
│   └── conf/             # Config structures
├── third_party/          # Third-party proto files
├── go.mod
├── go.sum
├── Dockerfile
└── Makefile
```

### Naming Conventions

```go
// ✅ Correct: Clear, descriptive names
type UserService struct{}
type UserUsecase struct{}
type UserRepository struct{}

func (s *UserService) CreateUser(ctx context.Context, req *pb.CreateUserRequest) (*pb.User, error)
func (uc *UserUsecase) RegisterUser(ctx context.Context, u *User) (*User, error)

// ❌ Incorrect: Unclear or abbreviated names
type Svc struct{}
type UC struct{}
type Repo struct{}

func (s *Svc) Create(ctx context.Context, req *pb.Req) (*pb.Res, error)
```

## API Design

### Proto Best Practices

```protobuf
// ✅ Correct: Versioned package, clear structure
syntax = "proto3";

package user.v1;

option go_package = "myapp/api/user/v1;v1";

service UserService {
  rpc GetUser(GetUserRequest) returns (User) {
    option (google.api.http) = {
      get: "/v1/users/{user_id}"
    };
  }

  rpc CreateUser(CreateUserRequest) returns (User) {
    option (google.api.http) = {
      post: "/v1/users"
      body: "*"
    };
  }
}

message GetUserRequest {
  string user_id = 1;  // Use snake_case for fields
}

message CreateUserRequest {
  string name = 1;
  string email = 2;
}

message User {
  string user_id = 1;
  string name = 2;
  string email = 3;
  google.protobuf.Timestamp create_time = 4;
  google.protobuf.Timestamp update_time = 5;
}
```

### Error Definitions

```protobuf
// ✅ Correct: Group related errors, use descriptive names
syntax = "proto3";

package user.v1;
import "errors/errors.proto";

option go_package = "myapp/api/user/v1;v1";

enum UserErrorReason {
  option (errors.default_code) = 500;

  USER_NOT_FOUND = 0 [(errors.code) = 404];
  USER_ALREADY_EXISTS = 1 [(errors.code) = 409];
  INVALID_USER_EMAIL = 2 [(errors.code) = 400];
  UNAUTHORIZED_ACCESS = 3 [(errors.code) = 403];
}
```

## Layered Architecture

### Service Layer

```go
// ✅ Correct: Thin layer, delegates to biz
func (s *UserService) CreateUser(ctx context.Context, req *pb.CreateUserRequest) (*pb.User, error) {
    // Convert request to domain model
    u, err := s.uc.CreateUser(ctx, &biz.User{
        Name:  req.Name,
        Email: req.Email,
    })
    if err != nil {
        return nil, err
    }

    // Convert domain model to response
    return &pb.User{
        UserId: u.ID,
        Name:   u.Name,
        Email:  u.Email,
    }, nil
}

// ❌ Incorrect: Business logic in service
func (s *UserService) CreateUser(ctx context.Context, req *pb.CreateUserRequest) (*pb.User, error) {
    // Validation here instead of in biz layer
    if req.Email == "" {
        return nil, errors.New("email required")
    }

    // Direct DB access
    s.db.Exec("INSERT INTO users...")

    return &pb.User{}, nil
}
```

### Biz Layer

```go
// ✅ Correct: Pure business logic, uses interfaces
type UserUsecase struct {
    repo UserRepo
    log  *log.Helper
}

func (uc *UserUsecase) CreateUser(ctx context.Context, u *User) (*User, error) {
    // Business validation
    if !isValidEmail(u.Email) {
        return nil, ErrInvalidEmail
    }

    // Check duplicates
    if existing, _ := uc.repo.GetByEmail(ctx, u.Email); existing != nil {
        return nil, ErrUserAlreadyExists
    }

    return uc.repo.Save(ctx, u)
}

// Repository interface defined in biz layer
type UserRepo interface {
    Save(ctx context.Context, u *User) (*User, error)
    GetByID(ctx context.Context, id string) (*User, error)
    GetByEmail(ctx context.Context, email string) (*User, error)
}
```

### Data Layer

```go
// ✅ Correct: Implements interfaces, handles persistence
type userRepo struct {
    data *Data
    log  *log.Helper
}

func NewUserRepo(data *Data, logger log.Logger) biz.UserRepo {
    return &userRepo{
        data: data,
        log:  log.NewHelper(logger),
    }
}

func (r *userRepo) Save(ctx context.Context, u *biz.User) (*biz.User, error) {
    po := &UserPO{
        ID:    u.ID,
        Name:  u.Name,
        Email: u.Email,
    }

    if err := r.data.db.Create(po).Error; err != nil {
        return nil, errors.InternalServer("DB_ERROR", err.Error())
    }

    return po.ToBiz(), nil
}
```

## Dependency Injection

### Wire Best Practices

```go
// ✅ Correct: Organized provider sets
// internal/data/data.go
var ProviderSet = wire.NewSet(
    NewData,
    NewUserRepo,
    NewOrderRepo,
    // ...
)

// internal/biz/biz.go
var ProviderSet = wire.NewSet(
    NewUserUsecase,
    NewOrderUsecase,
    // ...
)

// internal/service/service.go
var ProviderSet = wire.NewSet(
    NewUserService,
    NewOrderService,
    // ...
)

// internal/server/server.go
var ProviderSet = wire.NewSet(
    NewHTTPServer,
    NewGRPCServer,
)

// cmd/server/wire.go
func wireApp(*conf.Server, *conf.Data, log.Logger) (*kratos.App, func(), error) {
    panic(wire.Build(
        server.ProviderSet,
        data.ProviderSet,
        biz.ProviderSet,
        service.ProviderSet,
        newApp,
    ))
}
```

## Logging

### Structured Logging

```go
// ✅ Correct: Use helper with context
func (s *UserService) GetUser(ctx context.Context, req *pb.GetUserRequest) (*pb.User, error) {
    s.log.WithContext(ctx).Infof("GetUser: %s", req.UserId)

    user, err := s.uc.GetUser(ctx, req.UserId)
    if err != nil {
        s.log.WithContext(ctx).Errorf("GetUser failed: %v", err)
        return nil, err
    }

    return user, nil
}

// In kratos-layout main.go
logger := log.With(log.NewStdLogger(os.Stdout),
    "ts", log.DefaultTimestamp,
    "caller", log.DefaultCaller,
    "service.id", id,
    "service.name", Name,
    "service.version", Version,
    "trace_id", tracing.TraceID(),
    "span_id", tracing.SpanID(),
)
```

### Log Levels

```go
// Use appropriate log levels
log.Debug()  // Detailed debugging info
log.Info()   // General operational info
log.Warn()   // Warning conditions
log.Error()  // Error conditions
log.Fatal()  // Fatal errors (will exit)
```

## Configuration

### Environment-based Configuration

```yaml
# configs/config.yaml
server:
  http:
    addr: "${HTTP_ADDR:0.0.0.0:8000}"
    timeout: "${HTTP_TIMEOUT:1s}"
  grpc:
    addr: "${GRPC_ADDR:0.0.0.0:9000}"
    timeout: "${GRPC_TIMEOUT:1s}"

data:
  database:
    driver: "${DB_DRIVER:mysql}"
    source: "${DB_SOURCE:root:root@tcp(127.0.0.1:3306)/test}"
```

### Loading Configuration

```go
// ✅ Correct: Multiple sources with env override
c := config.New(
    config.WithSource(
        env.NewSource("APP_"),              // Env vars (highest priority)
        file.NewSource("configs/config.yaml"), // File config
    ),
)

// Load and scan
var bc conf.Bootstrap
if err := c.Scan(&bc); err != nil {
    panic(err)
}
```

## Error Handling

### Structured Errors

```go
// ✅ Correct: Use kratos errors
var (
    ErrUserNotFound     = errors.NotFound("USER_NOT_FOUND", "user not found")
    ErrInvalidEmail     = errors.BadRequest("INVALID_EMAIL", "invalid email format")
    ErrUnauthorized     = errors.Unauthorized("UNAUTHORIZED", "unauthorized access")
    ErrInternalError    = errors.InternalServer("INTERNAL_ERROR", "internal server error")
)

func (uc *UserUsecase) GetUser(ctx context.Context, id string) (*User, error) {
    user, err := uc.repo.GetByID(ctx, id)
    if err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) {
            return nil, ErrUserNotFound
        }
        return nil, errors.InternalServer("DB_ERROR", err.Error())
    }
    return user, nil
}
```

## Middleware Stack

### Recommended Order

```go
// ✅ Correct: Proper middleware ordering
http.Middleware(
    recovery.Recovery(),        // 1. Recover from panics
    tracing.Server(),           // 2. Start trace span
    logging.Server(logger),     // 3. Log request/response
    metrics.Server(),           // 4. Collect metrics
    validate.Validator(),       // 5. Validate request
    auth.Server(validator),     // 6. Authenticate
    ratelimit.Server(limiter),  // 7. Rate limiting
)
```

## Testing

### Unit Testing

```go
// ✅ Correct: Use interfaces for mocking
func TestUserUsecase_CreateUser(t *testing.T) {
    // Mock repository
    mockRepo := &mockUserRepo{}

    uc := &UserUsecase{
        repo: mockRepo,
        log:  log.NewHelper(log.DefaultLogger),
    }

    ctx := context.Background()
    user, err := uc.CreateUser(ctx, &User{
        Name:  "test",
        Email: "test@example.com",
    })

    if err != nil {
        t.Errorf("unexpected error: %v", err)
    }

    if user.Name != "test" {
        t.Errorf("expected name 'test', got %s", user.Name)
    }
}
```

### Integration Testing

```go
// ✅ Correct: Test with real server
func TestUserAPI(t *testing.T) {
    // Start test server
    srv := testServer()
    defer srv.Close()

    // Make request
    client := pb.NewUserServiceHTTPClient(srv.Client())
    resp, err := client.GetUser(context.Background(), &pb.GetUserRequest{UserId: "123"})

    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }

    if resp.UserId != "123" {
        t.Errorf("expected user_id '123', got %s", resp.UserId)
    }
}
```

## Docker Deployment

### Dockerfile

```dockerfile
# Build stage
FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o /app/server ./cmd/server

# Runtime stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates
WORKDIR /root/

COPY --from=builder /app/server .
COPY configs/ ./configs/

EXPOSE 8000 9000

CMD ["./server", "-conf", "./configs/config.yaml"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "8000:8000"
      - "9000:9000"
    environment:
      - HTTP_ADDR=0.0.0.0:8000
      - GRPC_ADDR=0.0.0.0:9000
      - DB_SOURCE=root:root@tcp(mysql:3306)/app
    depends_on:
      - mysql
      - redis

  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: app
    ports:
      - "3306:3306"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  etcd:
    image: quay.io/coreos/etcd:latest
    ports:
      - "2379:2379"
    command: |
      /usr/local/bin/etcd
      --listen-client-urls http://0.0.0.0:2379
      --advertise-client-urls http://0.0.0.0:2379
```

## Performance

### Connection Pooling

```go
// ✅ Correct: Use connection pools
data, err := data.NewData(&conf.Data{
    Database: &conf.Data_Database{
        Driver: "mysql",
        Source: "user:pass@tcp(localhost:3306)/db",
    },
}, logger)

// GORM connection pool settings
db.DB().SetMaxOpenConns(25)
db.DB().SetMaxIdleConns(10)
db.DB().SetConnMaxLifetime(5 * time.Minute)
```

### Timeout Configuration

```go
// ✅ Correct: Set appropriate timeouts
http.NewServer(
    http.Timeout(30 * time.Second),  // Request timeout
)

grpc.NewServer(
    grpc.Timeout(30 * time.Second),
)
```

## Security

### TLS Configuration

```go
// ✅ Correct: Use TLS for production
func loadTLSConfig() (*tls.Config, error) {
    cert, err := tls.LoadX509KeyPair("server.crt", "server.key")
    if err != nil {
        return nil, err
    }

    return &tls.Config{
        Certificates: []tls.Certificate{cert},
    }, nil
}

http.NewServer(
    http.TLSConfig(tlsConfig),
)
```

### Secret Management

```go
// ✅ Correct: Use environment variables for secrets
// ❌ Never hard-code secrets
dbSource := os.Getenv("DB_SOURCE")  // Use env var

// Use external secret management (Vault, AWS Secrets Manager, etc.)
// for production environments
```

## References

- [Kratos Layout](https://github.com/go-kratos/kratos-layout)
- [Google API Design Guide](https://cloud.google.com/apis/design/)
- [Go Best Practices](https://golang.org/doc/effective_go.html)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
