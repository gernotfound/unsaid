import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const intakePath = resolve(root, "data/media/master-intake.json");
const templatesPath = resolve(root, "data/media/templates.json");
const intake = JSON.parse(await readFile(intakePath, "utf8"));
const templates = JSON.parse(await readFile(templatesPath, "utf8"));
const write = process.argv.includes("--write");
const promoteTemplate = process.argv.includes("--promote-template");
const sourceDirectoryArg = process.argv.find((arg) => arg.startsWith("--source-dir="));
const sourceDirectory = sourceDirectoryArg ? resolve(sourceDirectoryArg.slice("--source-dir=".length)) : null;

if (!sourceDirectory) {
  throw new Error("Pass --source-dir=/absolute/path/to/clean-masters.");
}
if (promoteTemplate && !write) {
  throw new Error("--promote-template requires --write because promotion is only valid after successful object upload.");
}
if (intake.schemaVersion !== 1) throw new Error("Unsupported master intake schema version.");
if (!Array.isArray(templates)) throw new Error("data/media/templates.json must contain an array.");

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function immutableMasterKey(view, definition) {
  const extension = extname(definition.fileName).replace(/^\./, "").toLocaleLowerCase();
  if (!extension) throw new Error(`${definition.fileName} has no extension.`);
  return `masters/templates/${intake.templateId}/v${intake.templateVersion}/${view}-${definition.sha256.slice(0, 16)}.${extension}`;
}

const verified = [];
for (const view of ["front", "back"]) {
  const definition = intake.views?.[view];
  if (!definition) throw new Error(`Missing intake definition for ${view}.`);
  const path = resolve(sourceDirectory, definition.fileName);
  const bytes = await readFile(path);
  const digest = sha256(bytes);
  if (bytes.byteLength !== definition.bytes) {
    throw new Error(`${view}: ${bytes.byteLength} bytes does not match intake ${definition.bytes}.`);
  }
  if (digest !== String(definition.sha256).toLocaleLowerCase()) {
    throw new Error(`${view}: sha256 ${digest} does not match intake ${definition.sha256}.`);
  }
  verified.push({ view, definition, bytes, digest, storageKey: immutableMasterKey(view, definition) });
}

console.log(`Verified ${verified.length} hash-locked masters for ${intake.templateId}@${intake.templateVersion}.`);
for (const item of verified) console.log(`${item.view}: ${item.storageKey}`);

if (!write) {
  console.log("Dry run only. Pass --write to upload the exact bytes to Firebase Storage.");
  process.exit(0);
}

const [{ cert, getApps, initializeApp }, { getStorage }] = await Promise.all([
  import("firebase-admin/app"),
  import("firebase-admin/storage"),
]);

const app = getApps()[0] ?? initializeApp({
  credential: cert({
    projectId: required("FIREBASE_PROJECT_ID"),
    clientEmail: required("FIREBASE_CLIENT_EMAIL"),
    privateKey: required("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
  }),
});
const bucket = getStorage(app).bucket(required("FIREBASE_STORAGE_BUCKET"));

for (const item of verified) {
  const file = bucket.file(item.storageKey);
  try {
    await file.save(item.bytes, {
      resumable: false,
      validation: "crc32c",
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: {
        contentType: item.definition.mimeType,
        cacheControl: "private,max-age=0,no-store",
        metadata: { sha256: item.digest, immutable: "true", mediaRole: "garment-master" },
      },
    });
  } catch (error) {
    const code = Number(error && typeof error === "object" && "code" in error ? error.code : NaN);
    if (code !== 409 && code !== 412) throw error;
    const [existing] = await file.download();
    const existingDigest = sha256(existing);
    if (existingDigest !== item.digest) {
      throw new Error(`Immutable storage collision at ${item.storageKey}: ${existingDigest} != ${item.digest}.`);
    }
  }
  console.log(`Ingested ${item.view} -> gs://${bucket.name}/${item.storageKey}`);
}

if (!promoteTemplate) {
  console.log("Upload complete. Re-run with --write --promote-template on a reviewed branch to promote templates.json and intake status.");
  process.exit(0);
}

const template = templates.find((candidate) => candidate.id === intake.templateId && candidate.version === intake.templateVersion);
if (!template) throw new Error(`Template ${intake.templateId}@${intake.templateVersion} not found.`);
for (const item of verified) {
  template.views[item.view] = {
    ...template.views[item.view],
    status: "ready",
    width: item.definition.width,
    height: item.definition.height,
    mimeType: item.definition.mimeType,
    storageKey: item.storageKey,
    sha256: item.digest,
    sourceNote: `Hash-locked clean master ingested to Firebase Storage. sha256=${item.digest}`,
  };
}
intake.status = "ingested";
intake.ingestedAt = new Date().toISOString();
intake.storageBucket = bucket.name;

await Promise.all([
  writeFile(templatesPath, `${JSON.stringify(templates, null, 2)}\n`, "utf8"),
  writeFile(intakePath, `${JSON.stringify(intake, null, 2)}\n`, "utf8"),
]);
console.log("Promoted template metadata to ready and marked master intake ingested. Review the resulting repository diff before commit.");
