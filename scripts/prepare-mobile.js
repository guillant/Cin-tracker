const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const webDir = path.join(rootDir, "www");

const entriesToCopy = [
  "index.html",
  "manifest.json",
  "service-worker.js",
  "css",
  "js",
  "assets",
  "design-lab.html",
];

function copyEntry(entry) {
  const source = path.join(rootDir, entry);
  const target = path.join(webDir, entry);

  if (!fs.existsSync(source)) {
    throw new Error(`Missing mobile asset: ${entry}`);
  }

  fs.cpSync(source, target, {
    recursive: true,
    force: true,
  });
}

fs.rmSync(webDir, {
  recursive: true,
  force: true,
});
fs.mkdirSync(webDir, {
  recursive: true,
});

entriesToCopy.forEach(copyEntry);
console.log(`Prepared Capacitor web assets in ${path.relative(rootDir, webDir)}`);
