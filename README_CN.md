# Kratos Skills

go-kratos 微服务框架综合知识库

[![GitHub](https://img.shields.io/github/license/lwx-cloud/kratos-skills)](LICENSE)
[![Kratos](https://img.shields.io/badge/kratos-v2.0+-blue.svg)](https://go-kratos.dev/)

[English](README.md) | [简体中文](README_CN.md)

> **说明**: 本 Skill 遵循 [Agent Skills 规范](https://github.com/anthropics/skills/) 格式，参考自 [zero-skills](https://github.com/zeromicro/zero-skills)。

---

## 快速安装

### 通过 skills CLI（推荐）

```bash
# 项目级（推荐）
npx skills add lwx-cloud/kratos-skills

# 个人级（所有项目共享）
npx skills add lwx-cloud/kratos-skills -g
```

### 或让 AI 助手安装

```
Install kratos-skills from https://github.com/lwx-cloud/kratos-skills
```

### 或手动安装

```bash
# 项目级
git clone https://github.com/lwx-cloud/kratos-skills.git .claude/skills/kratos-skills

# 个人级
git clone https://github.com/lwx-cloud/kratos-skills.git ~/.claude/skills/kratos-skills
```

## 概述

Kratos Skills 是专为使用 [go-kratos](https://go-kratos.dev/) 微服务框架的 AI 助手和开发者设计的综合知识库。它提供了构建可扩展、可维护微服务的生产级模式、最佳实践和故障排除指南。

### 核心特性

- **21 个模式指南**：涵盖 API 设计、架构、弹性、可观测性等
- **DDD 分层架构**：Service → Biz → Data，职责清晰分离
- **Protobuf 优先**：API 定义自动生成 HTTP/gRPC 代码
- **Wire 依赖注入**：编译时依赖注入，无运行时开销
- **生产就绪**：熔断器、限流、分布式链路追踪、指标监控

## 快速开始

### Claude Code 用户

在处理 kratos 项目时，此技能会自动加载。通过以下方式调用：

```
/kratos-skills
```

或直接提问：
```
"使用 kratos 创建一个带有 CRUD 操作的用户服务"
```

### 其他 AI 助手

参考 [references/](references/) 目录中的模式指南获取特定主题。

## 仓库结构

```
kratos-skills/
├── SKILL.md                          # Claude Code 主技能配置
├── README.md                         # 英文文档
├── README_CN.md                      # 中文文档
├── references/                       # 模式指南（21 个主题）
│   ├── api-patterns.md              # REST/gRPC API 设计
│   ├── transport-patterns.md        # HTTP/gRPC 服务端与客户端
│   ├── architecture-patterns.md     # DDD 分层架构
│   ├── error-patterns.md            # 错误处理与错误码
│   ├── middleware-patterns.md       # 中间件链与自定义中间件
│   ├── config-patterns.md           # 配置管理
│   ├── registry-patterns.md         # 服务注册发现（etcd、consul、nacos）
│   ├── selector-patterns.md         # 负载均衡算法
│   ├── circuit-breaker-patterns.md  # 容错与弹性
│   ├── ratelimit-patterns.md        # 限流与节流
│   ├── recovery-patterns.md         # Panic 恢复
│   ├── auth-patterns.md             # JWT 认证
│   ├── validate-patterns.md         # 请求验证（protovalidate）
│   ├── logging-patterns.md          # 结构化日志
│   ├── metrics-patterns.md          # Prometheus 指标
│   ├── tracing-patterns.md          # OpenTelemetry 链路追踪
│   ├── metadata-patterns.md         # 上下文传递
│   ├── encoding-patterns.md         # 序列化与编解码
│   ├── ent-patterns.md              # Ent ORM 集成
│   ├── cli-guide.md                 # Kratos CLI 使用
│   └── openapi-guide.md             # OpenAPI 文档生成
├── best-practices/
│   └── overview.md                  # 生产最佳实践
├── troubleshooting/
│   └── common-issues.md             # 常见问题与解决方案
└── getting-started/
    └── claude-code-guide.md         # Claude Code 集成指南
```

## 核心概念

### 分层架构

```
┌─────────────────────────────────────────┐
│  Service 层      (API/传输层)            │  ← HTTP/gRPC 处理器
│  - 请求验证                             │
│  - 响应序列化                           │
├─────────────────────────────────────────┤
│  Biz 层          (业务逻辑层)            │  ← 用例
│  - 业务规则                             │
│  - 工作流编排                           │
├─────────────────────────────────────────┤
│  Data 层         (持久化层)              │  ← 仓库实现
│  - 数据库操作                           │
│  - 缓存集成                             │
└─────────────────────────────────────────┘
```

### 核心原则

✅ **必须遵循**
- 分层分离：Service → Biz → Data
- 依赖倒置：接口定义在 Biz 层，实现在 Data 层
- Protobuf 优先：在 `.proto` 文件中定义 API
- Wire 注入：编译时依赖注入
- 上下文传递：在所有层传递 `ctx`

❌ **切勿这样做**
- 在 service handler 中编写业务逻辑
- 跳过接口定义直接使用具体类型
- 使用全局变量作为依赖
- 硬编码配置值
- 直接修改生成的 `.pb.go` 文件

## 使用示例

### 创建服务

```
"创建一个用户服务，包含：
- CreateUser、GetUser、UpdateUser、DeleteUser API
- 使用 Ent ORM 的 MySQL 存储
- JWT 认证
- 请求验证"
```

### 添加中间件

```
"为我的 kratos 服务添加熔断器和限流中间件"
```

### 配置服务发现

```
"使用 etcd 设置服务发现和客户端负载均衡"
```

## 迁移指南

### 从 proto-gen-validate 迁移到 Protovalidate

验证模式已更新为使用 [protovalidate](https://github.com/bufbuild/protovalidate) 替代已弃用的 proto-gen-validate。详见 [references/validate-patterns.md](references/validate-patterns.md)。

## 相关文档

- **Kratos 官方文档**：https://go-kratos.dev/
- **Kratos 项目模板**：https://github.com/go-kratos/kratos-layout
- **示例项目**：https://github.com/go-kratos/examples
- **Protovalidate**：https://buf.build/docs/protovalidate/

## 贡献

欢迎贡献！请随时提交 issue 或 pull request。

## 许可证

[MIT](LICENSE)

---

**维护者**：[lwx-cloud](https://github.com/lwx-cloud)
**状态**：积极维护中
