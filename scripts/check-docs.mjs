#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ignoredDirectories = new Set([".git", ".idea", ".agents", "node_modules"]);
const markdownFiles = [];
const failures = [];
const compileGoModPath = path.join(root, "scripts", "compilecheck", "go.mod");
const compileGoMod = fs.readFileSync(compileGoModPath, "utf8");
const kratosVersion = compileGoMod.match(/^\s*github\.com\/go-kratos\/kratos\/v2\s+(\S+)$/m)?.[1];
const aegisVersion = compileGoMod.match(/^\s*github\.com\/go-kratos\/aegis\s+(\S+)$/m)?.[1];
const anchorCache = new Map();

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target);
    else if (entry.isFile() && entry.name.endsWith(".md")) markdownFiles.push(target);
  }
}

function lineNumber(text, index) {
  return text.slice(0, index).split("\n").length;
}

function report(file, line, message) {
  failures.push(`${path.relative(root, file)}:${line}: ${message}`);
}

function headingSlug(heading) {
  return heading
    .trim()
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/[`*_~]/g, "")
    .replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, "")
    .replace(/\s+/g, "-");
}

function markdownAnchors(file) {
  if (anchorCache.has(file)) return anchorCache.get(file);

  const anchors = new Set();
  const counts = new Map();
  const text = fs.readFileSync(file, "utf8");
  for (const line of text.split("\n")) {
    const match = line.match(/^#{1,6}\s+(.+?)\s*#*$/);
    if (!match) continue;

    const base = headingSlug(match[1]);
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${count}`);
  }

  anchorCache.set(file, anchors);
  return anchors;
}

if (!kratosVersion) {
  report(compileGoModPath, 1, "missing direct github.com/go-kratos/kratos/v2 requirement");
}
if (!aegisVersion) {
  report(compileGoModPath, 1, "missing direct github.com/go-kratos/aegis requirement");
}

walk(root);

