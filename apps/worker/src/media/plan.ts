import type {
  GarmentTemplateDefinition,
  GarmentTemplateViewDefinition,
  GeneratedImageRef,
  GeneratedMediaSide,
  MediaDerivativeDefinition,
  MediaDerivativeKind,
  ProductGeneratedMediaManifest,
  ProductRenderProfile,
  ProductRenderSpec,
  ProductSideRenderSpec,
  ProductView,
  PrintTextLayer,
  PrintTextStyle,
} from "@unsaid/domain";
import { validateProductRenderSpec } from "@unsaid/domain";

export interface ProductRenderPlanInput {
  productId: string;
  spec: ProductRenderSpec;
  template: GarmentTemplateDefinition;
  profile: ProductRenderProfile;
}

export interface PlannedDerivative extends MediaDerivativeDefinition {
  storageKey: string;
}

export interface ProductSideRenderPlan {
  productId: string;
  view: ProductView;
  templateStorageKey: string;
  templateWidth: number;
  templateHeight: number;
  background: string;
  overlaySvg: string;
  masterStorageKey: string;
  derivatives: readonly PlannedDerivative[];
}

export interface ProductRenderPlan {
  productId: string;
  spec: ProductRenderSpec;
  template: GarmentTemplateDefinition;
  profile: ProductRenderProfile;
  sides: Record<ProductView, ProductSideRenderPlan>;
}

export interface RenderedFile {
  storageKey: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/avif";
  width: number;
  height: number;
}

export interface RenderedSideFiles {
  master: RenderedFile;
  derivatives: Partial<Record<MediaDerivativeKind, RenderedFile>>;
}

