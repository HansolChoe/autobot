const { spawnSync } = require("child_process");
const path = require("path");

const args = process.argv.slice(2);
let globalDir = process.env.CONTINUE_GLOBAL_DIR || "e2e/test-continue";
let testFile = process.env.TEST_FILE || "./e2e/_output/tests/*.test.js";

for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--global-dir" && args[i + 1]) {
    globalDir = args[i + 1];
    i += 1;
  } else if (args[i] === "--test-file" && args[i + 1]) {
    testFile = args[i + 1];
    i += 1;
  } else if (!args[i].startsWith("-")) {
    testFile = args[i];
  }
}

const env = Object.fromEntries(
  Object.entries(process.env).filter(([, value]) => value !== undefined),
);
const resolvedGlobalDir = path.resolve(process.cwd(), globalDir);
const result = spawnSync(
  process.execPath,
  [
    path.join("node_modules", "vscode-extension-tester", "out", "cli.js"),
    "run-tests",
    testFile,
    "--code_settings",
    "settings.json",
    "--extensions_dir",
    "./e2e/.test-extensions",
    "--storage",
    "./e2e/storage",
  ],
  {
    env: {
      ...env,
      CONTINUE_GLOBAL_DIR: resolvedGlobalDir,
      NODE_ENV: "e2e",
    },
    stdio: "inherit",
  },
);

if (result.error) {
  console.error(result.error);
}

process.exit(result.status ?? 1);
