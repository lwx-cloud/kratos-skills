# JWT Authentication Patterns

> Version-sensitive. Compare the target repository with the [compatibility baseline](compatibility.md). The compile-tested Kratos middleware uses JWT v5 callback types.

## Contents

- [Choose the token boundary](#choose-the-token-boundary)
- [Configure server authentication](#configure-server-authentication)
- [Read claims](#read-claims)
- [Use client authentication](#use-client-authentication)
- [Select protected operations](#select-protected-operations)
- [Issue tokens](#issue-tokens)
- [Verification](#verification)

## Choose the token boundary

Decide which identity the token represents:

| Boundary | Pattern |
| --- | --- |
| Public user request | Validate the user token on the server and propagate explicit identity fields internally |
| Service-to-service identity | Let `jwt.Client` sign service claims for each outbound request |
| Forwarding an existing bearer token | Propagate the incoming credential deliberately; `jwt.Client` creates a new token rather than forwarding one |

Load signing keys from configuration or a key-management system. Keep issuer, audience, algorithm, key ID, and rotation policy explicit.

## Configure server authentication

Use JWT v5 types and lock the accepted signing method:

```go
package auth

import (
	"errors"
	"slices"

	"github.com/go-kratos/kratos/v2/middleware"
	kratosjwt "github.com/go-kratos/kratos/v2/middleware/auth/jwt"
	jwt "github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID string `json:"user_id"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

func (c Claims) Validate() error {
	if c.ExpiresAt == nil {
		return errors.New("exp claim is required")
	}
	if c.Issuer != "identity-service" {
		return errors.New("unexpected issuer")
	}
	if !slices.Contains(c.Audience, "public-api") {
		return errors.New("unexpected audience")
	}
	return nil
}

func Server(secret []byte) middleware.Middleware {
	keyFunc := func(token *jwt.Token) (any, error) {
		return secret, nil
	}

	return kratosjwt.Server(
		keyFunc,
		kratosjwt.WithSigningMethod(jwt.SigningMethodHS256),
		kratosjwt.WithClaims(func() jwt.Claims { return &Claims{} }),
	)
}
```

For asymmetric signing, return the public key selected by `kid` and set the matching RSA or ECDSA signing method. The middleware checks that the parsed token method equals the configured method.

Use separate keys and audiences for user tokens and service credentials. Rotate symmetric keys without embedding them in source or examples copied into production.

## Read claims

Treat missing or unexpected claims as authentication failures:

```go
package auth

import (
	"context"

	"github.com/go-kratos/kratos/v2/errors"
	kratosjwt "github.com/go-kratos/kratos/v2/middleware/auth/jwt"
)

func Identity(ctx context.Context) (*Claims, error) {
	claims, ok := kratosjwt.FromContext(ctx)
	if !ok {
		return nil, errors.Unauthorized("UNAUTHORIZED", "missing authentication claims")
	}

	identity, ok := claims.(*Claims)
	if !ok {
		return nil, errors.Unauthorized("UNAUTHORIZED", "invalid authentication claims")
	}
	return identity, nil
}
```

Authorize business actions in the biz layer using an explicit identity or policy interface. Keep transport token parsing in middleware or service adaptation.

## Use client authentication

`jwt.Client` signs a token from the configured claims for each outbound request:

```go
claims := &jwt.RegisteredClaims{
	Issuer:    "order-service",
	Audience:  jwt.ClaimStrings{"user-service"},
	ExpiresAt: jwt.NewNumericDate(time.Now().Add(2 * time.Minute)),
	IssuedAt:  jwt.NewNumericDate(time.Now()),
}

middleware := kratosjwt.Client(
	func(*jwt.Token) (any, error) { return serviceSecret, nil },
	kratosjwt.WithSigningMethod(jwt.SigningMethodHS256),
	kratosjwt.WithClaims(func() jwt.Claims { return claims }),
)
```

Use short-lived service credentials. For user-token forwarding, copy the incoming authorization header only across an explicitly trusted boundary and preserve cancellation and tracing context.

## Select protected operations

Kratos middleware selectors match the transport operation, commonly the generated RPC operation, not an assumed HTTP URL. Inspect generated handlers or runtime logs before writing the matcher:

```go
protected := selector.Server(Server(secret)).Match(
	func(_ context.Context, operation string) bool {
		switch operation {
		case "/health.v1.Health/Check",
			"/auth.v1.Auth/Login":
			return false
		default:
			return true
		}
	},
).Build()
```

Prefer an allowlist of public operations so newly added methods are protected by default.

## Issue tokens

Set registered claims and use the same algorithm policy as the server:

```go
func Issue(secret []byte, userID string, now time.Time) (string, error) {
	claims := &Claims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    "identity-service",
			Audience:  jwt.ClaimStrings{"public-api"},
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(15 * time.Minute)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(secret)
}
```

Use refresh tokens or reauthentication for longer sessions. Avoid placing secrets or sensitive personal data in JWT claims because signed tokens are not encrypted.

## Verification

Complete authentication work only when tests cover:

- valid, expired, not-yet-valid, malformed, and wrong-algorithm tokens;
- issuer and audience policy enforced by the service's claims validation;
- missing and unexpected claims types;
- public-operation matching and default protection of new operations;
- key rotation or multiple key IDs when required; and
- logs and errors that omit credentials and raw tokens.

## Sources

- [Kratos v2.9.2 JWT middleware](https://github.com/go-kratos/kratos/blob/v2.9.2/middleware/auth/jwt/jwt.go)
- [golang-jwt v5](https://pkg.go.dev/github.com/golang-jwt/jwt/v5)
- [JWT Best Current Practices](https://www.rfc-editor.org/rfc/rfc8725)
