# Kratos Skills

Comprehensive knowledge base for go-kratos microservices framework.

## Overview

This skill provides kratos framework knowledge optimized for AI agents helping developers build production-ready microservices. It covers REST/gRPC APIs, DDD layered architecture, dependency injection with Wire, service discovery, and more.

## Structure

```
kratos-skills/
├── SKILL.md                           # Main skill file
├── README.md                          # This file
├── references/                        # Pattern guides
│   ├── api-patterns.md               # API definition patterns
│   ├── transport-patterns.md         # HTTP/gRPC transport
│   ├── architecture-patterns.md      # DDD layered architecture
│   ├── error-patterns.md             # Error handling
│   ├── middleware-patterns.md        # Middleware usage
│   ├── config-patterns.md            # Configuration
│   └── registry-patterns.md          # Service discovery
├── best-practices/
│   └── overview.md                   # Production best practices
├── troubleshooting/
│   └── common-issues.md              # Common issues & solutions
└── getting-started/
    └── claude-code-guide.md          # Claude Code integration
```

## Quick Start

### Installation

This skill is automatically available in Claude Code when working with kratos projects.

```
/kratos-skills
```

### Key Features

- **Layered Architecture**: Service → Biz → Data with DDD patterns
- **Protobuf-first**: API definitions in proto files
- **Wire DI**: Compile-time dependency injection
- **Dual Transport**: HTTP and gRPC from single source
- **Structured Errors**: Consistent error handling
- **Service Discovery**: etcd, Consul, Nacos, Kubernetes support

## Usage Examples

### Create a New Service

```
"Create a new user service with CRUD operations"
```

Claude will:
1. Create proto API definition
2. Generate client/server code
3. Implement service, biz, and data layers
4. Configure Wire injection
5. Add appropriate middleware

### Add Middleware

```
"Add JWT authentication middleware"
```

### Configure Service Discovery

```
"Setup etcd service discovery and client-side load balancing"
```

## Documentation

- **Official Docs**: https://go-kratos.dev/
- **Kratos Layout**: https://github.com/go-kratos/kratos-layout
- **Examples**: https://github.com/go-kratos/examples

## License

MIT
