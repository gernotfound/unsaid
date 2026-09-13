import { readFile } from "node:fs/promises";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const files = [
  "0001-0020.json",
  "0021-0040.json",
  "0041-0060.json",
  "0061-0080.json",
  "0081-0081.json",
];

async function readArchive() {
  const chunks = await Promise.all(
    files.map(async (file) => {
      const url = new URL(`../../../data/catalog/${file}`, import.meta.url);
      return JSON.parse(await readFile(url, "utf8"));
    }),
  );

  return chunks.flat();
}

function validate(records) {
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
    schemaVersion: 1,
  };
}

function phraseDocument(record) {
  return {
    id: record.id,
    legacyId: record.legacyId,
    frontText: record.phrase,
    backText: record.backPhrase,
    language: record.language,
    category: record.category,
    audience: record.audience,
    editorialStatus: record.status === "review" ? "needs_review" : "approved",
    publishable: record.publishable,
    notes: record.notes,
    schemaVersion: 1,
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
    schemaVersion: 1,
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

const db = firestore();
const batch = db.batch();

for (const record of records) {
  batch.set(db.collection("phrases").doc(record.id), phraseDocument(record));
  batch.set(db.collection("products").doc(record.id), productDocument(record));
  batch.set(db.collection("catalog").doc(record.id), { ...record, schemaVersion: 1 });
}

batch.set(db.doc("meta/catalogStats"), archiveStats);
await batch.commit();

console.log(
  `[UNSAID] Firestore seeded: ${records.length * 3 + 1} document writes across phrases, products, catalog and meta.`,
);
