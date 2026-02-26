# Layered Architecture Patterns

This guide covers DDD (Domain-Driven Design) and Clean Architecture patterns in kratos.

## Overview

Kratos promotes a layered architecture inspired by DDD and Clean Architecture:

```
┌─────────────────────────────────────┐
│         Service Layer               │  ← API Handler (HTTP/gRPC)
│    (Application / Interface)        │
├─────────────────────────────────────┤
│           Biz Layer                 │  ← Business Logic / Domain
│      (Domain / Use Cases)           │
├─────────────────────────────────────┤
│          Data Layer                 │  ← Data Access / Repository
│    (Infrastructure / Adapter)       │
└─────────────────────────────────────┘
```

## Directory Structure

```
internal/
├── server/           # Transport server initialization
│   ├── http.go      # HTTP server setup
│   ├── grpc.go      # gRPC server setup
│   └── server.go    # Common server code
├── service/          # Service layer - API handlers
│   ├── service.go   # ProviderSet
│   └── greeter.go   # Service implementation
├── biz/              # Biz layer - Business logic
│   ├── biz.go       # ProviderSet
│   └── greeter.go   # Use cases & repository interfaces
└── data/             # Data layer - Data access
    ├── data.go      # ProviderSet & database init
    └── greeter.go   # Repository implementation
```

## Layer Responsibilities

### Service Layer (`internal/service/`)

- Implements API definitions from proto files
- Handles request/response conversion (DTO)
- Orchestrates biz layer use cases
- **NO business logic** - just delegation

```go
package service

import (
    "context"
    v1 "helloworld/api/helloworld/v1"
    "helloworld/internal/biz"
)

type GreeterService struct {
    v1.UnimplementedGreeterServer
    uc *biz.GreeterUsecase
}

func NewGreeterService(uc *biz.GreeterUsecase) *GreeterService {
    return &GreeterService{uc: uc}
}

func (s *GreeterService) SayHello(ctx context.Context, req *v1.HelloRequest) (*v1.HelloReply, error) {
    // Delegate to biz layer, convert types
    g, err := s.uc.CreateGreeter(ctx, &biz.Greeter{Name: req.Name})
    if err != nil {
        return nil, err
    }
    return &v1.HelloReply{Message: "Hello " + g.Name}, nil
}
```

### Biz Layer (`internal/biz/`)

- Contains business logic and rules
- Defines repository interfaces (Dependency Inversion)
- Contains use cases / domain services
- Pure business logic, no infrastructure concerns

```go
package biz

import (
    "context"
    "github.com/go-kratos/kratos/v2/log"
)

// Greeter domain model
type Greeter struct {
    Name string
}

// GreeterRepo repository interface (defined in biz layer!)
type GreeterRepo interface {
    Save(context.Context, *Greeter) (*Greeter, error)
    Update(context.Context, *Greeter) (*Greeter, error)
    FindByID(context.Context, int64) (*Greeter, error)
    ListAll(context.Context) ([]*Greeter, error)
}

// GreeterUsecase use case
type GreeterUsecase struct {
    repo GreeterRepo  // Depends on interface, not implementation
    log  *log.Helper
}

func NewGreeterUsecase(repo GreeterRepo, logger log.Logger) *GreeterUsecase {
    return &GreeterUsecase{
        repo: repo,
        log:  log.NewHelper(logger),
    }
}

func (uc *GreeterUsecase) CreateGreeter(ctx context.Context, g *Greeter) (*Greeter, error) {
    uc.log.WithContext(ctx).Infof("CreateGreeter: %s", g.Name)
    // Business logic here
    return uc.repo.Save(ctx, g)
}
```

### Data Layer (`internal/data/`)

- Implements repository interfaces from biz layer
- Handles database/cache operations
- Converts PO (Persistence Object) to DTO (Domain Object)
- Infrastructure concerns only

```go
package data

import (
    "context"
    "helloworld/internal/biz"
    "github.com/go-kratos/kratos/v2/log"
)

type greeterRepo struct {
    data *Data
    log  *log.Helper
}

// NewGreeterRepo creates repository (implements biz.GreeterRepo)
func NewGreeterRepo(data *Data, logger log.Logger) biz.GreeterRepo {
    return &greeterRepo{
        data: data,
        log:  log.NewHelper(logger),
    }
}

func (r *greeterRepo) Save(ctx context.Context, g *biz.Greeter) (*biz.Greeter, error) {
    // Database operations
    // Convert biz.Greeter to database model if needed
    return g, nil
}

func (r *greeterRepo) Update(ctx context.Context, g *biz.Greeter) (*biz.Greeter, error) {
    return g, nil
}

func (r *greeterRepo) FindByID(ctx context.Context, id int64) (*biz.Greeter, error) {
    return &biz.Greeter{}, nil
}

func (r *greeterRepo) ListAll(ctx context.Context) ([]*biz.Greeter, error) {
    return []*biz.Greeter{}, nil
}
```

## Wire Dependency Injection

### Provider Sets

Each layer defines a ProviderSet:

