import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type {
  GarmentTemplateDefinition,
  GarmentTemplateViewDefinition,
  ProductRenderSpec,
} from "@unsaid/domain";
import archiveSeed from "../../../../data/catalog/archive.json";
import {
  FileSystemMediaObjectStore,
  ingestPreparedMasters,
  MASTER_INTAKE,
  type IngestedMasterView,
} from "./index";
import {
  createManagedMediaBackend,
  createSharpRasterizer,
  executeProductRender,
  findRenderProfile,
  findTemplate,
  MEDIA_REGISTRY,
  planProductRender,
} from "./index";

type PreviewRecord = {
  id: string;
  status: string;
  render?: ProductRenderSpec;
};

const root = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
const sourceArg = process.argv.find((arg) => arg.startsWith("--source-dir="));
const outputArg = process.argv.find((arg) => arg.startsWith("--output-dir="));
const productArg = process.argv.find((arg) => arg.startsWith("--product="));
const sourceDirectory = sourceArg ? resolve(sourceArg.slice("--source-dir=".length)) : null;
const outputRoot = resolve(outputArg?.slice("--output-dir=".length) || resolve(root, ".media-stage/qa-media"));
const productId = productArg?.slice("--product=".length).trim() || null;

if (!sourceDirectory) {
  throw new Error("Pass --source-dir=/absolute/path/to/hash-locked-clean-masters.");
}

const store = new FileSystemMediaObjectStore(outputRoot);
const ingested = await ingestPreparedMasters(sourceDirectory, store);
const ingestedByView = new Map(ingested.map((view) => [view.view, view] as const));
const baseTemplate = findTemplate(MEDIA_REGISTRY, MASTER_INTAKE.templateId, MASTER_INTAKE.templateVersion);
if (!baseTemplate) {
  throw new Error(`Template ${MASTER_INTAKE.templateId}@${MASTER_INTAKE.templateVersion} was not found.`);
}

function readyView(
  base: GarmentTemplateViewDefinition,
  view: IngestedMasterView | undefined,
): GarmentTemplateViewDefinition {
  if (!view) throw new Error("Missing ingested preview master.");
  return {
    ...base,
    status: "ready",
    width: view.width,
    height: view.height,
    mimeType: view.mimeType as GarmentTemplateViewDefinition["mimeType"],
    storageKey: view.storageKey,
    sha256: view.sha256,
    sourceNote: `Local QA master verified from intake sha256=${view.sha256}`,
  };
}

const template: GarmentTemplateDefinition = {
  ...baseTemplate,
  views: {
    front: readyView(baseTemplate.views.front, ingestedByView.get("front")),
    back: readyView(baseTemplate.views.back, ingestedByView.get("back")),
  },
};

const records = (archiveSeed as unknown as readonly PreviewRecord[])
  .filter((record) => record.status === "published")
  .filter((record) => !productId || record.id === productId);

if (!records.length) {
  throw new Error(productId ? `Published product ${productId} was not found.` : "No published products found.");
}

const backend = createManagedMediaBackend({
  rasterizer: createSharpRasterizer(),
  store,
});
const generatedAt = new Date().toISOString();
const manifests = [];

for (const record of records) {
  if (!record.render) throw new Error(`${record.id}: missing render spec.`);
  const profile = findRenderProfile(MEDIA_REGISTRY, record.render.profileId);
  if (!profile) throw new Error(`${record.id}: profile ${record.render.profileId} was not found.`);
  const plan = planProductRender({
    productId: record.id,
    spec: record.render,
    template,
    profile,
  });
  manifests.push(
    await executeProductRender(
      plan,
      backend,
      (storageKey) => pathToFileURL(resolve(outputRoot, storageKey)).href,
      generatedAt,
    ),
  );
  console.log(`Rendered QA media for ${record.id}.`);
}

const manifestPath = resolve(outputRoot, "qa-manifests.json");
await mkdir(dirname(manifestPath), { recursive: true });
await writeFile(
  manifestPath,
  `${JSON.stringify({ schemaVersion: 1, generatedAt, manifests }, null, 2)}\n`,
  "utf8",
);
console.log(`QA media root: ${outputRoot}`);
console.log(`QA manifest bundle: ${manifestPath}`);
