# Common Issues and Troubleshooting

This guide covers common issues and solutions when working with kratos.

## Installation Issues

### protoc not found

**Error:**
```
google/protobuf/descriptor.proto: File not found.
```

**Solution:**

1. Install protoc using system package manager:
```bash
# macOS
brew install protobuf

# Ubuntu/Debian
apt-get install -y protobuf-compiler

# CentOS/RHEL
yum install -y protobuf-compiler
```

2. Or download pre-compiled binary:
```bash
# Download from GitHub releases
wget https://github.com/protocolbuffers/protobuf/releases/download/v24.0/protoc-24.0-linux-x86_64.zip
unzip protoc-24.0-linux-x86_64.zip -d /usr/local
```

3. Ensure include path is correct:
```bash
# Check protoc installation
protoc --version

# Verify include files exist
ls /usr/local/include/google/protobuf/
```

### kratos command not found

**Error:**
```
Command not found: kratos
```

**Solution:**

1. Ensure `$GOBIN` is in `$PATH`:
```bash
export PATH=$PATH:$(go env GOPATH)/bin
```

2. Add to `~/.bashrc` or `~/.zshrc`:
```bash
echo 'export PATH=$PATH:$(go env GOPATH)/bin' >> ~/.bashrc
source ~/.bashrc
```

3. Verify installation:
```bash
which kratos
kratos -v
```

### protoc-gen-go not found

**Error:**
```
--go_out: protoc-gen-go: program not found or is not executable
```

**Solution:**
```bash
# Install protoc-gen-go
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest

# Install protoc-gen-go-grpc
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

# Install protoc-gen-go-http (kratos)
go install github.com/go-kratos/kratos/cmd/protoc-gen-go-http/v2@latest

# Install protoc-gen-go-errors (kratos)
go install github.com/go-kratos/kratos/cmd/protoc-gen-go-errors/v2@latest

# Verify they are in PATH
which protoc-gen-go
which protoc-gen-go-grpc
which protoc-gen-go-http
which protoc-gen-go-errors
```

## Proto Generation Issues

### Import path errors

**Error:**
```
import "google/api/annotations.proto": file not found
import "errors/errors.proto": file not found
```

**Solution:**

1. Ensure third_party proto files are present:
```bash
mkdir -p third_party/google/api
mkdir -p third_party/errors

# Copy or download proto files
curl -o third_party/google/api/annotations.proto \
  https://raw.githubusercontent.com/googleapis/googleapis/master/google/api/annotations.proto
curl -o third_party/google/api/http.proto \
  https://raw.githubusercontent.com/googleapis/googleapis/master/google/api/http.proto
```

2. Use correct proto_path in Makefile:
```makefile
PROTO_PATH=.
THIRD_PARTY_PATH=./third_party

.PHONY: api
api:
	protoc --proto_path=$(PROTO_PATH) \
		--proto_path=$(THIRD_PARTY_PATH) \
		--go_out=paths=source_relative:. \
		--go-http_out=paths=source_relative:. \
		--go-grpc_out=paths=source_relative:. \
		$(API_PROTO_FILES)
```

### Proto field changes not reflecting

**Problem:** Modified proto file but changes not reflected in generated code.

**Solution:**
```bash
# Clean generated files
find . -name '*.pb.go' -delete

# Regenerate all
go generate ./...
# or
make api
make errors
make config

# Ensure go.mod is up to date
go mod tidy
```

## Wire Issues

### wire: no injector found

**Error:**
```
wire: no injector found
```

**Solution:**

1. Ensure wire.go has build tags:
```go
//go:build wireinject
// +build wireinject

package main

func wireApp(...) (*kratos.App, func(), error) {
    panic(wire.Build(...))
}
```

2. Run wire in correct directory:
```bash
cd cmd/server
wire

# Or use go generate
go generate ./...
```

### wire: provider not found

**Error:**
```
wire: no provider found for *conf.Server
```

**Solution:**

1. Ensure all ProviderSets are included:
```go
func wireApp(server *conf.Server, data *conf.Data, logger log.Logger) (*kratos.App, func(), error) {
    panic(wire.Build(
        server.ProviderSet,   // Contains NewHTTPServer, NewGRPCServer
        data.ProviderSet,     // Contains NewData, NewXxxRepo
        biz.ProviderSet,      // Contains NewXxxUsecase
        service.ProviderSet,  // Contains NewXxxService
        newApp,
    ))
}
```

2. Check ProviderSet definitions:
```go
// internal/server/server.go
var ProviderSet = wire.NewSet(NewHTTPServer, NewGRPCServer)

// internal/data/data.go
var ProviderSet = wire.NewSet(NewData, NewUserRepo)

// internal/biz/biz.go
var ProviderSet = wire.NewSet(NewUserUsecase)

// internal/service/service.go
var ProviderSet = wire.NewSet(NewUserService)
```

## Build Issues

### undefined: conf.Bootstrap

**Error:**
```
undefined: conf.Bootstrap
```

**Solution:**
```bash
# Generate config from proto
make config

# Or manually
protoc --proto_path=. \
  --proto_path=./third_party \
  --go_out=paths=source_relative:. \
  internal/conf/conf.proto
```

### undefined: api.NewXxxClient

**Error:**
```
undefined: api.NewGreeterClient
```

**Solution:**
```bash
# Generate API client code
make api

# Or
kratos proto client api/helloworld/v1/greeter.proto
```

## Runtime Issues

