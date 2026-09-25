import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { MasterIntakeManifest } from "./intake";
import {
  ingestPreparedMasters,
  RepositoryMediaObjectStore,
  verifyPreparedMasters,
} from "./index";

const root = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
const intakePath = resolve(root, "data/media/master-intake.json");
const templatesPath = resolve(root, "data/media/templates.json");
const sourceArg = process.argv.find((arg) => arg.startsWith("--source-dir="));
const sourceDirectory = sourceArg ? resolve(sourceArg.slice("--source-dir=".length)) : null;
const write = process.argv.includes("--write");
const promoteTemplate = process.argv.includes("--promote-template");

if (!sourceDirectory) throw new Error("Pass --source-dir=/absolute/path/to/clean-masters.");
if (promoteTemplate && !write) {
  throw new Error("--promote-template requires --write because promotion is valid only after repository ingestion.");
}

const intake = JSON.parse(await readFile(intakePath, "utf8")) as MasterIntakeManifest;
const templates = JSON.parse(await readFile(templatesPath, "utf8")) as Array<{
  id: string;
  version: number;
  views: Record<"front" | "back", Record<string, unknown>>;
}>;

const verified = await verifyPreparedMasters(sourceDirectory, intake);
console.log(`Verified ${verified.length} hash-locked masters for ${intake.templateId}@${intake.templateVersion}.`);

if (!write) {
  for (const master of verified) {
    console.log(`${master.view}: ${master.definition.fileName} sha256=${master.definition.sha256}`);
  }
  console.log("Dry run only. Pass --write to copy the exact bytes into data/media/masters.");
  process.exit(0);
}

const store = new RepositoryMediaObjectStore(root);
const ingested = await ingestPreparedMasters(sourceDirectory, store, intake);
for (const item of ingested) {
  console.log(`Ingested ${item.view} -> data/media/${item.storageKey}`);
}

if (!promoteTemplate) {
  console.log("Repository ingestion complete. Re-run with --write --promote-template to update reviewed metadata.");
  process.exit(0);
}

const template = templates.find(
  (candidate) => candidate.id === intake.templateId && candidate.version === intake.templateVersion,
);
if (!template) throw new Error(`Template ${intake.templateId}@${intake.templateVersion} not found.`);

for (const item of ingested) {
  template.views[item.view] = {
    ...template.views[item.view],
    status: "ready",
    width: item.width,
    height: item.height,
    mimeType: item.mimeType,
    storageKey: item.storageKey,
    sha256: item.sha256,
    sourceNote: `Hash-locked clean master committed to canonical repository media. sha256=${item.sha256}`,
  };
}

intake.status = "ingested";
intake.ingestedAt = new Date().toISOString();
intake.storageBackend = "repository-static";

await Promise.all([
  writeFile(templatesPath, `${JSON.stringify(templates, null, 2)}\n`, "utf8"),
  writeFile(intakePath, `${JSON.stringify(intake, null, 2)}\n`, "utf8"),
]);

console.log("Promoted template metadata to ready. Review master binaries and metadata diff before commit.");
