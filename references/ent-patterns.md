# Ent ORM Integration Patterns

This guide covers integrating Ent ORM with kratos for database operations.

## Overview

[Ent](https://entgo.io/) is a simple, yet powerful entity framework for Go, that makes it easy to build and maintain applications with large data-models.

## Installation

```bash
go install entgo.io/ent/cmd/ent@latest

go get entgo.io/ent
go get entgo.io/ent/dialect/sql
```

## Project Structure

```
internal/
├── data/
│   ├── data.go              # Data layer initialization
│   ├── ent/                 # Ent generated code
│   │   ├── client.go
│   │   ├── migrate/
│   │   ├── predicate/
│   │   ├── runtime/
│   │   ├── schema/          # Schema definitions
│   │   ├── user.go
│   │   ├── user_query.go
│   │   └── ...
│   └── user.go              # Repository implementation
```

## Schema Definition

### 1. Create Schema

```bash
# Create user schema
ent init User

# Or with fields
ent init User --field name:string,email:string,age:int
```

### 2. Define Schema

```go
// internal/data/ent/schema/user.go
package schema

import (
    "entgo.io/ent"
    "entgo.io/ent/schema/field"
    "entgo.io/ent/schema/index"
)

// User holds the schema definition for the User entity.
type User struct {
    ent.Schema
}

// Fields of the User.
func (User) Fields() []ent.Field {
    return []ent.Field{
        field.Int64("id").StorageKey("id"),
        field.String("name").
            NotEmpty().
            MaxLen(100),
        field.String("email").
            Unique().
            NotEmpty(),
        field.Int("age").
            Optional().
            Nillable(),
        field.Time("created_at").
            Immutable().
            Default(time.Now),
        field.Time("updated_at").
            Default(time.Now).
            UpdateDefault(time.Now),
    }
}

// Edges of the User.
func (User) Edges() []ent.Edge {
    return []ent.Edge{
        // Define relationships here
    }
}

// Indexes of the User.
func (User) Indexes() []ent.Index {
    return []ent.Index{
        index.Fields("email"),
        index.Fields("name"),
    }
}
```

### 3. Generate Ent Code

```bash
# Generate from schema
go generate ./internal/data/ent/schema/...

# Or use ent generate
ent generate ./internal/data/ent/schema
```

## Data Layer Integration

### 1. Initialize Ent Client

```go
// internal/data/data.go
package data

import (
    "context"
    "database/sql"

    "helloworld/internal/data/ent"
    "github.com/go-kratos/kratos/v2/log"

    _ "github.com/go-sql-driver/mysql"
    _ "github.com/mattn/go-sqlite3"
)

// Data .
type Data struct {
    db  *ent.Client
    log *log.Helper
}

// NewData creates data layer
func NewData(c *conf.Data, logger log.Logger) (*Data, error) {
    log := log.NewHelper(logger)

    // Open database connection
    drv, err := sql.Open(c.Database.Driver, c.Database.Source)
    if err != nil {
        return nil, err
    }

    // Create ent client
    client := ent.NewClient(ent.Driver(drv))

    // Auto migration
    if err := client.Schema.Create(context.Background()); err != nil {
        return nil, err
    }

    return &Data{
        db:  client,
        log: log,
    }, nil
}

// Close closes the data resources
func (d *Data) Close() error {
    if d.db != nil {
        return d.db.Close()
    }
    return nil
}
```

### 2. Repository Implementation

```go
// internal/data/user.go
package data

import (
    "context"

    "helloworld/internal/biz"
    "helloworld/internal/data/ent"
    "helloworld/internal/data/ent/user"
    "github.com/go-kratos/kratos/v2/log"
)

type userRepo struct {
    data *Data
    log  *log.Helper
}

// NewUserRepo creates user repository
func NewUserRepo(data *Data, logger log.Logger) biz.UserRepo {
    return &userRepo{
        data: data,
        log:  log.NewHelper(logger),
    }
}

// Create creates a user
func (r *userRepo) Create(ctx context.Context, u *biz.User) (*biz.User, error) {
    po, err := r.data.db.User.Create().
        SetName(u.Name).
        SetEmail(u.Email).
        SetNillableAge(&u.Age).
        Save(ctx)
    if err != nil {
        return nil, err
    }
    return r.toBiz(po), nil
}

// Update updates a user
func (r *userRepo) Update(ctx context.Context, u *biz.User) (*biz.User, error) {
    updater := r.data.db.User.UpdateOneID(u.ID).
        SetName(u.Name).
        SetEmail(u.Email)

    if u.Age > 0 {
        updater.SetAge(u.Age)
    }

    po, err := updater.Save(ctx)
    if err != nil {
        return nil, err
    }
    return r.toBiz(po), nil
}

// Get gets a user by ID
func (r *userRepo) Get(ctx context.Context, id int64) (*biz.User, error) {
    po, err := r.data.db.User.Get(ctx, id)
    if err != nil {
        if ent.IsNotFound(err) {
            return nil, biz.ErrUserNotFound
        }
        return nil, err
    }
    return r.toBiz(po), nil
}

// GetByEmail gets a user by email
func (r *userRepo) GetByEmail(ctx context.Context, email string) (*biz.User, error) {
    po, err := r.data.db.User.Query().
        Where(user.EmailEQ(email)).
        Only(ctx)
    if err != nil {
        if ent.IsNotFound(err) {
            return nil, biz.ErrUserNotFound
        }
        return nil, err
    }
    return r.toBiz(po), nil
}

// List lists users with pagination
func (r *userRepo) List(ctx context.Context, page, pageSize int) ([]*biz.User, error) {
    pos, err := r.data.db.User.Query().
        Offset((page - 1) * pageSize).
        Limit(pageSize).
        All(ctx)
    if err != nil {
        return nil, err
    }

    users := make([]*biz.User, len(pos))
    for i, po := range pos {
        users[i] = r.toBiz(po)
    }
    return users, nil
}

// Delete deletes a user
func (r *userRepo) Delete(ctx context.Context, id int64) error {
    return r.data.db.User.DeleteOneID(id).Exec(ctx)
}

// toBiz converts ent user to biz user
func (r *userRepo) toBiz(po *ent.User) *biz.User {
    u := &biz.User{
        ID:        po.ID,
        Name:      po.Name,
        Email:     po.Email,
        CreatedAt: po.CreatedAt,
        UpdatedAt: po.UpdatedAt,
    }
    if po.Age != nil {
        u.Age = *po.Age
    }
    return u
}
```

## Biz Layer Interface

```go
// internal/biz/user.go
package biz

import (
    "context"
    "time"

    "github.com/go-kratos/kratos/v2/errors"
)

var (
    ErrUserNotFound = errors.NotFound("USER_NOT_FOUND", "user not found")
    ErrDuplicateEmail = errors.Conflict("DUPLICATE_EMAIL", "email already exists")
)

// User is a user entity
type User struct {
    ID        int64
    Name      string
    Email     string
    Age       int
    CreatedAt time.Time
    UpdatedAt time.Time
}

// UserRepo is a user repository interface
type UserRepo interface {
    Create(ctx context.Context, u *User) (*User, error)
    Update(ctx context.Context, u *User) (*User, error)
    Get(ctx context.Context, id int64) (*User, error)
    GetByEmail(ctx context.Context, email string) (*User, error)
    List(ctx context.Context, page, pageSize int) ([]*User, error)
    Delete(ctx context.Context, id int64) error
}
```

## Advanced Features

### Transactions

```go
func (r *userRepo) CreateWithProfile(ctx context.Context, u *biz.User, p *biz.Profile) (*biz.User, error) {
    // Run in transaction
    tx, err := r.data.db.Tx(ctx)
    if err != nil {
        return nil, err
    }

    user, err := tx.User.Create().
        SetName(u.Name).
        SetEmail(u.Email).
        Save(ctx)
    if err != nil {
        tx.Rollback()
        return nil, err
    }

    _, err = tx.Profile.Create().
        SetUserID(user.ID).
        SetBio(p.Bio).
        Save(ctx)
    if err != nil {
        tx.Rollback()
        return nil, err
    }

    if err := tx.Commit(); err != nil {
        return nil, err
    }

    return r.toBiz(user), nil
}
```

### Hooks

```go
// internal/data/ent/schema/user.go

func (User) Hooks() []ent.Hook {
    return []ent.Hook{
        hook.On(
            func(next ent.Mutator) ent.Mutator {
                return hook.UserFunc(func(ctx context.Context, m *gen.UserMutation) (ent.Value, error) {
                    // Pre-mutation logic
                    return next.Mutate(ctx, m)
                })
            },
            ent.OpCreate|ent.OpUpdate,
        ),
    }
}
```

### Privacy (Authorization)

```go
func (User) Policy() ent.Policy {
    return privacy.Policy{
        Query: privacy.QueryPolicy{
            // Deny all queries by default
            privacy.AlwaysDenyRule(),
            // Allow queries from authorized context
            privacy.ContextQueryRule(),
        },
        Mutation: privacy.MutationPolicy{
            privacy.AlwaysDenyRule(),
            privacy.ContextMutationRule(),
        },
    }
}
```

### Eager Loading

```go
func (r *userRepo) GetWithPosts(ctx context.Context, id int64) (*biz.User, error) {
    po, err := r.data.db.User.Query().
        Where(user.IDEQ(id)).
        WithPosts().  // Eager load posts
        Only(ctx)
    if err != nil {
        return nil, err
    }

    u := r.toBiz(po)
    for _, post := range po.Edges.Posts {
        u.Posts = append(u.Posts, r.postToBiz(post))
    }
    return u, nil
}
```

### Complex Queries

```go
func (r *userRepo) Search(ctx context.Context, keyword string, minAge int) ([]*biz.User, error) {
    pos, err := r.data.db.User.Query().
        Where(
            user.Or(
                user.NameContains(keyword),
                user.EmailContains(keyword),
            ),
            user.AgeGTE(minAge),
        ).
        Order(ent.Desc(user.FieldCreatedAt)).
        All(ctx)
    if err != nil {
        return nil, err
    }

    users := make([]*biz.User, len(pos))
    for i, po := range pos {
        users[i] = r.toBiz(po)
    }
    return users, nil
}
```

## ✅ Correct vs ❌ Incorrect Examples

### ✅ Correct: Handle Not Found

```go
func (r *userRepo) Get(ctx context.Context, id int64) (*biz.User, error) {
    po, err := r.data.db.User.Get(ctx, id)
    if err != nil {
        if ent.IsNotFound(err) {
            return nil, biz.ErrUserNotFound
        }
        return nil, err
    }
    return r.toBiz(po), nil
}
```

### ❌ Incorrect: Ignore Error Type

```go
func (r *userRepo) Get(ctx context.Context, id int64) (*biz.User, error) {
    po, err := r.data.db.User.Get(ctx, id)
    if err != nil {
        return nil, err  // Wrong: should distinguish not found
    }
    return r.toBiz(po), nil
}
```

### ✅ Correct: Transaction Handling

```go
func (r *userRepo) Transfer(ctx context.Context, fromID, toID int64, amount int64) error {
    tx, err := r.data.db.Tx(ctx)
    if err != nil {
        return err
    }

    // Do work...

    if err := tx.Commit(); err != nil {
        return err
    }
    return nil
}
```

### ❌ Incorrect: Missing Rollback

```go
func (r *userRepo) Transfer(ctx context.Context, fromID, toID int64, amount int64) error {
    tx, _ := r.data.db.Tx(ctx)

    if err := doSomething(); err != nil {
        // Missing: tx.Rollback()
        return err
    }

    return tx.Commit()
}
```

## References

- [Ent Documentation](https://entgo.io/docs/getting-started)
- [Ent Schema](https://entgo.io/docs/schema-def)
- [Ent CRUD](https://entgo.io/docs/crud)
- [Ent Transactions](https://entgo.io/docs/transactions)
