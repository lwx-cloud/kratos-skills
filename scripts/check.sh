#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

node "$ROOT_DIR/scripts/check-docs.mjs"

cd "$ROOT_DIR/scripts/compilecheck"
env -u GOROOT go test ./...
env -u GOROOT go vet ./...