export interface MediaRenderBackend {
  renderSide(plan: ProductSideRenderPlan): Promise<RenderedSideFiles>;
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "asset";
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function mergedStyle(profile: ProductRenderProfile, layer: PrintTextLayer): PrintTextStyle {
  return { ...profile.defaultTextStyle, ...layer.style };
}

function wrapWords(text: string, maxLines: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const target = Math.max(8, Math.ceil(text.length / Math.max(1, maxLines)));
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && candidate.length > target && lines.length < maxLines - 1) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function textLayerSvg(
  layer: PrintTextLayer,
  templateView: GarmentTemplateViewDefinition,
  profile: ProductRenderProfile,
) {
  const placement = layer.placement ?? templateView.printableArea;
  const style = mergedStyle(profile, layer);
  const text = style.uppercase ? layer.text.toLocaleUpperCase("it") : layer.text;
  const lines = wrapWords(text, style.maxLines);
  if (!lines.length) return "";

  const x = placement.x * templateView.width;
  const y = placement.y * templateView.height;
  const width = placement.width * templateView.width;
  const height = placement.height * templateView.height;
  const longest = Math.max(...lines.map((line) => line.length), 1);
  const widthBound = width / (longest * 0.61);
  const heightBound = height / (lines.length * style.lineHeight);
  const fontSize = Math.max(10, Math.floor(Math.min(widthBound, heightBound)));
  const lineAdvance = fontSize * style.lineHeight;
  const totalHeight = lineAdvance * (lines.length - 1);
  const centerX = x + width / 2;
  const firstY = y + height / 2 - totalHeight / 2;
  const tracking = style.trackingEm * fontSize;

  return lines
    .map((line, index) => {
      const lineY = firstY + index * lineAdvance;
      return `<text x="${centerX.toFixed(2)}" y="${lineY.toFixed(2)}" text-anchor="middle" dominant-baseline="middle" font-family="${escapeXml(style.fontFamily)}" font-size="${fontSize}" font-weight="${style.fontWeight}" letter-spacing="${tracking.toFixed(2)}" fill="${escapeXml(style.color)}">${escapeXml(line)}</text>`;
    })
    .join("");
}

export function createOverlaySvg(
  side: ProductSideRenderSpec,
  templateView: GarmentTemplateViewDefinition,
  profile: ProductRenderProfile,
) {
  const body = side.layers
    .map((layer) => (layer.kind === "text" ? textLayerSvg(layer, templateView, profile) : ""))
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${templateView.width}" height="${templateView.height}" viewBox="0 0 ${templateView.width} ${templateView.height}">${body}</svg>`;
}

function sidePlan(
  productId: string,
  view: ProductView,
  spec: ProductRenderSpec,
  template: GarmentTemplateDefinition,
  profile: ProductRenderProfile,
): ProductSideRenderPlan {
  const templateView = template.views[view];
  if (templateView.status !== "ready" || !templateView.storageKey) {
    throw new Error(`Template ${template.id}@${template.version}.${view} is not ready.`);
  }
  const root = `generated/products/${safeSegment(productId)}/${safeSegment(spec.renderVersion)}/${view}`;
  return {
    productId,
    view,
    templateStorageKey: templateView.storageKey,
    templateWidth: templateView.width,
    templateHeight: templateView.height,
    background: profile.background,
    overlaySvg: createOverlaySvg(spec.sides[view], templateView, profile),
    masterStorageKey: `${root}/master.png`,
    derivatives: profile.derivatives.map((derivative) => ({
      ...derivative,
      storageKey: `${root}/${derivative.kind}.${derivative.format}`,
    })),
  };
}

export function planProductRender(input: ProductRenderPlanInput): ProductRenderPlan {
  const { productId, spec, template, profile } = input;
  const specErrors = validateProductRenderSpec(spec);
  if (specErrors.length) throw new Error(specErrors.join(" "));
  if (!productId.trim()) throw new Error("productId is required.");
  if (template.id !== spec.templateId || template.version !== spec.templateVersion) {
    throw new Error(`Template ${template.id}@${template.version} does not match render spec ${spec.templateId}@${spec.templateVersion}.`);
  }
  if (profile.id !== spec.profileId) throw new Error(`Profile ${profile.id} does not match render spec ${spec.profileId}.`);

  return {
    productId,
    spec,
    template,
    profile,
    sides: {
      front: sidePlan(productId, "front", spec, template, profile),
      back: sidePlan(productId, "back", spec, template, profile),
    },
  };
}

function generatedRef(productId: string, view: ProductView, suffix: string, file: RenderedFile, url: string): GeneratedImageRef {
  return {
    id: `${productId}:${view}:${suffix}`,
    storageKey: file.storageKey,
    url,
    mimeType: file.mimeType,
    width: file.width,
    height: file.height,
    immutable: true,
  };
}

function generatedSide(
  productId: string,
  view: ProductView,
  files: RenderedSideFiles,
  publicUrlForKey: (storageKey: string) => string,
): GeneratedMediaSide {
  const derivatives: Partial<Record<MediaDerivativeKind, GeneratedImageRef>> = {};
  for (const kind of ["detail", "card", "thumbnail", "social"] as const) {
    const file = files.derivatives[kind];
    if (file) derivatives[kind] = generatedRef(productId, view, kind, file, publicUrlForKey(file.storageKey));
  }
  return {
    master: generatedRef(productId, view, "master", files.master, publicUrlForKey(files.master.storageKey)),
    derivatives,
  };
}

export async function executeProductRender(
  plan: ProductRenderPlan,
  backend: MediaRenderBackend,
  publicUrlForKey: (storageKey: string) => string,
  generatedAt = new Date().toISOString(),
): Promise<ProductGeneratedMediaManifest> {
  const [frontFiles, backFiles] = await Promise.all([
    backend.renderSide(plan.sides.front),
    backend.renderSide(plan.sides.back),
  ]);

  return {
    schemaVersion: 1,
    productId: plan.productId,
    renderVersion: plan.spec.renderVersion,
    templateId: plan.spec.templateId,
    templateVersion: plan.spec.templateVersion,
    profileId: plan.spec.profileId,
    generatedAt,
    sides: {
      front: generatedSide(plan.productId, "front", frontFiles, publicUrlForKey),
      back: generatedSide(plan.productId, "back", backFiles, publicUrlForKey),
    },
  };
}
