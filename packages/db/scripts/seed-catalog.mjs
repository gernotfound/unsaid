import { readFile } from "node:fs/promises";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

async function readArchive() {
  const url = new URL("../../../data/catalog/archive.json", import.meta.url);
  return JSON.parse(await readFile(url, "utf8"));
}

function validate(records) {
  if (!Array.isArray(records)) throw new Error("Catalog source must be an array.");

  const ids = new Set();
  const slugs = new Set();

  for (const record of records) {
    if (!record.id || !record.slug || typeof record.publishable !== "boolean") {
      throw new Error(`Invalid catalog record: ${JSON.stringify(record)}`);
    }
    if (ids.has(record.id)) throw new Error(`Duplicate id: ${record.id}`);
    if (slugs.has(record.slug)) throw new Error(`Duplicate slug: ${record.slug}`);
    ids.add(record.id);
    slugs.add(record.slug);
  }
}

function stats(records) {
  return {
    total: records.length,
    public: records.filter((record) => record.publishable).length,
    ready: records.filter((record) => record.status === "ready").length,
    concepts: records.filter((record) => record.status === "concept").length,
    review: records.filter((record) => record.status === "review").length,
    adult: records.filter((record) => record.audience === "18+").length,
    schemaVersion: 2,
  };
}

function phraseDocument(record) {
  return {
    id: record.id,
    legacyId: record.legacyId ?? "",
    frontText: record.phrase,
    backText: record.backPhrase,
    language: record.language,
    category: record.category,
    audience: record.audience,
    editorialStatus: record.status === "review" ? "needs_review" : "approved",
    publishable: record.publishable,
    notes: record.notes,
    schemaVersion: 2,
  };
}

function productDocument(record) {
  return {
    id: record.id,
    phraseId: record.id,
    slug: record.slug,
    title: record.title,
    price: record.price,
    status: record.status,
    publishable: record.publishable,
    fit: record.fit,
    color: record.color,
    views: record.views,
    images: record.images,
    schemaVersion: 2,
  };
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function firestore() {
  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          projectId: required("FIREBASE_PROJECT_ID"),
          clientEmail: required("FIREBASE_CLIENT_EMAIL"),
          privateKey: required("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
        }),
      });

  return getFirestore(app);
}

const records = await readArchive();
validate(records);
const archiveStats = stats(records);
const shouldWrite = process.argv.includes("--write");

console.log(
  `[UNSAID] catalog validated: ${archiveStats.total} records, ${archiveStats.public} public, ${archiveStats.review} review.`,
);

if (!shouldWrite) {
  console.log("[UNSAID] dry run only. Add --write to seed Firestore.");
  process.exit(0);
}

if (!records.length) {
  throw new Error("Archive is empty. Refusing to seed Firestore until real UNSAID records are present.");
}

const db = firestore();

for (let index = 0; index < records.length; index += 100) {
  const chunk = records.slice(index, index + 100);
  const batch = db.batch();

  for (const record of chunk) {
    batch.set(db.collection("phrases").doc(record.id), phraseDocument(record));
    batch.set(db.collection("products").doc(record.id), productDocument(record));
    batch.set(db.collection("catalog").doc(record.id), { ...record, schemaVersion: 2 });
  }

  await batch.commit();
}

await db.doc("meta/catalogStats").set(archiveStats);
console.log(`[UNSAID] Firestore seeded from ${records.length} real catalog records.`);
