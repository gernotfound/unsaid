import sharp from "sharp";
import type {
  MediaRasterizer,
  RasterDerivativeInput,
  RasterMasterInput,
} from "./backend";

function sourceBuffer(bytes: Uint8Array) {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

async function assertDimensions(bytes: Uint8Array, width: number, height: number, label: string) {
  const metadata = await sharp(sourceBuffer(bytes), {
    failOn: "error",
    limitInputPixels: false,
  }).metadata();

  if (metadata.width !== width || metadata.height !== height) {
    throw new Error(
      `${label}: expected ${width}x${height}, received ${metadata.width ?? "unknown"}x${metadata.height ?? "unknown"}.`,
    );
  }
}

function centeredPadding(canvas: number, content: number) {
  const leading = Math.floor((canvas - content) / 2);
  return [leading, canvas - content - leading] as const;
}

export class SharpRasterizer implements MediaRasterizer {
  async renderMaster(input: RasterMasterInput): Promise<Uint8Array> {
    await assertDimensions(input.source, input.width, input.height, "Template master");

    const bytes = await sharp(sourceBuffer(input.source), {
      failOn: "error",
      limitInputPixels: false,
    })
      .composite([{ input: Buffer.from(input.overlaySvg), top: 0, left: 0 }])
      .png({
        compressionLevel: 9,
        progressive: false,
        palette: false,
      })
      .toBuffer();

    return new Uint8Array(bytes);
  }

  async renderDerivative(input: RasterDerivativeInput): Promise<Uint8Array> {
    const source = sourceBuffer(input.master);
    const metadata = await sharp(source, {
      failOn: "error",
      limitInputPixels: false,
    }).metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error("Rendered master has no readable dimensions.");
    }

    // Never enlarge raster content. Purpose-specific canvases may be larger, but
    // the garment pixels remain at or below the source resolution and are padded.
    const scale = Math.min(
      input.width / metadata.width,
      input.height / metadata.height,
      1,
    );
    const renderedWidth = Math.max(1, Math.round(metadata.width * scale));
    const renderedHeight = Math.max(1, Math.round(metadata.height * scale));
    const [left, right] = centeredPadding(input.width, renderedWidth);
    const [top, bottom] = centeredPadding(input.height, renderedHeight);

    let pipeline = sharp(source, {
      failOn: "error",
      limitInputPixels: false,
    })
      .flatten({ background: input.background })
      .resize(renderedWidth, renderedHeight, {
        fit: "fill",
        kernel: sharp.kernel.lanczos3,
      })
      .extend({
        top,
        bottom,
        left,
        right,
        background: input.background,
      });

    pipeline = input.format === "avif"
      ? pipeline.avif({ quality: input.quality, effort: 6 })
      : pipeline.webp({
          quality: input.quality,
          effort: 6,
          smartSubsample: true,
        });

    const bytes = await pipeline.toBuffer();
    return new Uint8Array(bytes);
  }
}

export function createSharpRasterizer(): MediaRasterizer {
  return new SharpRasterizer();
}
