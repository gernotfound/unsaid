export type ProductMediaRole =
  | "clean-front"
  | "clean-back"
  | "detail"
  | "editorial"
  | "campaign"
  | "video";

export type BrandModelId = "MODEL-01";

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
