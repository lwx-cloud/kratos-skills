# Kratos CLI 工具指南

本文档详细介绍 kratos 命令行工具的使用方法。

## 安装

```bash
# 安装 kratos CLI
go install github.com/go-kratos/kratos/cmd/kratos/v2@latest

# 验证安装
kratos -v
```

## 项目创建

### 创建新项目

```bash
# 基本用法
kratos new helloworld

# 进入项目目录
cd helloworld

# 下载依赖
go mod download
```

### 使用国内镜像

```bash
# 使用 gitee 源（国内推荐）
kratos new helloworld -r https://gitee.com/go-kratos/kratos-layout.git

# 或使用环境变量
export KRATOS_LAYOUT_REPO=https://gitee.com/go-kratos/kratos-layout.git
kratos new helloworld
```

### 指定分支

```bash
kratos new helloworld -b main
```

### 多模块项目

```bash
# 创建主项目
kratos new helloworld
cd helloworld

# 添加子模块（使用 --nomod 在同一 go.mod 下）
kratos new app/user --nomod
kratos new app/order --nomod
```

## Proto 文件操作

### 添加 Proto 文件

```bash
# 创建 proto 文件模板
kratos proto add api/helloworld/v1/greeter.proto
```

生成的 proto 文件示例：

```protobuf
syntax = "proto3";

package api.helloworld.v1;

option go_package = "helloworld/api/api/helloworld;helloworld";
option java_multiple_files = true;
option java_package = "api.helloworld";

service Demo {
    rpc CreateDemo (CreateDemoRequest) returns (CreateDemoReply);
    rpc UpdateDemo (UpdateDemoRequest) returns (UpdateDemoReply);
    rpc DeleteDemo (DeleteDemoRequest) returns (DeleteDemoReply);
    rpc GetDemo (GetDemoRequest) returns (GetDemoReply);
    rpc ListDemo (ListDemoRequest) returns (ListDemoReply);
}

message CreateDemoRequest {}
message CreateDemoReply {}

message UpdateDemoRequest {}
message UpdateDemoReply {}

message DeleteDemoRequest {}
message DeleteDemoReply {}

message GetDemoRequest {}
message GetDemoReply {}

message ListDemoRequest {}
message ListDemoReply {}
```

### 生成客户端代码

```bash
# 生成 proto 客户端代码（pb.go, _grpc.pb.go, _http.pb.go）
kratos proto client api/helloworld/v1/greeter.proto

# 生成指定目录
kratos proto client api/helloworld/v1/greeter.proto -t api/helloworld/v1
```

生成的文件：
- `greeter.pb.go` - Protobuf 消息类型
- `greeter_grpc.pb.go` - gRPC 客户端/服务器接口
- `greeter_http.pb.go` - HTTP 处理器和客户端

### 生成服务端代码

```bash
# 生成 service 实现模板
kratos proto server api/helloworld/v1/greeter.proto -t internal/service
```

生成的代码示例：

```go
package service

import (
    "context"
    pb "helloworld/api/helloworld/v1"
)

type DemoService struct {
    pb.UnimplementedDemoServer
}

func NewDemoService() *DemoService {
    return &DemoService{}
}

func (s *DemoService) CreateDemo(ctx context.Context, req *pb.CreateDemoRequest) (*pb.CreateDemoReply, error) {
    return &pb.CreateDemoReply{}, nil
}

func (s *DemoService) UpdateDemo(ctx context.Context, req *pb.UpdateDemoRequest) (*pb.UpdateDemoReply, error) {
    return &pb.UpdateDemoReply{}, nil
}

func (s *DemoService) DeleteDemo(ctx context.Context, req *pb.DeleteDemoRequest) (*pb.DeleteDemoReply, error) {
    return &pb.DeleteDemoReply{}, nil
}

func (s *DemoService) GetDemo(ctx context.Context, req *pb.GetDemoRequest) (*pb.GetDemoReply, error) {
    return &pb.GetDemoReply{}, nil
}

func (s *DemoService) ListDemo(ctx context.Context, req *pb.ListDemoRequest) (*pb.ListDemoReply, error) {
    return &pb.ListDemoReply{}, nil
}
```

## 项目运行

### 运行项目

```bash
# 运行项目（如果有多个子项目，会出现选择菜单）
kratos run

# 指定配置文件
kratos run -c configs/config.yaml
```

## 工具升级

### 升级 kratos 工具

```bash
# 升级 kratos 及其依赖的工具
kratos upgrade

# 这会升级：
# - kratos CLI 本身
# - protoc 相关插件
```

## 查看版本信息

```bash
# 显示版本
kratos -v

# 或
kratos version
```

输出示例：
```
kratos version v2.7.0
```

## 查看更新日志

```bash
# 查看最新版本更新日志
kratos changelog

# 查看指定版本更新日志
kratos changelog v2.6.0

# 查看最新发布到当前的更新
kratos changelog dev
```

## 获取帮助

```bash
# 查看主帮助
kratos -h

# 查看子命令帮助
kratos new -h
kratos proto -h
kratos proto client -h
kratos proto server -h
```

## 完整工作流程示例

### 1. 创建项目

```bash
# 创建项目
kratos new myapp
cd myapp

# 下载依赖
go mod download

# 安装 wire（依赖注入工具）
go get github.com/google/wire/cmd/wire@latest
```

### 2. 定义 API

```bash
# 添加 proto 文件
kratos proto add api/user/v1/user.proto

# 编辑 proto 文件，添加业务字段
```

### 3. 生成代码

```bash
# 生成客户端代码
kratos proto client api/user/v1/user.proto

# 生成服务端代码
kratos proto server api/user/v1/user.proto -t internal/service

# 生成依赖注入代码
go generate ./...
# 或
cd cmd/server && wire
```

### 4. 实现业务逻辑

```bash
# 编辑 internal/service/user.go 实现业务逻辑
# 编辑 internal/biz/user.go 添加业务用例
# 编辑 internal/data/user.go 实现数据访问
```

### 5. 运行项目

```bash
# 运行
kratos run

# 测试
curl http://127.0.0.1:8000/v1/users
```

## Makefile 常用命令

kratos-layout 生成的项目包含常用 Makefile 命令：

```bash
# 初始化项目
make init

# 生成所有代码
make all

# 生成 proto 代码
make api

# 生成错误代码
make errors

# 生成配置代码
make config

# 生成 wire 代码
make wire

# 构建项目
make build

# 运行测试
make test

# 清理生成的文件
make clean
```

## 常见问题

### 找不到 kratos 命令

```bash
# 确保 GOPATH/bin 在 PATH 中
export PATH=$PATH:$(go env GOPATH)/bin

# 添加到 ~/.bashrc 或 ~/.zshrc
echo 'export PATH=$PATH:$(go env GOPATH)/bin' >> ~/.bashrc
source ~/.bashrc
```

### proto 生成失败

```bash
# 确保安装了 protoc
protoc --version

# 确保安装了必要的插件
which protoc-gen-go
which protoc-gen-go-grpc
which protoc-gen-go-http
```

### wire 生成失败

```bash
# 安装 wire
go install github.com/google/wire/cmd/wire@latest

# 确保 wire.go 有正确的 build tag
//go:build wireinject
// +build wireinject
```

## 参考

- [Kratos CLI 文档](https://go-kratos.dev/docs/getting-started/usage)
- [Kratos 快速开始](https://go-kratos.dev/docs/getting-started/start)
