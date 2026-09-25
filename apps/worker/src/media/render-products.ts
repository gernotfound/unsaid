import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ProductRenderSpec } from "@unsaid/domain";
import archiveSeed from "../../../../data/catalog/archive.json";
import {
  createManagedMediaBackend,
  createSharpRasterizer,
  executeProductRender,
  findRenderProfile,
  findTemplate,
  MEDIA_REGISTRY,
  planProductRender,
  RepositoryMediaObjectStore,
  repositoryPublicMediaUrlForStorageKey,
  validateMediaConfiguration,
} from "./index";

type RenderableCatalogRecord = {
  id: string;
  status: string;
  render?: ProductRenderSpec;
};

const root = resolve(fileURLToPath(new URL("../../../..", import.meta.url)));
const outputArg = process.argv.find((arg) => arg.startsWith("--output="));
const productArg = process.argv.find((arg) => arg.startsWith("--product="));
const write = process.argv.includes("--write");
const outputPath = resolve(
  outputArg?.slice("--output=".length) || resolve(root, ".media-stage/generated-media.json"),
);
const productId = productArg?.slice("--product=".length).trim() || null;

const configuration = validateMediaConfiguration();
for (const warning of configuration.warnings) console.warn(`WARN: ${warning}`);
if (configuration.errors.length) {
  for (const error of configuration.errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

const records = (archiveSeed as unknown as readonly RenderableCatalogRecord[])
  .filter((record) => record.status === "published")
  .filter((record) => !productId || record.id === productId);

if (!records.length) {
  throw new Error(productId ? `Published product ${productId} was not found.` : "No published products found.");
}

const plans = records.map((record) => {
  if (!record.render) throw new Error(`${record.id}: missing render spec.`);
  const template = findTemplate(
    MEDIA_REGISTRY,
    record.render.templateId,
    record.render.templateVersion,
  );
  const profile = findRenderProfile(MEDIA_REGISTRY, record.render.profileId);
  if (!template) {
    throw new Error(
      `${record.id}: template ${record.render.templateId}@${record.render.templateVersion} not found.`,
    );
  }
  if (!profile) throw new Error(`${record.id}: profile ${record.render.profileId} not found.`);
  return planProductRender({
    productId: record.id,
    spec: record.render,
    template,
    profile,
  });
});

console.log(`Planned ${plans.length} published product render(s).`);
for (const plan of plans) {
  console.log(
    `${plan.productId}: ${plan.sides.front.masterStorageKey} | ${plan.sides.back.masterStorageKey}`,
  );
}

if (!write) {
  console.log("Dry run only. Pass --write to rasterize immutable generated media into apps/web/public/generated.");
  process.exit(0);
}

const store = new RepositoryMediaObjectStore(root);
const backend = createManagedMediaBackend({
  rasterizer: createSharpRasterizer(),
  store,
});

const generatedAt = new Date().toISOString();
const manifests = [];
for (const plan of plans) {
  console.log(`Rendering ${plan.productId}...`);
  manifests.push(
    await executeProductRender(
      plan,
      backend,
      repositoryPublicMediaUrlForStorageKey,
      generatedAt,
    ),
  );
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify({ schemaVersion: 1, generatedAt, manifests }, null, 2)}\n`,
  "utf8",
);

console.log(`Rendered ${manifests.length} product(s).`);
console.log(`Wrote generated-media manifest bundle to ${outputPath}.`);
console.log(
  "Review the outputs, then run media:attach-manifests in dry-run mode before changing catalog metadata.",
);
