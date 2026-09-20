export type ProductMediaRole =
  | "clean-front"
  | "clean-back"
  | "detail"
  | "editorial"
  | "campaign"
  | "video";

export type ProductView = "front" | "back";
export type BrandModelId = "MODEL-01";
export type ImageMimeType = "image/jpeg" | "image/png" | "image/webp" | "image/avif";
export type MediaDerivativeKind = "detail" | "card" | "thumbnail" | "social";
export type TemplateMasterStatus = "reference-only" | "ready";

export interface MediaAssetRef {
  id: string;
  role: ProductMediaRole;
  url: string;
  mimeType: string;
  width?: number;
  height?: number;
  alt: string;
  immutable: boolean;
}

export interface EditorialModelReference {
  modelId: BrandModelId;
  version: number;
  colorway: string;
}

export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GarmentTemplateViewDefinition {
  status: TemplateMasterStatus;
  width: number;
  height: number;
  mimeType: ImageMimeType;
  printableArea: NormalizedRect;
  storageKey?: string;
  sourceNote?: string;
}

export interface GarmentTemplateDefinition {
  id: string;
  version: number;
  garmentColor: string;
  fit: string;
  views: Record<ProductView, GarmentTemplateViewDefinition>;
}

export interface PrintTextStyle {
  fontFamily: string;
  fontWeight: number;
  color: string;
  uppercase: boolean;
  lineHeight: number;
  trackingEm: number;
  maxLines: number;
}

export interface PrintTextLayer {
  id: string;
  kind: "text";
  text: string;
  placement?: NormalizedRect;
  style?: Partial<PrintTextStyle>;
}

export type PrintLayer = PrintTextLayer;

export interface ProductSideRenderSpec {
  layers: readonly PrintLayer[];
}

export interface ProductRenderSpec {
  schemaVersion: 1;
  templateId: string;
  templateVersion: number;
  profileId: string;
  renderVersion: string;
  sides: Record<ProductView, ProductSideRenderSpec>;
}

export interface MediaDerivativeDefinition {
  kind: MediaDerivativeKind;
  width: number;
  height: number;
  format: "webp" | "avif";
  quality: number;
}

export interface ProductRenderProfile {
  id: string;
  background: string;
  defaultTextStyle: PrintTextStyle;
  derivatives: readonly MediaDerivativeDefinition[];
}

export interface GeneratedImageRef {
  id: string;
  storageKey: string;
  url: string;
  mimeType: ImageMimeType;
  width: number;
  height: number;
  immutable: true;
}

export interface GeneratedMediaSide {
  master: GeneratedImageRef;
  derivatives: Partial<Record<MediaDerivativeKind, GeneratedImageRef>>;
}

export interface ProductGeneratedMediaManifest {
  schemaVersion: 1;
  productId: string;
  renderVersion: string;
  templateId: string;
  templateVersion: number;
  profileId: string;
  generatedAt: string;
  sides: Record<ProductView, GeneratedMediaSide>;
}

function inUnitInterval(value: number) {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

export function validateNormalizedRect(rect: NormalizedRect, label = "rect") {
  const errors: string[] = [];
  if (!inUnitInterval(rect.x)) errors.push(`${label}.x must be between 0 and 1.`);
  if (!inUnitInterval(rect.y)) errors.push(`${label}.y must be between 0 and 1.`);
  if (!Number.isFinite(rect.width) || rect.width <= 0 || rect.width > 1) errors.push(`${label}.width must be > 0 and <= 1.`);
  if (!Number.isFinite(rect.height) || rect.height <= 0 || rect.height > 1) errors.push(`${label}.height must be > 0 and <= 1.`);
  if (rect.x + rect.width > 1) errors.push(`${label} exceeds the right edge.`);
  if (rect.y + rect.height > 1) errors.push(`${label} exceeds the bottom edge.`);
  return errors;
}

export function validateProductRenderSpec(spec: ProductRenderSpec) {
  const errors: string[] = [];
  if (spec.schemaVersion !== 1) errors.push("render.schemaVersion must be 1.");
  if (!spec.templateId.trim()) errors.push("render.templateId is required.");
  if (!Number.isInteger(spec.templateVersion) || spec.templateVersion < 1) errors.push("render.templateVersion must be a positive integer.");
  if (!spec.profileId.trim()) errors.push("render.profileId is required.");
  if (!spec.renderVersion.trim()) errors.push("render.renderVersion is required.");

  for (const view of ["front", "back"] as const) {
    const side = spec.sides[view];
    const ids = new Set<string>();
    for (const layer of side.layers) {
      if (!layer.id.trim()) errors.push(`render.sides.${view} contains a layer without an id.`);
      if (ids.has(layer.id)) errors.push(`render.sides.${view} contains duplicate layer id ${layer.id}.`);
      ids.add(layer.id);
      if (layer.kind === "text") {
        if (!layer.text.trim()) errors.push(`render.sides.${view}.${layer.id} text is empty.`);
        if (layer.placement) errors.push(...validateNormalizedRect(layer.placement, `render.sides.${view}.${layer.id}.placement`));
        if (layer.style?.maxLines != null && (!Number.isInteger(layer.style.maxLines) || layer.style.maxLines < 1)) {
          errors.push(`render.sides.${view}.${layer.id}.style.maxLines must be a positive integer.`);
        }
      }
    }
  }

  return errors;
}

export const MODEL_01_CONTRACT = {
  id: "MODEL-01",
  version: 1,
  invariants: [
    "head-shape",
    "featureless-face",
    "body-proportions",
    "joint-design",
    "hand-foot-geometry",
    "silhouette",
  ],
  variableFields: ["shell-colorway", "lighting", "background", "pose", "garment", "artwork"],
} as const;