### port already in use

**Error:**
```
listen tcp :8000: bind: address already in use
```

**Solution:**
```bash
# Find process using port
lsof -i :8000

# Kill process
kill -9 <PID>

# Or use different port
kratos run --http-addr=:8001
```

### connection refused

**Error:**
```
dial tcp 127.0.0.1:9000: connect: connection refused
```

**Solutions:**

1. Check if server is running:
```bash
curl http://127.0.0.1:8000/helloworld/kratos
```

2. Check server configuration:
```yaml
# configs/config.yaml
server:
  http:
    addr: 0.0.0.0:8000  # Use 0.0.0.0, not 127.0.0.1 or localhost
  grpc:
    addr: 0.0.0.0:9000
```

3. Check firewall settings

### context deadline exceeded

**Error:**
```
context deadline exceeded
rpc error: code = DeadlineExceeded desc = context deadline exceeded
```

**Solution:**

1. Increase timeout:
```go
http.NewServer(
    http.Timeout(30 * time.Second),  // Increase from default
)

grpc.NewServer(
    grpc.Timeout(30 * time.Second),
)
```

2. Check for slow database queries
3. Add circuit breaker for external calls

## Database Issues

### database connection failed

**Error:**
```
failed to connect to database: dial tcp: connection refused
```

**Solution:**

1. Check database configuration:
```yaml
data:
  database:
    driver: mysql
    source: root:password@tcp(127.0.0.1:3306)/dbname?parseTime=True&loc=Local
```

2. Ensure database is running:
```bash
docker ps | grep mysql
mysql -h 127.0.0.1 -P 3306 -u root -p
```

3. Check network connectivity:
```bash
telnet 127.0.0.1 3306
```

### record not found

**Error:**
```
record not found
```

**Solution:**
```go
// Handle gracefully in repository
func (r *userRepo) GetByID(ctx context.Context, id string) (*biz.User, error) {
    var po UserPO
    if err := r.data.db.First(&po, "id = ?", id).Error; err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) {
            return nil, v1.ErrorUserNotFound("user %s not found", id)
        }
        return nil, errors.InternalServer("DB_ERROR", err.Error())
    }
    return po.ToBiz(), nil
}
```

## Service Discovery Issues

### discovery: no instances available

**Error:**
```
discovery: no instances available
```

**Solution:**

1. Check if service is registered:
```bash
# For etcd
etcdctl get /kratos/ --prefix

# For consul
curl http://localhost:8500/v1/catalog/services
```

2. Verify registry configuration:
```go
app := kratos.New(
    kratos.Name("helloworld"),      // Must match discovery name
    kratos.Version("v1.0.0"),
    kratos.Registrar(reg),           // Don't forget Registrar
    kratos.Server(hs, gs),
)
```

3. Check client endpoint:
```go
conn, err := grpc.DialInsecure(
    ctx,
    grpc.WithEndpoint("discovery:///helloworld"),  // Must match service name
    grpc.WithDiscovery(dis),
)
```

## IDE Issues

### IDE shows red wavy lines on proto imports

**Problem:** IDE shows errors on `import "google/api/annotations.proto"`

**Solution (VSCode):**
1. Install "Protobuf 3 support for Visual Studio Code" extension
2. Configure settings:
```json
{
  "protoc": {
    "options": [
      "--proto_path=${workspaceRoot}",
      "--proto_path=${workspaceRoot}/third_party"
    ]
  }
}
```

**Solution (GoLand):**
1. Settings → Languages & Frameworks → Protocol Buffers
2. Add import path: `./third_party`

## Debug Tips

### Enable Debug Logging

```go
// In main.go
logger := log.With(log.NewStdLogger(os.Stdout),
    "ts", log.DefaultTimestamp,
    "caller", log.DefaultCaller,
    "service.id", id,
    "service.name", Name,
    "service.version", Version,
    "trace_id", tracing.TraceID(),
    "span_id", tracing.SpanID(),
)

// Use debug level
log.NewHelper(logger).Debug("debug message")
```

### Check Wire Generation

```bash
# Run wire with verbose output
cd cmd/server && wire -v

# Check wire_gen.go exists and is up to date
ls -la cmd/server/wire_gen.go
```

### Verify Proto Generation

```bash
# Check generated files exist
ls -la api/helloworld/v1/*.pb.go

# Verify go_package in proto
grep "go_package" api/helloworld/v1/greeter.proto
```

### Check Middleware Execution

```go
// Add logging middleware first to see all requests
http.Middleware(
    logging.Server(logger),  // Log all requests
    recovery.Recovery(),
    tracing.Server(),
)
```

## Getting Help

If you're still stuck:

1. **Check official documentation**: https://go-kratos.dev/
2. **Review examples**: https://github.com/go-kratos/examples
3. **Search issues**: https://github.com/go-kratos/kratos/issues
4. **Join community**:
   - Discord: https://discord.gg/BWzJsUJ
   - GitHub Discussions: https://github.com/go-kratos/kratos/discussions

## Quick Diagnostic Commands

```bash
# Check versions
go version
kratos -v
protoc --version

# Check environment
echo $GOPATH
echo $GOBIN
echo $PATH

# List installed tools
ls -la $(go env GOPATH)/bin/

# Verify proto files
find . -name "*.proto" | head -10

# Check generated files
find . -name "*.pb.go" | head -10

# Build check
go build ./...

# Test check
go test ./...

# Run linter
golangci-lint run
```
