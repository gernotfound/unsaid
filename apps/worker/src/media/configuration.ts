import type { ProductGeneratedMediaManifest, ProductRenderSpec } from "@unsaid/domain";
import { validateProductRenderSpec } from "@unsaid/domain";
import archiveSeed from "../../../../data/catalog/archive.json";
import { MASTER_INTAKE } from "./intake";
import { MEDIA_REGISTRY, findRenderProfile, findTemplate, validateMediaRegistry } from "./registry";

type SeedRecord = {
  id: string;
  copy: { front: string | null; back: string | null };
  render?: ProductRenderSpec;
  generatedMedia?: ProductGeneratedMediaManifest;
};

function expectedMasterKey(view: "front" | "back", sha256: string) {
  const extension = MASTER_INTAKE.views[view].fileName.split(".").at(-1)?.toLocaleLowerCase();
  if (!extension) return "";
  return `masters/templates/${MASTER_INTAKE.templateId}/v${MASTER_INTAKE.templateVersion}/${view}-${sha256.slice(0, 16)}.${extension}`;
}

function validateMasterIntake(errors: string[], warnings: string[]) {
  const intake = MASTER_INTAKE;
  if (intake.schemaVersion !== 1) errors.push("master-intake.schemaVersion must be 1.");
  const template = findTemplate(MEDIA_REGISTRY, intake.templateId, intake.templateVersion);
  if (!template) {
    errors.push(`Master intake references missing template ${intake.templateId}@${intake.templateVersion}.`);
    return;
  }

  for (const view of ["front", "back"] as const) {
    const asset = intake.views[view];
    const definition = template.views[view];
    if (!asset.fileName.trim()) errors.push(`master-intake.${view}.fileName is required.`);
    if (asset.width < 1 || asset.height < 1) errors.push(`master-intake.${view} has invalid dimensions.`);
    if (asset.bytes < 1) errors.push(`master-intake.${view}.bytes must be positive.`);
    if (!/^[a-f0-9]{64}$/i.test(asset.sha256)) errors.push(`master-intake.${view}.sha256 is invalid.`);

    if (intake.status === "prepared-not-ingested") {
      if (definition.status === "ready") {
        errors.push(`${intake.templateId}@${intake.templateVersion}.${view} is ready while master intake is not ingested.`);
      }
      if (asset.width < definition.width || asset.height < definition.height) {
        warnings.push(`Prepared ${view} master is smaller than the registered reference canvas.`);
      }
    } else {
      if (definition.status !== "ready" || !definition.storageKey) {
        errors.push(`${intake.templateId}@${intake.templateVersion}.${view} must be ready after master ingestion.`);
        continue;
      }
      if (definition.storageKey !== expectedMasterKey(view, asset.sha256)) {
        errors.push(`${intake.templateId}@${intake.templateVersion}.${view} storageKey does not match the hash-locked intake key.`);
      }
      if (definition.sha256 !== asset.sha256.toLocaleLowerCase()) {
        errors.push(`${intake.templateId}@${intake.templateVersion}.${view} sha256 does not match the hash-locked intake.`);
      }
      if (definition.width !== asset.width || definition.height !== asset.height || definition.mimeType !== asset.mimeType) {
        errors.push(`${intake.templateId}@${intake.templateVersion}.${view} metadata does not match the ingested master intake.`);
      }
    }
  }

  if (intake.status === "prepared-not-ingested") {
    warnings.push(`Clean masters for ${intake.templateId}@${intake.templateVersion} are prepared and hash-locked, but still require managed-storage ingestion before the template may be marked ready.`);
  } else {
    if (!intake.storageBucket?.trim()) errors.push("master-intake.storageBucket is required after ingestion.");
    if (!intake.ingestedAt || !Number.isFinite(Date.parse(intake.ingestedAt))) {
      errors.push("master-intake.ingestedAt must be a valid timestamp after ingestion.");
    }
  }
}

