# Kratos Skills

面向 Go-Kratos v2 的仓库感知工程 Skill，覆盖实现、迁移、调试和代码审查。

[English](README.md) | [简体中文](README_CN.md)

## 能力

- [SKILL.md](SKILL.md) 提供精简且分支明确的实现、分阶段迁移、因果调试和审查流程。
- 按主题拆分 API、架构、中间件、弹性、可观测性、持久化和代码生成参考。
- [references/compatibility.md](references/compatibility.md) 定义经过编译校验的依赖基线。
- `scripts/check.sh` 提供文档静态检查和固定版本 Go API 编译校验。

Skill 会先盘点目标仓库的版本与受影响边界，再只读取与当前任务相关的参考文档。

## 安装

使用 skills CLI：

```bash
npx skills add laxidou/kratos-skills
```

本地开发时可链接当前 checkout，让修改即时生效：

```bash
mkdir -p ~/.codex/skills
ln -s "$(pwd)" ~/.codex/skills/kratos-skills
```

Claude Code 用户可以将同一 checkout 链接到 `~/.claude/skills/kratos-skills`。平台发现和调用细节见 [getting-started/claude-code-guide.md](getting-started/claude-code-guide.md)。

## 使用

显式调用 `$kratos-skills`，或直接提出 Kratos 仓库任务，例如：

```text
使用 $kratos-skills 将请求校验迁移到 Protovalidate，并验证生成代码。
```

```text
审查这个 Kratos 服务的中间件顺序、错误映射和关闭流程。
```

根 Skill 会选择对应分支和参考文件。全面生产就绪审查见 [best-practices/overview.md](best-practices/overview.md)，跨模块故障诊断见 [troubleshooting/common-issues.md](troubleshooting/common-issues.md)。

## 校验修改

```bash
scripts/check.sh
```

该命令校验 Skill 元数据、Markdown 结构与锚点、参考路由、固定源码版本和已知过期 API，然后编译固定版本 API 基线并运行 `go vet`。

## 许可证

[MIT](LICENSE)
