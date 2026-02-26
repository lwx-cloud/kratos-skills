# Configuration Patterns

This guide covers configuration patterns in kratos.

## Overview

Kratos provides a unified configuration interface supporting multiple sources and formats:
- File-based configuration (JSON, YAML, XML, Protobuf)
- Environment variables
- Configuration centers (etcd, consul, nacos, apollo, kubernetes)
- Hot reload support

## Configuration Design

### Principles

1. **Separate config from code**: Don't bundle configs in container images
2. **Multiple sources**: Support local files for dev, config center for production
3. **Hot reload**: Update config without restart
4. **Configuration merging**: Multiple configs merge into one structure

## Basic Usage

### File Configuration

```go
package main

import (
    "github.com/go-kratos/kratos/v2/config"
    "github.com/go-kratos/kratos/v2/config/file"
)

func main() {
    c := config.New(
        config.WithSource(
            file.NewSource("configs/config.yaml"),
        ),
    )

    if err := c.Load(); err != nil {
        panic(err)
    }

    // Scan to struct
    var v struct {
        Server struct {
            HTTP struct {
                Addr string `json:"addr"`
            } `json:"http"`
        } `json:"server"`
    }
    if err := c.Scan(&v); err != nil {
        panic(err)
    }

    // Or get single value
    addr, err := c.Value("server.http.addr").String()
    if err != nil {
        panic(err)
    }
}
```

### Environment Variables

```go
c := config.New(
    config.WithSource(
        // With prefix KRATOS_
        env.NewSource("KRATOS_"),
        file.NewSource("configs/config.yaml"),
    ),
)

if err := c.Load(); err != nil {
    panic(err)
}

// Read KRATOS_PORT as "PORT"
port, err := c.Value("PORT").String()
```

## Configuration Sources

### File Source

```go
import "github.com/go-kratos/kratos/v2/config/file"

// Single file
c := config.New(
    config.WithSource(file.NewSource("configs/config.yaml")),
)

// Directory (loads all files)
c := config.New(
    config.WithSource(file.NewSource("configs/")),
)
```

### Environment Source

```go
import "github.com/go-kratos/kratos/v2/config/env"

// With prefix
c := config.New(
    config.WithSource(env.NewSource("APP_")),
)

// Environment variable APP_SERVER_ADDR will be accessible as "SERVER_ADDR"
```

### etcd Source

```go
import (
    "github.com/go-kratos/kratos/contrib/config/etcd/v2"
    clientv3 "go.etcd.io/etcd/client/v3"
)

cli, err := clientv3.New(clientv3.Config{
    Endpoints: []string{"127.0.0.1:2379"},
})
if err != nil {
    panic(err)
}

source, err := etcd.New(cli, etcd.WithPath("/app/config/"))
if err != nil {
    panic(err)
}

c := config.New(config.WithSource(source))
```

### Consul Source

```go
import (
    "github.com/go-kratos/kratos/contrib/config/consul/v2"
    "github.com/hashicorp/consul/api"
)

consulClient, err := api.NewClient(api.DefaultConfig())
if err != nil {
    panic(err)
}

source, err := consul.New(consulClient, consul.WithPath("app/config/"))
if err != nil {
    panic(err)
}

c := config.New(config.WithSource(source))
```

### Nacos Source

```go
import (
    "github.com/go-kratos/kratos/contrib/config/nacos/v2"
    "github.com/nacos-group/nacos-sdk-go/v2/clients"
    "github.com/nacos-group/nacos-sdk-go/v2/common/constant"
    "github.com/nacos-group/nacos-sdk-go/v2/vo"
)

clientConfig := constant.ClientConfig{
    NamespaceId:         "public",
    TimeoutMs:           5000,
    NotLoadCacheAtStart: true,
    LogDir:              "/tmp/nacos/log",
    CacheDir:            "/tmp/nacos/cache",
}

serverConfigs := []constant.ServerConfig{
    {
        IpAddr: "127.0.0.1",
        Port:   8848,
    },
}

client, err := clients.NewConfigClient(
    vo.NacosClientParam{
        ClientConfig:  &clientConfig,
        ServerConfigs: serverConfigs,
    },
)
if err != nil {
    panic(err)
}

source := nacos.NewConfigSource(client, nacos.WithGroup("DEFAULT_GROUP"), nacos.WithDataID("config.yaml"))

c := config.New(config.WithSource(source))
```

## Hot Reload

### Watch Configuration Changes