```go
// internal/data/data.go
package data

import (
    "github.com/google/wire"
)

// ProviderSet is data providers
var ProviderSet = wire.NewSet(
    NewData,
    NewGreeterRepo,
    // Add more repositories...
)

// Data contains database clients
type Data struct {
    // db *sql.DB
    // redis *redis.Client
}

func NewData() (*Data, error) {
    return &Data{}, nil
}
```

```go
// internal/biz/biz.go
package biz

import "github.com/google/wire"

// ProviderSet is biz providers
var ProviderSet = wire.NewSet(
    NewGreeterUsecase,
    // Add more use cases...
)
```

```go
// internal/service/service.go
package service

import "github.com/google/wire"

// ProviderSet is service providers
var ProviderSet = wire.NewSet(
    NewGreeterService,
    // Add more services...
)
```

### Wire Configuration

```go
// cmd/server/wire.go
//go:build wireinject
// +build wireinject

package main

import (
    "github.com/go-kratos/kratos/v2"
    "github.com/go-kratos/kratos/v2/log"
    "github.com/google/wire"
    "helloworld/internal/biz"
    "helloworld/internal/conf"
    "helloworld/internal/data"
    "helloworld/internal/server"
    "helloworld/internal/service"
)

// wireApp initializes kratos application
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

## ✅ Correct vs ❌ Incorrect Examples

### ✅ Correct: Interface in Biz, Implementation in Data

```go
// internal/biz/greeter.go
type GreeterRepo interface {
    Save(context.Context, *Greeter) (*Greeter, error)
}

// internal/data/greeter.go
func NewGreeterRepo(data *Data, logger log.Logger) biz.GreeterRepo {
    return &greeterRepo{data: data, log: log.NewHelper(logger)}
}
```

### ❌ Incorrect: Interface in Data

```go
// Wrong: interface defined in data layer
// internal/data/greeter.go
type GreeterRepo interface {
    Save(context.Context, *biz.Greeter) (*biz.Greeter, error)
}

// This creates wrong dependency direction!
```

### ✅ Correct: Service Delegates to Biz

```go
func (s *GreeterService) SayHello(ctx context.Context, req *v1.HelloRequest) (*v1.HelloReply, error) {
    // Just delegate, no business logic
    g, err := s.uc.CreateGreeter(ctx, &biz.Greeter{Name: req.Name})
    if err != nil {
        return nil, err
    }
    return &v1.HelloReply{Message: "Hello " + g.Name}, nil
}
```

### ❌ Incorrect: Business Logic in Service

```go
func (s *GreeterService) SayHello(ctx context.Context, req *v1.HelloRequest) (*v1.HelloReply, error) {
    // Wrong: business logic in service layer!
    if req.Name == "" {
        return nil, errors.New("name required")
    }
    if len(req.Name) > 100 {
        return nil, errors.New("name too long")
    }
    // Database access in service!
    s.db.Exec("INSERT INTO greeters...")
    return &v1.HelloReply{Message: "Hello " + req.Name}, nil
}
```

### ✅ Correct: Use Case Orchestration

```go
func (uc *OrderUsecase) CreateOrder(ctx context.Context, o *Order) (*Order, error) {
    // Business logic
    if o.Amount <= 0 {
        return nil, ErrInvalidAmount
    }

    // Use repository interface
    return uc.orderRepo.Save(ctx, o)
}
```

### ❌ Incorrect: Direct DB Access in Biz

```go
func (uc *OrderUsecase) CreateOrder(ctx context.Context, o *Order) (*Order, error) {
    // Wrong: direct database access in biz layer!
    uc.db.Exec("INSERT INTO orders...")
    return o, nil
}
```

## Complete Workflow

### 1. Define Repository Interface (Biz)

```go
// internal/biz/user.go
type User struct {
    ID    int64
    Name  string
    Email string
}

type UserRepo interface {
    Create(ctx context.Context, u *User) (*User, error)
    GetByID(ctx context.Context, id int64) (*User, error)
    Update(ctx context.Context, u *User) (*User, error)
    Delete(ctx context.Context, id int64) error
}
```

### 2. Implement Repository (Data)

```go
// internal/data/user.go
type userRepo struct {
    data *Data
}

func (r *userRepo) Create(ctx context.Context, u *biz.User) (*biz.User, error) {
    // Implementation with actual database
    return u, nil
}
// ... implement other methods
```

### 3. Create Use Case (Biz)

```go
// internal/biz/user_usecase.go
type UserUsecase struct {
    repo UserRepo
}

func (uc *UserUsecase) Register(ctx context.Context, u *User) (*User, error) {
    // Business rules: validate email, check duplicates, etc.
    return uc.repo.Create(ctx, u)
}
```

### 4. Create Service Handler

```go
// internal/service/user.go
func (s *UserService) CreateUser(ctx context.Context, req *v1.CreateUserRequest) (*v1.User, error) {
    u, err := s.uc.Register(ctx, &biz.User{
        Name:  req.Name,
        Email: req.Email,
    })
    if err != nil {
        return nil, err
    }
    return &v1.User{
        Id:    u.ID,
        Name:  u.Name,
        Email: u.Email,
    }, nil
}
```

## References

- [Kratos Layout](https://github.com/go-kratos/kratos-layout)
- [DDD Layered Architecture](https://martinfowler.com/bliki/PresentationDomainDataLayering.html)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Google Wire](https://github.com/google/wire)
