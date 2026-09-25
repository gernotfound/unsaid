import { createHash } from "node:crypto";
import type { MediaDerivativeKind } from "@unsaid/domain";
import type {
  MediaRenderBackend,
  ProductSideRenderPlan,
  RenderedFile,
  RenderedSideFiles,
} from "./plan";

export interface MediaBinaryStorePut {
  storageKey: string;
  bytes: Uint8Array;
  mimeType: "image/png" | "image/webp" | "image/avif";
  sha256: string;
  cacheControl: string;
}

export interface MediaBinaryStore {
  get(storageKey: string): Promise<Uint8Array>;
  putImmutable(input: MediaBinaryStorePut): Promise<void>;
}

export interface RasterMasterInput {
  source: Uint8Array;
  overlaySvg: string;
  width: number;
  height: number;
}

export interface RasterDerivativeInput {
  master: Uint8Array;
  width: number;
  height: number;
  format: "webp" | "avif";
  quality: number;
  background: string;
}

export interface MediaRasterizer {
  renderMaster(input: RasterMasterInput): Promise<Uint8Array>;
  renderDerivative(input: RasterDerivativeInput): Promise<Uint8Array>;
}

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

function derivativeMimeType(format: "webp" | "avif") {
  return format === "avif" ? "image/avif" as const : "image/webp" as const;
}

async function persist(
  store: MediaBinaryStore,
  file: Omit<RenderedFile, "mimeType"> & { mimeType: MediaBinaryStorePut["mimeType"] },
  bytes: Uint8Array,
) {
  await store.putImmutable({
    storageKey: file.storageKey,
    bytes,
    mimeType: file.mimeType,
    sha256: sha256(bytes),
    cacheControl: "public,max-age=31536000,immutable",
  });
  return file;
}

async function renderSide(
  plan: ProductSideRenderPlan,
  rasterizer: MediaRasterizer,
  store: MediaBinaryStore,
): Promise<RenderedSideFiles> {
  const source = await store.get(plan.templateStorageKey);
  const sourceDigest = sha256(source);
  if (sourceDigest !== plan.templateSha256.toLocaleLowerCase()) {
    throw new Error(
      `${plan.productId}.${plan.view}: template sha256 ${sourceDigest} does not match expected ${plan.templateSha256}.`,
    );
  }
  const masterBytes = await rasterizer.renderMaster({
    source,
    overlaySvg: plan.overlaySvg,
    width: plan.templateWidth,
    height: plan.templateHeight,
  });
  if (!masterBytes.byteLength) throw new Error(`${plan.productId}.${plan.view}: rasterizer returned an empty master.`);

  const master = await persist(
    store,
    {
      storageKey: plan.masterStorageKey,
      mimeType: "image/png",
      width: plan.templateWidth,
      height: plan.templateHeight,
    },
    masterBytes,
  );

  const derivatives: Partial<Record<MediaDerivativeKind, RenderedFile>> = {};
  await Promise.all(plan.derivatives.map(async (definition) => {
    const bytes = await rasterizer.renderDerivative({
      master: masterBytes,
      width: definition.width,
      height: definition.height,
      format: definition.format,
      quality: definition.quality,
      background: plan.background,
    });
    if (!bytes.byteLength) throw new Error(`${plan.productId}.${plan.view}.${definition.kind}: rasterizer returned empty bytes.`);
    derivatives[definition.kind] = await persist(
      store,
      {
        storageKey: definition.storageKey,
        mimeType: derivativeMimeType(definition.format),
        width: definition.width,
        height: definition.height,
      },
      bytes,
    );
  }));

  return { master, derivatives };
}

export function createManagedMediaBackend(options: {
  rasterizer: MediaRasterizer;
  store: MediaBinaryStore;
}): MediaRenderBackend {
  return {
    renderSide(plan) {
      return renderSide(plan, options.rasterizer, options.store);
    },
  };
}
