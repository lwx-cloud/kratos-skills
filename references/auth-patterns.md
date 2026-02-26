# JWT Authentication Patterns

This guide covers JWT authentication patterns in kratos.

## Overview

Kratos provides JWT middleware for authenticating requests between clients and servers.

## Installation

```bash
go get github.com/go-kratos/kratos/v2/middleware/auth/jwt
go get github.com/golang-jwt/jwt/v4
```

## Server-Side Authentication

### Basic JWT Server

```go
package server

import (
    "github.com/go-kratos/kratos/v2/middleware/auth/jwt"
    "github.com/go-kratos/kratos/v2/transport/http"
    jwtv4 "github.com/golang-jwt/jwt/v4"
)

func NewHTTPServer(c *conf.Server, logger log.Logger) *http.Server {
    var opts = []http.ServerOption{
        http.Middleware(
            recovery.Recovery(),
            jwt.Server(
                func(token *jwtv4.Token) (interface{}, error) {
                    return []byte("your-secret-key"), nil
                },
            ),
            logging.Server(logger),
        ),
    }

    return http.NewServer(opts...)
}
```

### With Custom Claims

```go
// Custom claims
type CustomClaims struct {
    UserID   int64  `json:"user_id"`
    Username string `json:"username"`
    Role     string `json:"role"`
    jwtv4.StandardClaims
}

// Server with custom claims
jwt.Server(
    func(token *jwtv4.Token) (interface{}, error) {
        return []byte("your-secret-key"), nil
    },
    jwt.WithClaims(func() jwtv4.Claims {
        return &CustomClaims{}
    }),
)
```

### With Signing Method

```go
jwt.Server(
    func(token *jwtv4.Token) (interface{}, error) {
        return []byte("your-secret-key"), nil
    },
    jwt.WithSigningMethod(jwtv4.SigningMethodHS256),
)
```

## Client-Side Authentication

### HTTP Client

```go
import (
    "github.com/go-kratos/kratos/v2/middleware/auth/jwt"
    "github.com/go-kratos/kratos/v2/transport/http"
    jwtv4 "github.com/golang-jwt/jwt/v4"
)

func NewHTTPClient() (*http.Client, error) {
    return http.NewClient(
        context.Background(),
        http.WithEndpoint("127.0.0.1:8000"),
        http.WithMiddleware(
            jwt.Client(
                func(token *jwtv4.Token) (interface{}, error) {
                    return []byte("service-secret-key"), nil
                },
            ),
        ),
    )
}
```

### gRPC Client

```go
conn, err := grpc.DialInsecure(
    context.Background(),
    grpc.WithEndpoint("dns:///127.0.0.1:9000"),
    grpc.WithMiddleware(
        jwt.Client(
            func(token *jwtv4.Token) (interface{}, error) {
                return []byte("service-secret-key"), nil
            },
        ),
    ),
)
```

## Extracting User Information

```go
package service

import (
    "github.com/go-kratos/kratos/v2/middleware/auth/jwt"
)

func (s *UserService) GetProfile(ctx context.Context, req *pb.GetProfileRequest) (*pb.Profile, error) {
    // Extract claims from context
    claims, ok := jwt.FromContext(ctx)
    if !ok {
        return nil, errors.Unauthorized("UNAUTHORIZED", "missing token")
    }

    // Assert to custom claims
    customClaims, ok := claims.(*CustomClaims)
    if !ok {
        return nil, errors.InternalServer("CLAIMS_ERROR", "invalid claims type")
    }

    // Use user info
    userID := customClaims.UserID
    username := customClaims.Username

    return s.uc.GetProfile(ctx, userID)
}
```

## JWT Token Generation

```go
package auth

import (
    "time"
    jwtv4 "github.com/golang-jwt/jwt/v4"
)

// GenerateToken generates a new JWT token
func GenerateToken(userID int64, username string, secret string) (string, error) {
    claims := CustomClaims{
        UserID:   userID,
        Username: username,
        Role:     "user",
        StandardClaims: jwtv4.StandardClaims{
            ExpiresAt: time.Now().Add(24 * time.Hour).Unix(),
            IssuedAt:  time.Now().Unix(),
            Issuer:    "myapp",
        },
    }

    token := jwtv4.NewWithClaims(jwtv4.SigningMethodHS256, claims)
    return token.SignedString([]byte(secret))
}

// GenerateTokenWithExpire generates token with custom expiration
func GenerateTokenWithExpire(userID int64, username string, expire time.Duration, secret string) (string, error) {
    claims := CustomClaims{
        UserID:   userID,
        Username: username,
        StandardClaims: jwtv4.StandardClaims{
            ExpiresAt: time.Now().Add(expire).Unix(),
            IssuedAt:  time.Now().Unix(),
        },
    }

    token := jwtv4.NewWithClaims(jwtv4.SigningMethodHS256, claims)
    return token.SignedString([]byte(secret))
}
```

## Whitelist with Selector

```go
package server

import (
    "github.com/go-kratos/kratos/v2/middleware/auth/jwt"
    "github.com/go-kratos/kratos/v2/middleware/selector"
)

func NewHTTPServer(c *conf.Server, logger log.Logger) *http.Server {
    // JWT middleware
    authMiddleware := jwt.Server(
        func(token *jwtv4.Token) (interface{}, error) {
            return []byte("your-secret-key"), nil
        },
    )

    var opts = []http.ServerOption{
        http.Middleware(
            recovery.Recovery(),
            // Apply auth to all except whitelist paths
            selector.Server(authMiddleware).
                Match(func(ctx context.Context, operation string) bool {
                    // Skip auth for login/register
                    whitelist := []string{
                        "/api/v1/auth/login",
                        "/api/v1/auth/register",
                        "/health",
                        "/ready",
                    }
                    for _, path := range whitelist {
                        if operation == path {
                            return false // Skip middleware
                        }
                    }
                    return true // Apply middleware
                }).
                Build(),
            logging.Server(logger),
        ),
    }

    return http.NewServer(opts...)
}
```

## Complete Login Flow Example

```go
package service

type AuthService struct {
    pb.UnimplementedAuthServer
    uc  *biz.AuthUsecase
    log *log.Helper
}

func (s *AuthService) Login(ctx context.Context, req *pb.LoginRequest) (*pb.LoginReply, error) {
    // Validate credentials
    user, err := s.uc.ValidateCredentials(ctx, req.Email, req.Password)
    if err != nil {
        return nil, errors.Unauthorized("INVALID_CREDENTIALS", "invalid email or password")
    }

    // Generate JWT token
    token, err := auth.GenerateToken(user.ID, user.Name, s.jwtSecret)
    if err != nil {
        return nil, errors.InternalServer("TOKEN_ERROR", "failed to generate token")
    }

    return &pb.LoginReply{
        Token:     token,
        ExpiresIn: 86400, // 24 hours
        User: &pb.User{
            Id:    user.ID,
            Name:  user.Name,
            Email: user.Email,
        },
    }, nil
}

func (s *AuthService) GetProfile(ctx context.Context, req *pb.GetProfileRequest) (*pb.Profile, error) {
    // Extract user from JWT
    claims, ok := jwt.FromContext(ctx)
    if !ok {
        return nil, errors.Unauthorized("UNAUTHORIZED", "missing token")
    }

    customClaims := claims.(*CustomClaims)

    return s.uc.GetProfile(ctx, customClaims.UserID)
}
```

## References

- [Kratos JWT Middleware](https://go-kratos.dev/docs/component/middleware/auth)
- [JWT-Go](https://github.com/golang-jwt/jwt)
