import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const archivePath = resolve(root, "data/catalog/archive.json");
const manifestsArg = process.argv.find((arg) => arg.startsWith("--manifests="));
const writeArchive = process.argv.includes("--write-archive");
const allowPartial = process.argv.includes("--allow-partial");

if (!manifestsArg) throw new Error("Pass --manifests=/absolute/path/to/generated-media.json.");
const manifestsPath = resolve(manifestsArg.slice("--manifests=".length));
const archive = JSON.parse(await readFile(archivePath, "utf8"));
const input = JSON.parse(await readFile(manifestsPath, "utf8"));
const manifests = Array.isArray(input) ? input : input?.manifests;

if (!Array.isArray(archive)) throw new Error("data/catalog/archive.json must contain an array.");
if (!Array.isArray(manifests)) throw new Error("Generated media input must be an array or an object with a manifests array.");

const recordsById = new Map(archive.map((record) => [record.id, record]));
const manifestsById = new Map();
const errors = [];

function populated(value) {
  return typeof value === "string" && value.trim().length > 0;
}

for (const manifest of manifests) {
  if (!manifest || typeof manifest !== "object") {
    errors.push("Generated media contains a non-object manifest.");
    continue;
  }
  const productId = manifest.productId;
  if (!populated(productId)) {
    errors.push("Generated media manifest is missing productId.");
    continue;
  }
  if (manifestsById.has(productId)) {
    errors.push(`${productId}: duplicate generated media manifest.`);
    continue;
  }
  manifestsById.set(productId, manifest);

  const record = recordsById.get(productId);
  if (!record) {
    errors.push(`${productId}: product is not present in the catalog archive.`);
    continue;
  }
  if (!record.render) {
    errors.push(`${productId}: catalog record has no render spec.`);
    continue;
  }
  if (manifest.schemaVersion !== 1) errors.push(`${productId}: manifest schemaVersion must be 1.`);
  if (manifest.renderVersion !== record.render.renderVersion) errors.push(`${productId}: renderVersion does not match catalog render spec.`);
  if (manifest.templateId !== record.render.templateId || manifest.templateVersion !== record.render.templateVersion) {
    errors.push(`${productId}: template identity does not match catalog render spec.`);
  }
  if (manifest.profileId !== record.render.profileId) errors.push(`${productId}: profileId does not match catalog render spec.`);
  if (!Number.isFinite(Date.parse(manifest.generatedAt))) errors.push(`${productId}: generatedAt is invalid.`);

  for (const view of ["front", "back"]) {
    const side = manifest.sides?.[view];
    if (!side?.master || !populated(side.master.storageKey) || !populated(side.master.url) || side.master.immutable !== true) {
      errors.push(`${productId}: ${view} master is incomplete or mutable.`);
    }
    for (const kind of ["detail", "card", "thumbnail", "social"]) {
      const derivative = side?.derivatives?.[kind];
      if (!derivative || !populated(derivative.storageKey) || !populated(derivative.url) || derivative.immutable !== true) {
        errors.push(`${productId}: ${view} ${kind} derivative is incomplete or mutable.`);
      }
    }
  }
}

if (!allowPartial) {
  for (const record of archive.filter((candidate) => candidate.status === "published")) {
    if (!manifestsById.has(record.id)) errors.push(`${record.id}: published product is missing from generated media input.`);
  }
}

if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log(`Validated ${manifests.length} generated media manifest(s).`);
if (!writeArchive) {
  console.log("Dry run only. Pass --write-archive to attach validated manifests to data/catalog/archive.json.");
  process.exit(0);
}

for (const [productId, manifest] of manifestsById) {
  const record = recordsById.get(productId);
  record.generatedMedia = manifest;
}

await writeFile(archivePath, `${JSON.stringify(archive, null, 2)}\n`, "utf8");
console.log(`Attached ${manifestsById.size} immutable generated media manifest(s) to the catalog archive. Review and validate the repository diff before commit.`);
