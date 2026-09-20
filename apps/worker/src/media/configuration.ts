import type { ProductRenderSpec } from "@unsaid/domain";
import { validateProductRenderSpec } from "@unsaid/domain";
import archiveSeed from "../../../../data/catalog/archive.json";
import { MASTER_INTAKE } from "./intake";
import { MEDIA_REGISTRY, findRenderProfile, findTemplate, validateMediaRegistry } from "./registry";

type SeedRecord = {
  id: string;
  copy: { front: string | null; back: string | null };
  render?: ProductRenderSpec;
};

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
    if (!asset.fileName.trim()) errors.push(`master-intake.${view}.fileName is required.`);
    if (asset.width < 1 || asset.height < 1) errors.push(`master-intake.${view} has invalid dimensions.`);
    if (asset.bytes < 1) errors.push(`master-intake.${view}.bytes must be positive.`);
    if (!/^[a-f0-9]{64}$/i.test(asset.sha256)) errors.push(`master-intake.${view}.sha256 is invalid.`);
    if (asset.width < template.views[view].width || asset.height < template.views[view].height) {
      warnings.push(`Prepared ${view} master is smaller than the registered reference canvas.`);
    }
  }

  if (intake.status === "prepared-not-ingested") {
    warnings.push(`Clean masters for ${intake.templateId}@${intake.templateVersion} are prepared and hash-locked, but still require managed-storage ingestion before the template may be marked ready.`);
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
  }

  return { errors, warnings };
}
