import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const root = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const archive = JSON.parse(await readFile(resolve(root, "data/catalog/archive.json"), "utf8"));
const write = process.argv.includes("--write");
const allowPartial = process.argv.includes("--allow-partial");

if (!Array.isArray(archive)) throw new Error("data/catalog/archive.json must contain an array.");

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const published = archive.filter((record) => record.status === "published");
const candidates = published.filter((record) => record.generatedMedia);
const missing = published.filter((record) => !record.generatedMedia).map((record) => record.id);

if (missing.length && !allowPartial) {
  throw new Error(`Refusing partial generated-media publication. Missing: ${missing.join(", ")}.`);
}
if (!candidates.length) throw new Error("No published products contain generatedMedia.");

for (const record of candidates) {
  const manifest = record.generatedMedia;
  if (manifest.productId !== record.id) throw new Error(`${record.id}: generatedMedia.productId mismatch.`);
  if (!record.render) throw new Error(`${record.id}: generatedMedia exists without a render spec.`);
  if (manifest.renderVersion !== record.render.renderVersion) throw new Error(`${record.id}: generatedMedia.renderVersion mismatch.`);
  if (manifest.templateId !== record.render.templateId || manifest.templateVersion !== record.render.templateVersion) {
    throw new Error(`${record.id}: generatedMedia template identity mismatch.`);
  }
  if (manifest.profileId !== record.render.profileId) throw new Error(`${record.id}: generatedMedia profileId mismatch.`);
}

console.log(`Generated media publication set: ${candidates.map((record) => record.id).join(", ")}`);
if (missing.length) console.warn(`Partial publication explicitly allowed; legacy fallback remains for: ${missing.join(", ")}`);

if (!write) {
  console.log("Dry run only. Pass --write to atomically update generatedMedia on existing catalog/publicCatalog documents.");
  process.exit(0);
}

const app = getApps()[0] ?? initializeApp({
  credential: cert({
    projectId: required("FIREBASE_PROJECT_ID"),
    clientEmail: required("FIREBASE_CLIENT_EMAIL"),
    privateKey: required("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore(app);
const refs = candidates.flatMap((record) => [
  db.collection("catalog").doc(record.id),
  db.collection("publicCatalog").doc(record.id),
]);
const snapshots = await db.getAll(...refs);
const missingDocuments = snapshots.filter((snapshot) => !snapshot.exists).map((snapshot) => snapshot.ref.path);
if (missingDocuments.length) {
  throw new Error(`Refusing generated-media publication because catalog documents are missing: ${missingDocuments.join(", ")}.`);
}

const batch = db.batch();
for (const record of candidates) {
  const update = {
    generatedMedia: record.generatedMedia,
    updatedAt: FieldValue.serverTimestamp(),
  };
  batch.update(db.collection("catalog").doc(record.id), update);
  batch.update(db.collection("publicCatalog").doc(record.id), update);
}
await batch.commit();
console.log(`Published generatedMedia for ${candidates.length} product(s) to catalog and publicCatalog.`);
