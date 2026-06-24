const fs = require("fs");
const path = require("path");

const workspaceRoot = process.cwd();

for (const relativePath of [
  path.join("e2e", "_output"),
  path.join("e2e", "storage"),
]) {
  const target = path.resolve(workspaceRoot, relativePath);

  if (
    target !== workspaceRoot &&
    !target.startsWith(workspaceRoot + path.sep)
  ) {
    throw new Error(`Refusing to delete outside workspace: ${target}`);
  }

  fs.rmSync(target, {
    force: true,
    recursive: true,
  });
}