function validateGeneratedMedia(
  record: SeedRecord,
  manifest: ProductGeneratedMediaManifest,
  errors: string[],
) {
  const spec = record.render;
  if (!spec) return;
  if (manifest.schemaVersion !== 1) errors.push(`${record.id}: generatedMedia.schemaVersion must be 1.`);
  if (manifest.productId !== record.id) errors.push(`${record.id}: generatedMedia.productId mismatch.`);
  if (manifest.renderVersion !== spec.renderVersion) errors.push(`${record.id}: generatedMedia.renderVersion mismatch.`);
  if (manifest.templateId !== spec.templateId || manifest.templateVersion !== spec.templateVersion) {
    errors.push(`${record.id}: generatedMedia template identity mismatch.`);
  }
  if (manifest.profileId !== spec.profileId) errors.push(`${record.id}: generatedMedia.profileId mismatch.`);
  if (!Number.isFinite(Date.parse(manifest.generatedAt))) errors.push(`${record.id}: generatedMedia.generatedAt is invalid.`);

  const profile = findRenderProfile(MEDIA_REGISTRY, spec.profileId);
  for (const view of ["front", "back"] as const) {
    const side = manifest.sides?.[view];
    if (!side?.master?.storageKey || !side.master.url) errors.push(`${record.id}: generatedMedia.${view}.master is incomplete.`);
    if (side?.master && side.master.immutable !== true) errors.push(`${record.id}: generatedMedia.${view}.master must be immutable.`);
    if (side?.master && (side.master.width < 1 || side.master.height < 1)) errors.push(`${record.id}: generatedMedia.${view}.master has invalid dimensions.`);

    if (!profile) continue;
    for (const derivative of profile.derivatives) {
      const generated = side?.derivatives?.[derivative.kind];
      if (!generated) {
        errors.push(`${record.id}: generatedMedia.${view}.${derivative.kind} is missing.`);
        continue;
      }
      if (generated.immutable !== true) errors.push(`${record.id}: generatedMedia.${view}.${derivative.kind} must be immutable.`);
      if (!generated.storageKey || !generated.url) errors.push(`${record.id}: generatedMedia.${view}.${derivative.kind} is incomplete.`);
      if (generated.width !== derivative.width || generated.height !== derivative.height) {
        errors.push(`${record.id}: generatedMedia.${view}.${derivative.kind} dimensions do not match render profile.`);
      }
    }
  }
}

export function validateMediaConfiguration() {
  const registryResult = validateMediaRegistry(MEDIA_REGISTRY);
  const errors = [...registryResult.errors];
  const warnings = [...registryResult.warnings];
  const records = archiveSeed as unknown as readonly SeedRecord[];

  validateMasterIntake(errors, warnings);

  for (const record of records) {
    if (!record.render) {
      errors.push(`${record.id} has no render spec.`);
      continue;
    }
    errors.push(...validateProductRenderSpec(record.render).map((message) => `${record.id}: ${message}`));
    const template = findTemplate(MEDIA_REGISTRY, record.render.templateId, record.render.templateVersion);
    const profile = findRenderProfile(MEDIA_REGISTRY, record.render.profileId);
    if (!template) errors.push(`${record.id}: template ${record.render.templateId}@${record.render.templateVersion} not found.`);
    if (!profile) errors.push(`${record.id}: profile ${record.render.profileId} not found.`);

    for (const view of ["front", "back"] as const) {
      const expectedCopy = record.copy[view]?.trim() ?? "";
      const renderedText = record.render.sides[view].layers
        .filter((layer) => layer.kind === "text")
        .map((layer) => layer.text.trim())
        .join(" ");
      if (expectedCopy && !renderedText) errors.push(`${record.id}: ${view} copy exists but render layers are empty.`);
      if (!expectedCopy && renderedText) warnings.push(`${record.id}: ${view} has render text but no editorial copy.`);
    }

    if (record.generatedMedia) validateGeneratedMedia(record, record.generatedMedia, errors);
  }

  return { errors, warnings };
}
