import type { ProductRenderSpec } from "@unsaid/domain";
import { validateProductRenderSpec } from "@unsaid/domain";
import archiveSeed from "../../../../data/catalog/archive.json";
import { MEDIA_REGISTRY, findRenderProfile, findTemplate, validateMediaRegistry } from "./registry";

type SeedRecord = {
  id: string;
  copy: { front: string | null; back: string | null };
  render?: ProductRenderSpec;
};

export function validateMediaConfiguration() {
  const registryResult = validateMediaRegistry(MEDIA_REGISTRY);
  const errors = [...registryResult.errors];
  const warnings = [...registryResult.warnings];
  const records = archiveSeed as unknown as readonly SeedRecord[];

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
