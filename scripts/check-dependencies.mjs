import { readFile } from "node:fs/promises";

const manifests = [
  "package.json",
  "apps/web/package.json",
  "apps/worker/package.json",
  "packages/catalog/package.json",
  "packages/db/package.json",
  "packages/domain/package.json",
  "packages/ui/package.json",
];

const dependencyFields = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

const exactVersion = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const failures = [];

for (const manifestPath of manifests) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  for (const field of dependencyFields) {
    const dependencies = manifest[field] ?? {};

    for (const [name, version] of Object.entries(dependencies)) {
      const allowedProtocol =
        typeof version === "string" &&
        (version.startsWith("workspace:") || version === "catalog:");

      if (allowedProtocol || (typeof version === "string" && exactVersion.test(version))) {
        continue;
      }

      failures.push(`${manifestPath}: ${field}.${name}=${String(version)}`);
    }
  }
}

if (failures.length) {
  console.error("Dependency policy violation. Use exact versions, catalog:, or workspace: references.");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dependency policy OK (${manifests.length} manifests).`);
