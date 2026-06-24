const fs = require("fs");
const path = require("path");

const buildDir = path.join(process.cwd(), "build");
const outputDir = path.join(process.cwd(), "e2e", "vsix");
const outputPath = path.join(outputDir, "extension.vsix");

const files = fs
  .readdirSync(buildDir, { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isFile() && /^(autobot|continue)-.*\.vsix$/.test(entry.name),
  )
  .map((entry) => {
    const fullPath = path.join(buildDir, entry.name);
    return { fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
  })
  .sort((a, b) => b.mtimeMs - a.mtimeMs);

if (files.length === 0) {
  throw new Error(`No VSIX file found in ${buildDir}`);
}

fs.mkdirSync(outputDir, { recursive: true });
fs.copyFileSync(files[0].fullPath, outputPath);
console.log(`Copied ${path.basename(files[0].fullPath)} to ${outputPath}`);
