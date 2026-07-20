# Ent Integration Patterns

> Ent and driver APIs follow the [compatibility baseline](compatibility.md). Use the target repository's schema location, migration policy, and generated package path.

## Contents

- [Own the schema and generation](#own-the-schema-and-generation)
- [Construct the Ent client](#construct-the-ent-client)
- [Implement repositories](#implement-repositories)
- [Translate errors](#translate-errors)
- [Own transactions in the use case](#own-transactions-in-the-use-case)
- [Use advanced Ent features deliberately](#use-advanced-ent-features-deliberately)
- [Verification](#verification)

## Own the schema and generation

Keep handwritten schemas under the repository's Ent schema directory and treat generated Ent packages as derived output.

```go
package schema

import (
	"time"

	"entgo.io/ent"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type User struct{ ent.Schema }

func (User) Fields() []ent.Field {
	return []ent.Field{
		field.Int64("id"),
		field.String("name").NotEmpty().MaxLen(100),
		field.String("email").NotEmpty().Unique(),
		field.Time("created_at").Immutable().Default(time.Now),
		field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
	}
}

func (User) Indexes() []ent.Index {
	return []ent.Index{index.Fields("email").Unique()}
}
```

Run the repository-owned Ent generation command after schema, mixin, hook, privacy, feature, or annotation changes. Inspect generated diffs and database migration impact together.

## Construct the Ent client

Keep driver creation and cleanup in the data layer:

```go
package data

import (
	"example.com/project/internal/conf"
	"example.com/project/internal/data/ent"
)

type Data struct {
	db *ent.Client
}

func NewData(c *conf.Data) (*Data, func(), error) {
	client, err := ent.Open(c.Database.Driver, c.Database.Source)
	if err != nil {
		return nil, nil, err
	}
	cleanup := func() { _ = client.Close() }
	return &Data{db: client}, cleanup, nil
}
```

Configure connection-pool limits, TLS, timeouts, and driver-specific options through the repository's selected SQL driver. Run schema migrations through the deployment's migration policy rather than coupling destructive migration behavior to every service startup.

## Implement repositories

Keep Ent query types inside data implementations and convert generated entities to biz models at the boundary:

```go
func (r *userRepo) Create(ctx context.Context, user *biz.User) (*biz.User, error) {
	entity, err := r.data.db.User.Create().
		SetName(user.Name).
		SetEmail(user.Email).
		Save(ctx)
	if err != nil {
		return nil, mapUserError(err)
	}
	return toBizUser(entity), nil
}

func (r *userRepo) FindByID(ctx context.Context, id int64) (*biz.User, error) {
	entity, err := r.data.db.User.Get(ctx, id)
	if err != nil {
		return nil, mapUserError(err)
	}
	return toBizUser(entity), nil
}
```

Design pagination, eager loading, projections, and ordering from the business contract. Bound list sizes and eliminate implicit N+1 query behavior.

## Translate errors

Map storage errors into stable domain errors in data:

```go
func mapUserError(err error) error {
	switch {
	case err == nil:
		return nil
	case ent.IsNotFound(err):
		return biz.ErrUserNotFound
	case ent.IsConstraintError(err):
		return biz.ErrUserConflict
	default:
		return err
	}
}
```

Preserve the original cause for internal observability when the repository's error model supports wrapping. Keep SQL, constraint, and driver details out of public responses.

## Own transactions in the use case

When one business operation spans several repository actions, expose a transaction runner rather than leaking `*ent.Tx` into biz:

```go
type Transaction interface {
	WithinTx(context.Context, func(context.Context) error) error
}
```

Implement it in data with `client.Tx`, commit after the callback succeeds, and roll back on callback or commit failure. Bind transactional repository implementations to the transaction context using the repository's established pattern.

Test rollback, commit failure, cancellation, and idempotency. Keep external network calls outside database transactions unless the design explicitly handles distributed consistency.

## Use advanced Ent features deliberately

- Use hooks for persistence invariants that belong to every mutation path.
- Use privacy policies when authorization must be enforced for all Ent access paths.
- Use eager loading when the response contract needs related entities and query counts are bounded.
- Use predicates and projections to keep large searches selective.
- Use optimistic locking or database constraints for concurrent updates requiring conflict detection.

Keep business policy in biz unless enforcement must exist at every storage access path.

## Verification

Complete an Ent change when:

- schema and generated code agree;
- migration output is reviewed under the deployment migration policy;
- repositories propagate context and translate not-found and constraint errors;
- transaction tests cover commit, rollback, cancellation, and failure paths;
- list and relation queries are bounded and checked for N+1 behavior; and
- client and driver cleanup remain connected through Wire.

## Sources

- [Ent schema](https://entgo.io/docs/schema-def/)
- [Ent CRUD](https://entgo.io/docs/crud/)
- [Ent transactions](https://entgo.io/docs/transactions/)
- [Ent privacy](https://entgo.io/docs/privacy/)
