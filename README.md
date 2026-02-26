# Kratos Skills

Comprehensive knowledge base for go-kratos microservices framework.

[![GitHub](https://img.shields.io/github/license/lwx-cloud/kratos-skills)](LICENSE)
[![Kratos](https://img.shields.io/badge/kratos-v2.0+-blue.svg)](https://go-kratos.dev/)

[English](README.md) | [简体中文](README_CN.md)

> **Note**: This skill follows the [Agent Skills specification](https://github.com/anthropics/skills/) format, inspired by [zero-skills](https://github.com/zeromicro/zero-skills).

---

## Quick Install

Just ask your AI agent:

```
Install kratos-skills from https://github.com/lwx-cloud/kratos-skills
```

Or manually:

```bash
# Project-level (recommended)
git clone https://github.com/lwx-cloud/kratos-skills.git .claude/skills/kratos-skills

# Personal-level (all projects)
git clone https://github.com/lwx-cloud/kratos-skills.git ~/.claude/skills/kratos-skills
```

## Overview

Kratos Skills is a comprehensive knowledge base designed for AI agents and developers working with the [go-kratos](https://go-kratos.dev/) microservices framework. It provides production-ready patterns, best practices, and troubleshooting guides for building scalable, maintainable microservices.

### Key Features

- **21 Pattern Guides**: Covering API design, architecture, resilience, observability, and more
- **DDD Layered Architecture**: Service → Biz → Data with clean separation of concerns
- **Protobuf-First**: API definitions with automatic HTTP/gRPC code generation
- **Wire DI**: Compile-time dependency injection without runtime overhead
- **Production-Ready**: Circuit breakers, rate limiting, distributed tracing, metrics

## Quick Start

### For Claude Code Users

This skill loads automatically when working with kratos projects. Invoke with:

```
/kratos-skills
```

Or ask directly:
```
"Create a new user service with CRUD operations using kratos"
```

### For Other AI Assistants

Reference the pattern guides in [references/](references/) directory for specific topics.

## Repository Structure

```
kratos-skills/
├── SKILL.md                          # Main skill configuration for Claude Code
├── README.md                         # This file
├── README_CN.md                      # Chinese version
├── references/                       # Pattern guides (21 topics)
│   ├── api-patterns.md              # REST/gRPC API design
│   ├── transport-patterns.md        # HTTP/gRPC server & client
│   ├── architecture-patterns.md     # DDD layered architecture
│   ├── error-patterns.md            # Error handling & codes
│   ├── middleware-patterns.md       # Middleware chain & custom middleware
│   ├── config-patterns.md           # Configuration management
│   ├── registry-patterns.md         # Service discovery (etcd, consul, nacos)
│   ├── selector-patterns.md         # Load balancing algorithms
│   ├── circuit-breaker-patterns.md  # Fault tolerance & resilience
│   ├── ratelimit-patterns.md        # Rate limiting & throttling
│   ├── recovery-patterns.md         # Panic recovery
│   ├── auth-patterns.md             # JWT authentication
│   ├── validate-patterns.md         # Request validation (protovalidate)
│   ├── logging-patterns.md          # Structured logging
│   ├── metrics-patterns.md          # Prometheus metrics
│   ├── tracing-patterns.md          # OpenTelemetry tracing
│   ├── metadata-patterns.md         # Context propagation
│   ├── encoding-patterns.md         # Serialization & codecs
│   ├── ent-patterns.md              # Ent ORM integration
│   ├── cli-guide.md                 # Kratos CLI usage
│   └── openapi-guide.md             # OpenAPI documentation
├── best-practices/
│   └── overview.md                  # Production best practices
├── troubleshooting/
│   └── common-issues.md             # Common problems & solutions
└── getting-started/
    └── claude-code-guide.md         # Claude Code integration
```

## Core Concepts

### Layered Architecture

```
┌─────────────────────────────────────────┐
│  Service Layer   (API/Transport)        │  ← HTTP/gRPC handlers
│  - Request validation                   │
│  - Response serialization               │
├─────────────────────────────────────────┤
│  Biz Layer       (Business Logic)       │  ← Use cases
│  - Business rules                       │
│  - Workflow orchestration               │
├─────────────────────────────────────────┤
│  Data Layer      (Persistence)          │  ← Repository implementation
│  - Database operations                  │
│  - Cache integration                    │
└─────────────────────────────────────────┘
```

### Key Principles

✅ **Always Follow**
- Layer separation: Service → Biz → Data
- Dependency Inversion: Interfaces in biz, implementations in data
- Protobuf-first: Define APIs in `.proto` files
- Wire injection: Compile-time dependency injection
- Context propagation: Pass `ctx` through all layers

❌ **Never Do**
- Put business logic in service handlers
- Skip interface definitions
- Use global variables for dependencies
- Hard-code configuration values
- Modify generated `.pb.go` files

## Usage Examples

### Creating a Service

```
"Create a user service with:
- CreateUser, GetUser, UpdateUser, DeleteUser APIs
- MySQL storage with Ent ORM
- JWT authentication
- Request validation"
```

### Adding Middleware

```
"Add circuit breaker and rate limiting middleware to my kratos service"
```

### Configuring Service Discovery

```
"Setup etcd service discovery with client-side load balancing"
```

## Migration Guides

### From proto-gen-validate to Protovalidate

The validation patterns have been updated to use [protovalidate](https://github.com/bufbuild/protovalidate) instead of the deprecated proto-gen-validate. See [references/validate-patterns.md](references/validate-patterns.md) for migration details.

## Documentation

- **Official Kratos Docs**: https://go-kratos.dev/
- **Kratos Layout**: https://github.com/go-kratos/kratos-layout
- **Examples**: https://github.com/go-kratos/examples
- **Protovalidate**: https://buf.build/docs/protovalidate/

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

[MIT](LICENSE)

---

**Maintained by**: [lwx-cloud](https://github.com/lwx-cloud)
**Status**: Actively maintained
