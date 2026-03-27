import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const ROOT = process.cwd();
const TARGET_DIRS = [
  "controllers",
  "middlewares",
  "routes",
  "validations",
  "db",
  "tests",
];
const TOP_LEVEL_FILES = ["app.js", "server.js"];

const isJavaScriptFile = (filePath) => filePath.endsWith(".js");

const walk = (directory) => {
  const absolute = path.join(ROOT, directory);
  if (!fs.existsSync(absolute)) {
    return [];
  }

  const entries = fs.readdirSync(absolute, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(absolute, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") {
        continue;
      }
      files.push(...walk(path.join(directory, entry.name)));
      continue;
    }

    if (entry.isFile() && isJavaScriptFile(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
};

const filesToCheck = [
  ...TOP_LEVEL_FILES.map((file) => path.join(ROOT, file)).filter((file) =>
    fs.existsSync(file),
  ),
  ...TARGET_DIRS.flatMap((dir) => walk(dir)),
];

let hasErrors = false;
for (const filePath of filesToCheck) {
  const check = spawnSync(process.execPath, ["--check", filePath], {
    encoding: "utf8",
  });

  if (check.status !== 0) {
    hasErrors = true;
    process.stderr.write(
      `\nSyntax check failed: ${path.relative(ROOT, filePath)}\n`,
    );
    process.stderr.write(
      check.stderr || check.stdout || "Unknown syntax error\n",
    );
  }
}

if (hasErrors) {
  process.exit(1);
}

process.stdout.write(`Syntax check passed for ${filesToCheck.length} files.\n`);