```go
// Watch specific key
c.Watch("server.http.addr", func(key string, value config.Value) {
    fmt.Printf("config changed: %s = %v\n", key, value)
    // Reload related components
})

// Watch entire config
c.Watch(".", func(key string, value config.Value) {
    fmt.Printf("config changed: %s\n", key)
    // Reload all
})
```

## Kratos-Layout Configuration

### Proto-based Configuration

In kratos-layout, configurations are defined in proto files:

```protobuf
// internal/conf/conf.proto
syntax = "proto3";
package kratos.api;

option go_package = "helloworld/internal/conf;conf";

import "google/protobuf/duration.proto";

message Bootstrap {
  Server server = 1;
  Data data = 2;
}

message Server {
  message HTTP {
    string network = 1;
    string addr = 2;
    google.protobuf.Duration timeout = 3;
  }
  message GRPC {
    string network = 1;
    string addr = 2;
    google.protobuf.Duration timeout = 3;
  }
  HTTP http = 1;
  GRPC grpc = 2;
}

message Data {
  message Database {
    string driver = 1;
    string source = 2;
  }
  message Redis {
    string network = 1;
    string addr = 2;
    google.protobuf.Duration read_timeout = 3;
    google.protobuf.Duration write_timeout = 4;
  }
  Database database = 1;
  Redis redis = 2;
}
```

### Generate Config Go Code

```bash
make config

# Or manually
protoc --proto_path=. \
  --proto_path=./third_party \
  --go_out=paths=source_relative:. \
  internal/conf/conf.proto
```

### Load Configuration in Main

```go
// cmd/server/main.go
func main() {
    flag.Parse()
    logger := log.With(log.NewStdLogger(os.Stdout),
        "ts", log.DefaultTimestamp,
        "caller", log.DefaultCaller,
    )

    c := config.New(
        config.WithSource(
            file.NewSource(flagconf),
        ),
    )
    defer c.Close()

    if err := c.Load(); err != nil {
        panic(err)
    }

    var bc conf.Bootstrap
    if err := c.Scan(&bc); err != nil {
        panic(err)
    }

    // Use bc.Server, bc.Data in Wire injection
    app, cleanup, err := wireApp(bc.Server, bc.Data, logger)
    if err != nil {
        panic(err)
    }
    defer cleanup()

    // Start app
    if err := app.Run(); err != nil {
        panic(err)
    }
}
```

## Configuration Merging

Multiple configurations merge into a single map:

```yaml
# configs/database.yaml
database:
  driver: mysql
  source: root:password@tcp(127.0.0.1:3306)/test

# configs/redis.yaml
redis:
  addr: 127.0.0.1:6379
  db: 0
```

After loading:
```json
{
  "database": {
    "driver": "mysql",
    "source": "root:password@tcp(127.0.0.1:3306)/test"
  },
  "redis": {
    "addr": "127.0.0.1:6379",
    "db": 0
  }
}
```

**Warning**: Root-level keys with the same name will be overwritten based on load order.

## Environment Variable Placeholders

```yaml
# configs/config.yaml
server:
  http:
    addr: "${SERVER_ADDR:0.0.0.0:8000}"  # Default if env var not set
  grpc:
    addr: "${GRPC_ADDR}"

data:
  database:
    driver: mysql
    source: "${DB_SOURCE:root@tcp(127.0.0.1:3306)/db}"
```

## ✅ Correct vs ❌ Incorrect Examples

### ✅ Correct: Multiple Sources

```go
c := config.New(
    config.WithSource(
        env.NewSource("APP_"),                    // Env vars (highest priority)
        file.NewSource("configs/production.yaml"), // Production config
        file.NewSource("configs/config.yaml"),     // Base config
    ),
)
```

### ❌ Incorrect: Single Source

```go
// Wrong: only file config
if os.Getenv("ENV") == "production" {
    c = config.New(config.WithSource(file.NewSource("prod.yaml")))
} else {
    c = config.New(config.WithSource(file.NewSource("dev.yaml")))
}
```

### ✅ Correct: Proto-based Config in Layout

```protobuf
// Define config structure in proto
message Bootstrap {
  Server server = 1;
  Data data = 2;
}

// Generate and scan
var bc conf.Bootstrap
if err := c.Scan(&bc); err != nil {
    panic(err)
}
```

### ❌ Incorrect: Ad-hoc Config Structure

```go
// Wrong: inconsistent config structure
var config struct {
    HttpAddr string `json:"http_addr"`  // Inconsistent naming
    GrpcAddr string `json:"grpc-addr"`  // Wrong separator
}
```

## References

- [Kratos Configuration](https://go-kratos.dev/docs/component/config)
- [Kratos Layout](https://github.com/go-kratos/kratos-layout)
