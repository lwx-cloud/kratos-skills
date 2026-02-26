# Getting Started with Claude Code

This guide explains how to use kratos-skills with Claude Code.

## Installation

The kratos-skills is automatically available in Claude Code when working with kratos projects.

### Automatic Detection

Claude Code automatically loads kratos-skills when:
- Your project imports `github.com/go-kratos/kratos`
- Your project has kratos-specific files (proto files, wire.go, etc.)
- You invoke it manually with `/kratos-skills`

### Manual Invocation

```
/kratos-skills
```

This command loads the skill and makes all patterns and best practices available.

## Quick Reference

### Common Tasks

| Task | How to Ask |
|------|------------|
| Create new service | "Create a new user service with CRUD operations" |
| Define proto API | "Define a proto API for order service with create, get, list methods" |
| Implement repository | "Implement user repository interface in data layer" |
| Add middleware | "Add authentication middleware to the HTTP server" |
| Configure registry | "Configure etcd service discovery" |
| Handle errors | "Add proper error handling for user not found" |

### Key Principles

When generating or reviewing code, Claude will:

1. **Enforce layered architecture**: Service → Biz → Data
2. **Use proto-first approach**: Define APIs in .proto files
3. **Apply Wire DI**: Use compile-time dependency injection
4. **Follow error conventions**: Use kratos structured errors
5. **Respect interfaces**: Define in biz, implement in data

## Example Workflows

### Creating a New Service

```
User: Create a new user service with registration and login

Claude will:
1. Create proto API definition
2. Generate client/server code
3. Implement service layer (delegation only)
4. Create biz layer with use cases
5. Implement data layer with repository
6. Configure Wire injection
7. Add middleware (logging, recovery, auth)
```

### Adding CRUD Operations

```
User: Add CRUD operations for product entity

Claude will:
1. Extend proto with CreateProduct, GetProduct, UpdateProduct, DeleteProduct, ListProducts
2. Generate code
3. Implement repository interface
4. Add use cases with business logic
5. Connect service to biz layer
```

### Configuring Service Discovery

```
User: Setup etcd service discovery

Claude will:
1. Add etcd registry import
2. Configure registrar in main.go
3. Show client discovery example
4. Provide docker-compose for local testing
```

## Pattern Reference

### API Patterns

```protobuf
// RESTful API with Google API annotations
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
```

### Layered Architecture

```go
// Service: HTTP/gRPC handlers (no business logic)
func (s *UserService) CreateUser(ctx context.Context, req *pb.CreateUserRequest) (*pb.User, error) {
    u, err := s.uc.CreateUser(ctx, &biz.User{Name: req.Name})
    if err != nil {
        return nil, err
    }
    return &pb.User{Id: u.ID, Name: u.Name}, nil
}

// Biz: Business logic and interfaces
type UserUsecase struct {
    repo UserRepo
}

func (uc *UserUsecase) CreateUser(ctx context.Context, u *User) (*User, error) {
    // Validation and business rules
    return uc.repo.Save(ctx, u)
}

type UserRepo interface {
    Save(ctx context.Context, u *User) (*User, error)
}

// Data: Repository implementation
type userRepo struct {
    data *Data
}

func (r *userRepo) Save(ctx context.Context, u *biz.User) (*biz.User, error) {
    // Database operations
    return u, nil
}
```

### Wire Configuration

```go
// ProviderSets
var DataProviderSet = wire.NewSet(NewData, NewUserRepo)
var BizProviderSet = wire.NewSet(NewUserUsecase)
var ServiceProviderSet = wire.NewSet(NewUserService)
var ServerProviderSet = wire.NewSet(NewHTTPServer, NewGRPCServer)

// wire.go
func wireApp(*conf.Server, *conf.Data, log.Logger) (*kratos.App, func(), error) {
    panic(wire.Build(
        ServerProviderSet,
        DataProviderSet,
        BizProviderSet,
        ServiceProviderSet,
        newApp,
    ))
}
```

### Error Handling

```protobuf
// Define in proto
enum UserErrorReason {
  option (errors.default_code) = 500;
  USER_NOT_FOUND = 0 [(errors.code) = 404];
  INVALID_EMAIL = 1 [(errors.code) = 400];
}
```

```go
// Use in code
if err != nil {
    if errors.Is(err, gorm.ErrRecordNotFound) {
        return nil, v1.ErrorUserNotFound("user %s not found", id)
    }
    return nil, errors.InternalServer("DB_ERROR", err.Error())
}
```

### Middleware

```go
http.NewServer(
    http.Middleware(
        recovery.Recovery(),
        tracing.Server(),
        logging.Server(logger),
        validate.Validator(),
        auth.Server(validator),
    ),
)
```

## Advanced Usage

### Custom Patterns

You can ask Claude to reference specific patterns:

```
"Show me the correct pattern for implementing circuit breaker"
"What's the best practice for handling database transactions?"
"How should I structure my proto files for a multi-tenant system?"
```

### Code Review

```
"Review my user service implementation"
"Check if my repository follows kratos patterns"
"Is my error handling correct?"
```

### Troubleshooting

```
"Why am I getting 'wire: no provider found'?"
"How do I fix 'protoc: command not found'?"
"My service discovery isn't working, what should I check?"
```

## Resources

- **Skill Repository**: `~/.claude/skills/kratos-skills/`
- **Pattern Guides**: `~/.claude/skills/kratos-skills/references/`
- **Best Practices**: `~/.claude/skills/kratos-skills/best-practices/`
- **Official Docs**: https://go-kratos.dev/
- **Examples**: https://github.com/go-kratos/examples

## Tips

1. **Be specific**: Instead of "create a service", say "create a product service with CRUD operations"
2. **Reference patterns**: "Follow the API pattern for defining REST endpoints"
3. **Ask for explanations**: "Explain why the interface should be in the biz layer"
4. **Request alternatives**: "Show me both WRR and P2C load balancing approaches"

## Updates

The kratos-skills is periodically updated to reflect:
- New kratos framework features
- Updated best practices
- Additional patterns and examples

Check for updates at: https://github.com/go-kratos/kratos
