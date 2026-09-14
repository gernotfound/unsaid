import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const archivePath = resolve(root, "data/catalog/archive.json");
const write = process.argv.includes("--write");
const records = JSON.parse(await readFile(archivePath, "utf8"));

if (!Array.isArray(records)) throw new Error("data/catalog/archive.json must contain an array");
if (!records.length && write) throw new Error("Refusing --write: archive is empty");

const allowedStatus = new Set(["draft", "review", "render_ready", "published", "archived"]);
const allowedAudience = new Set(["general", "18+", "sensitive"]);
const allowedLanguage = new Set(["it", "en", "mixed"]);
const seenIds = new Set();
const seenSlugs = new Set();
const seenSequences = new Set();

function normalizeSearch(value) {
  return String(value ?? "")
    .toLocaleLowerCase("it")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function searchTokens(record) {
  const corpus = [
    record.id,
    record.slug,
    record.title,
    record.copy?.front,
    record.copy?.back,
    record.category,
  ].filter(Boolean).join(" ");
  return [...new Set(normalizeSearch(corpus).split(/\s+/).filter((token) => token.length >= 2))].slice(0, 100);
}

for (const record of records) {
  if (!/^UNS-\d{4,}$/.test(record.id)) throw new Error(`Invalid id: ${record.id}`);
  if (!Number.isInteger(record.sequence) || record.sequence < 1) throw new Error(`Invalid sequence: ${record.id}`);
  if (record.id !== `UNS-${String(record.sequence).padStart(4, "0")}`) throw new Error(`ID/sequence mismatch: ${record.id}`);
  if (!record.slug || typeof record.slug !== "string") throw new Error(`Missing slug: ${record.id}`);
  if (!record.copy?.front && !record.copy?.back) throw new Error(`Missing front/back copy: ${record.id}`);
  if (!record.title?.trim()) throw new Error(`Missing title: ${record.id}`);
  if (!allowedStatus.has(record.status)) throw new Error(`Invalid status: ${record.id}`);
  if (!allowedAudience.has(record.audience)) throw new Error(`Invalid audience: ${record.id}`);
  if (!allowedLanguage.has(record.language)) throw new Error(`Invalid language: ${record.id}`);
  if (seenIds.has(record.id)) throw new Error(`Duplicate id: ${record.id}`);
  if (seenSlugs.has(record.slug)) throw new Error(`Duplicate slug: ${record.slug}`);
  if (seenSequences.has(record.sequence)) throw new Error(`Duplicate sequence: ${record.sequence}`);
  seenIds.add(record.id);
  seenSlugs.add(record.slug);
  seenSequences.add(record.sequence);

  if (record.priceCents != null && (!Number.isInteger(record.priceCents) || record.priceCents < 0)) {
    throw new Error(`Invalid priceCents: ${record.id}`);
  }

  if (record.status === "published" || record.status === "render_ready") {
    for (const view of ["front", "back"]) {
      if (!record.media?.[view]?.asset || record.media[view].state !== "approved") {
        throw new Error(`${record.id}: ${view} must be approved for ${record.status}`);
      }
    }
  }

  for (const view of ["front", "back"]) {
    const media = record.media?.[view];
    if (record.copy?.[view] && media?.isBlankBase) {
      throw new Error(`${record.id}: ${view} has copy but is marked as a blank base`);
    }
    const asset = media?.asset;
    if (typeof asset === "string" && asset.startsWith("/products/")) {
      const localPath = resolve(root, "apps/web/public", asset.slice(1));
      await access(localPath).catch(() => {
        throw new Error(`${record.id}: missing local asset ${asset}`);
      });
    }
  }
}

const stats = records.reduce((acc, record) => {
  acc.total += 1;
  if (record.status === "published") acc.public += 1;
  if (record.status === "published" || record.status === "render_ready") acc.ready += 1;
  if (record.status === "draft") acc.concepts += 1;
  if (record.status === "review") acc.review += 1;
  if (record.audience === "18+") acc.adult += 1;
  if (record.audience === "sensitive") acc.sensitive += 1;
  return acc;
}, { total: 0, public: 0, ready: 0, concepts: 0, review: 0, adult: 0, sensitive: 0 });

console.log(`Validated ${records.length} catalog records (schema v3).`);
if (!write) {
  console.log("Dry run only. Pass --write to seed Firestore.");
  process.exit(0);
}

const { cert, getApps, initializeApp } = await import("firebase-admin/app");
const { getFirestore } = await import("firebase-admin/firestore");

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const app = getApps()[0] ?? initializeApp({
  credential: cert({
    projectId: required("FIREBASE_PROJECT_ID"),
    clientEmail: required("FIREBASE_CLIENT_EMAIL"),
    privateKey: required("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore(app);

const [catalogProbe, slugProbe] = await Promise.all([
  db.collection("catalog").limit(1).get(),
  db.collection("slugs").limit(1).get(),
]);
if (!catalogProbe.empty || !slugProbe.empty) {
  throw new Error("Refusing seed: Firestore catalog/slug locks are not empty.");
}

for (let index = 0; index < records.length; index += 100) {
  const batch = db.batch();
  for (const record of records.slice(index, index + 100)) {
    batch.set(db.doc(`catalog/${record.id}`), {
      ...record,
      searchTokens: searchTokens(record),
      schemaVersion: 3,
    });
    batch.set(db.doc(`slugs/${record.slug}`), {
      id: record.id,
      active: true,
      deletedAt: null,
    });
    if (record.status === "published") {
      const { notes: _notes, revision: _revision, ...publicRecord } = record;
      batch.set(db.doc(`publicCatalog/${record.id}`), { ...publicRecord, schemaVersion: 3 });
    }
  }
  await batch.commit();
}

await db.doc("meta/catalog").set({
  ...stats,
  nextSequence: Math.max(0, ...records.map((record) => record.sequence)),
  schemaVersion: 3,
  updatedAt: new Date().toISOString(),
});

console.log(`Seeded ${records.length} records to Firestore.`);