for (const file of markdownFiles) {
  const text = fs.readFileSync(file, "utf8");
  const relative = path.relative(root, file);
  const fences = text.match(/^```/gm) ?? [];
  if (fences.length % 2 !== 0) report(file, 1, "unbalanced fenced code block");

  const isRoutedReference = ["references", "best-practices", "troubleshooting"].some(
    (directory) => relative.startsWith(`${directory}${path.sep}`),
  );
  if (isRoutedReference && text.split("\n").length - 1 > 100) {
    if (!/^## (Contents|目录)$/m.test(text)) {
      report(file, 1, "reference over 100 lines requires a Contents section");
    }
    if (!/^## (Verification|Completion criterion|完成条件)$/m.test(text)) {
      report(file, 1, "reference over 100 lines requires an explicit completion criterion");
    }
  }

  for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const rawTarget = match[1];
    if (/^(https?:|mailto:)/.test(rawTarget)) continue;

    const [target, fragment] = rawTarget.split("#", 2);
    const resolved = target
      ? path.resolve(path.dirname(file), decodeURIComponent(target))
      : file;
    if (!fs.existsSync(resolved)) {
      report(file, lineNumber(text, match.index), `missing local link target: ${rawTarget}`);
      continue;
    }

    if (
      fragment &&
      path.extname(resolved).toLowerCase() === ".md" &&
      !markdownAnchors(resolved).has(decodeURIComponent(fragment))
    ) {
      report(file, lineNumber(text, match.index), `missing Markdown anchor: ${rawTarget}`);
    }
  }

  const pinnedSources = [
    {
      pattern: /https:\/\/github\.com\/go-kratos\/kratos\/(?:blob|tree)\/(v[^/)\s]+)/g,
      expected: kratosVersion,
      module: "github.com/go-kratos/kratos/v2",
    },
    {
      pattern: /https:\/\/github\.com\/go-kratos\/aegis\/(?:blob|tree)\/(v[^/)\s]+)/g,
      expected: aegisVersion,
      module: "github.com/go-kratos/aegis",
    },
  ];
  for (const { pattern, expected, module } of pinnedSources) {
    for (const match of text.matchAll(pattern)) {
      if (expected && match[1] !== expected) {
        report(
          file,
          lineNumber(text, match.index),
          `pinned ${module} source uses ${match[1]}, compile baseline uses ${expected}`,
        );
      }
    }
  }

  for (const match of text.matchAll(/^```([^\n]*)\n([\s\S]*?)^```/gm)) {
    const language = match[1].trim().split(/\s+/, 1)[0];
    const source = match[2];
    if (language === "go" && source.includes("validate.Validator()")) {
      report(file, lineNumber(text, match.index), `use contrib validate.ProtoValidate() with the ${kratosVersion} baseline`);
    }
    if (language === "go" && source.includes("github.com/go-kratos/kratos/v2/middleware/validate")) {
      report(file, lineNumber(text, match.index), `core Kratos validation middleware is deprecated in ${kratosVersion}`);
    }
    if (language !== "go" || !source.trimStart().startsWith("package ")) continue;
    const result = spawnSync("gofmt", [], {
      input: source,
      encoding: "utf8",
      env: { ...process.env, TMPDIR: os.tmpdir() },
    });
    if (result.status !== 0) {
      const detail = (result.stderr || result.stdout).trim().split("\n", 1)[0];
      report(file, lineNumber(text, match.index), `Go example is not syntactically valid: ${detail}`);
    }
  }

  for (const match of text.matchAll(/\bv\d+\.\d+(?:\.\d+)?(?:-[0-9A-Za-z.-]+)?\b/g)) {
    const lineStart = text.lastIndexOf("\n", match.index) + 1;
    const lineEnd = text.indexOf("\n", match.index);
    const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd);
    const pinnedSource = /https:\/\/github\.com\/[^)\s]+\/(?:blob|tree)\/v\d+\.\d+/.test(line);
    if (!pinnedSource) {
      report(
        file,
        lineNumber(text, match.index),
        "declare tested versions in scripts/compilecheck/go.mod; keep Markdown versions only in pinned source links",
      );
    }
  }
}

const skillPath = path.join(root, "SKILL.md");
const skill = fs.readFileSync(skillPath, "utf8");
const frontmatterMatch = skill.match(/^---\n([\s\S]*?)\n---\n/);
if (!frontmatterMatch) {
  report(skillPath, 1, "missing YAML frontmatter");
} else {
  const fields = [...frontmatterMatch[1].matchAll(/^([A-Za-z][A-Za-z0-9_-]*):/gm)].map(
    (match) => match[1],
  );
  const unsupported = fields.filter((field) => !["name", "description"].includes(field));
  if (unsupported.length > 0) {
    report(skillPath, 1, `unsupported frontmatter fields: ${unsupported.join(", ")}`);
  }
  if (fields.filter((field) => field === "name").length !== 1) {
    report(skillPath, 1, "frontmatter must contain exactly one name field");
  }
  if (fields.filter((field) => field === "description").length !== 1) {
    report(skillPath, 1, "frontmatter must contain exactly one description field");
  }

  const name = frontmatterMatch[1].match(/^name:\s*(\S+)\s*$/m)?.[1];
  if (name !== "kratos-skills") {
    report(skillPath, 1, "frontmatter name must be kratos-skills");
  }
  if (name && (!/^[a-z0-9-]+$/.test(name) || name.length > 64)) {
    report(skillPath, 1, "frontmatter name must use lowercase letters, digits, and hyphens and stay under 64 characters");
  }
  if (name && (name.startsWith("-") || name.endsWith("-") || name.includes("--"))) {
    report(skillPath, 1, "frontmatter name cannot start or end with a hyphen or contain consecutive hyphens");
  }

  const description = frontmatterMatch[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();
  if (!description) {
    report(skillPath, 1, "frontmatter description is required");
  } else if (description.length > 1024) {
    report(skillPath, 1, "frontmatter description must stay under 1024 characters");
  } else if (/[<>]/.test(description)) {
    report(skillPath, 1, "frontmatter description cannot contain angle brackets");
  }
}

const openAIPath = path.join(root, "agents", "openai.yaml");
if (!fs.existsSync(openAIPath)) {
  report(openAIPath, 1, "agents/openai.yaml is required");
} else {
  const openAI = fs.readFileSync(openAIPath, "utf8");
  const shortDescription = openAI.match(/^\s*short_description:\s*"([^"]*)"\s*$/m)?.[1];
  const defaultPrompt = openAI.match(/^\s*default_prompt:\s*"([^"]*)"\s*$/m)?.[1];
  if (!/^interface:\s*$/m.test(openAI)) {
    report(openAIPath, 1, "missing interface mapping");
  }
  if (!/^\s*display_name:\s*"[^"]+"\s*$/m.test(openAI)) {
    report(openAIPath, 1, "display_name must be a quoted non-empty string");
  }
  if (!shortDescription || shortDescription.length < 25 || shortDescription.length > 64) {
    report(openAIPath, 1, "short_description must be a quoted string of 25-64 characters");
  }
  if (!defaultPrompt || !defaultPrompt.includes("$kratos-skills")) {
    report(openAIPath, 1, "default_prompt must be quoted and mention $kratos-skills");
  }
}

const referenceDirectory = path.join(root, "references");
for (const entry of fs.readdirSync(referenceDirectory, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
  const routedPath = `references/${entry.name}`;
  if (!skill.includes(`(${routedPath})`)) {
    report(skillPath, 1, `unrouted reference file: ${routedPath}`);
  }
}

const stalePatterns = [
  ["github.com/golang-jwt/jwt/v4", `JWT v4 is incompatible with the Kratos ${kratosVersion} compile baseline`],
  ["grpc.WithSelector(", `Kratos ${kratosVersion} gRPC clients do not expose WithSelector`],
  ["http.WithSelector(", `Kratos ${kratosVersion} HTTP clients do not expose WithSelector`],
  ["grpc.WithBalancerName(", `Kratos ${kratosVersion} gRPC clients do not expose WithBalancerName`],
  ["selector/weighted", `Kratos ${kratosVersion} has no selector/weighted package`],
  ["circuitbreaker.Server(", `Kratos ${kratosVersion} circuit breaker is client-side`],
  ["circuitbreaker.WithBreaker(", `use WithCircuitBreaker with Kratos ${kratosVersion}`],
  ["circuitbreaker.WithFilter(", `Kratos ${kratosVersion} does not expose WithFilter`],
  ["recovery.WithLogger(", `Kratos ${kratosVersion} recovery does not expose WithLogger`],
  ["ratelimit.NewTokenBucket(", `Aegis ${aegisVersion} does not expose NewTokenBucket`],
  ["bbr.New()", `Aegis ${aegisVersion} exposes bbr.NewLimiter`],
  ["protovalidate.ProtoMessage", "use google.golang.org/protobuf/proto.Message"],
  ["protovalivate", "misspelled protovalidate identifier"],
  ["go get -u ", "use go install package@version for tools"],
];

for (const file of markdownFiles) {
  const text = fs.readFileSync(file, "utf8");
  for (const [pattern, message] of stalePatterns) {
    let start = 0;
    while (true) {
      const index = text.indexOf(pattern, start);
      if (index === -1) break;
      report(file, lineNumber(text, index), `${message}: ${pattern}`);
      start = index + pattern.length;
    }
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(`checked ${markdownFiles.length} Markdown files\n`);
