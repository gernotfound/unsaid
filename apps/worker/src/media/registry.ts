import type { GarmentTemplateDefinition, ProductRenderProfile } from "@unsaid/domain";
import { validateNormalizedRect } from "@unsaid/domain";
import profilesSeed from "../../../../data/media/render-profiles.json";
import templatesSeed from "../../../../data/media/templates.json";

export interface MediaRegistry {
  templates: readonly GarmentTemplateDefinition[];
  profiles: readonly ProductRenderProfile[];
}

export const MEDIA_REGISTRY: MediaRegistry = {
  templates: templatesSeed as unknown as readonly GarmentTemplateDefinition[],
  profiles: profilesSeed as unknown as readonly ProductRenderProfile[],
};

export function findTemplate(registry: MediaRegistry, id: string, version: number) {
  return registry.templates.find((template) => template.id === id && template.version === version);
}

export function findRenderProfile(registry: MediaRegistry, id: string) {
  return registry.profiles.find((profile) => profile.id === id);
}

export function validateMediaRegistry(registry: MediaRegistry) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const templateKeys = new Set<string>();
  const profileIds = new Set<string>();

  for (const template of registry.templates) {
    const key = `${template.id}@${template.version}`;
    if (templateKeys.has(key)) errors.push(`Duplicate template ${key}.`);
    templateKeys.add(key);
    for (const view of ["front", "back"] as const) {
      const definition = template.views[view];
      if (definition.width < 1 || definition.height < 1) errors.push(`${key}.${view} has invalid dimensions.`);
      errors.push(...validateNormalizedRect(definition.printableArea, `${key}.${view}.printableArea`));
      if (definition.status === "ready" && !definition.storageKey) errors.push(`${key}.${view} is ready but has no storageKey.`);
      if (definition.status === "ready" && !/^[a-f0-9]{64}$/i.test(definition.sha256 ?? "")) {
        errors.push(`${key}.${view} is ready but has no valid sha256.`);
      }
      if (definition.status === "reference-only") warnings.push(`${key}.${view} is reference-only and cannot be rendered yet.`);
    }
  }

  for (const profile of registry.profiles) {
    if (profileIds.has(profile.id)) errors.push(`Duplicate render profile ${profile.id}.`);
    profileIds.add(profile.id);
    if (!profile.derivatives.length) errors.push(`${profile.id} has no derivatives.`);
    const kinds = new Set<string>();
    for (const derivative of profile.derivatives) {
      if (kinds.has(derivative.kind)) errors.push(`${profile.id} has duplicate derivative ${derivative.kind}.`);
      kinds.add(derivative.kind);
      if (derivative.width < 1 || derivative.height < 1) errors.push(`${profile.id}.${derivative.kind} has invalid dimensions.`);
      if (derivative.quality < 1 || derivative.quality > 100) errors.push(`${profile.id}.${derivative.kind} quality must be 1..100.`);
    }
  }

  return { errors, warnings };
}
