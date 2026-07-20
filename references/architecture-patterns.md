# Layered Architecture Patterns

> Version-sensitive wiring and framework APIs follow the [compatibility baseline](compatibility.md). Preserve the target repository's intentional architecture.

## Contents

- [Discover the local boundaries](#discover-the-local-boundaries)
- [Keep dependency direction explicit](#keep-dependency-direction-explicit)
- [Implement a vertical change](#implement-a-vertical-change)
- [Maintain the Wire graph](#maintain-the-wire-graph)
- [Handle cross-cutting boundaries](#handle-cross-cutting-boundaries)
- [Verification](#verification)

## Discover the local boundaries

Inspect constructors, provider sets, package imports, and representative request paths before applying the standard layout.

| Standard package | Primary responsibility |
| --- | --- |
| `internal/server` | Construct HTTP/gRPC servers and register generated services |
| `internal/service` | Adapt generated transport messages to biz inputs and outputs |
| `internal/biz` | Own domain models, use cases, policies, and repository contracts |
| `internal/data` | Implement repository contracts with databases, caches, and external clients |

Follow these boundaries when the repository uses them. When it uses a different deliberate architecture, preserve its dependency direction and conventions unless the task explicitly requests migration.

## Keep dependency direction explicit

The standard dependency direction is:

```text
generated API <- service -> biz <- data
                              ^
                         repository contract
```

- Service imports generated API and biz packages.
- Biz defines behavior required from persistence and external systems.
- Data imports biz to implement those contracts.
- Biz remains independent of generated transport, SQL drivers, ORM clients, and registry implementations.

Design repository methods from business needs:

```go
type UserRepo interface {
	Create(context.Context, *User) (*User, error)
	FindByID(context.Context, int64) (*User, error)
}

type UserUsecase struct {
	repo UserRepo
}
```

Return interfaces from data constructors when the repository convention uses compile-time abstraction:

```go
func NewUserRepo(data *Data, logger log.Logger) biz.UserRepo {
	return &userRepo{data: data, log: log.NewHelper(logger)}
}
```

## Implement a vertical change

Account for every boundary touched by the contract:

1. Change the Protobuf contract and regenerate tracked output when the public API changes.
2. Adapt request and response types in service methods.
3. Put business validation, authorization decisions, and orchestration in the use case.
4. Add or change repository behavior in the biz contract.
5. Implement persistence or external calls in data.
6. Update constructors, provider sets, configuration, and tests.

Keep service adaptation thin:

```go
func (s *UserService) CreateUser(ctx context.Context, req *v1.CreateUserRequest) (*v1.User, error) {
	user, err := s.uc.Create(ctx, &biz.User{Name: req.Name, Email: req.Email})
	if err != nil {
		return nil, err
	}
	return toAPIUser(user), nil
}
```

Keep use-case rules independent of transport and storage:

```go
func (uc *UserUsecase) Create(ctx context.Context, user *User) (*User, error) {
	if err := uc.policy.ValidateCreate(user); err != nil {
		return nil, err
	}
	return uc.repo.Create(ctx, user)
}
```

## Maintain the Wire graph

Keep provider sets beside the packages that own constructors:

```go
var ProviderSet = wire.NewSet(NewData, NewUserRepo)
```

The injector composes package provider sets and the application constructor:

```go
//go:build wireinject

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

Regenerate Wire output after any constructor parameter, return type, interface binding, provider set, or cleanup function changes.

## Handle cross-cutting boundaries

- Propagate the incoming context through use cases, repositories, and outbound clients.
- Translate persistence and upstream errors into the domain error model at the owning boundary.
- Own transactions in the use case when one business operation spans multiple repository calls.
- Keep logging, metrics, tracing, authentication, validation, and recovery in middleware or explicit policy components.
- Keep generated types at the service boundary unless the repository intentionally uses them internally.

## Verification

Complete an architectural change when:

- every contract change is accounted for across API, service, biz, data, configuration, and wiring;
- package imports preserve the intended dependency direction;
- Wire generation succeeds and cleanup paths remain connected;
- focused tests cover business rules and repository error translation; and
- the final diff contains intentional generated output only.

## Sources

- [Kratos layout](https://github.com/go-kratos/kratos-layout)
- [Google Wire](https://github.com/google/wire)
- [Presentation-Domain-Data Layering](https://martinfowler.com/bliki/PresentationDomainDataLayering.html)
