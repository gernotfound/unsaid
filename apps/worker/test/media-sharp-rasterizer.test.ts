import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { createSharpRasterizer } from "../src/media/sharp-rasterizer";

async function sourceMaster() {
  return new Uint8Array(
    await sharp({
      create: {
        width: 40,
        height: 60,
        channels: 4,
        background: { r: 240, g: 240, b: 240, alpha: 1 },
      },
    })
      .webp({ quality: 95 })
      .toBuffer(),
  );
}

test("SharpRasterizer composites an SVG overlay and emits a lossless-size PNG master", async () => {
  const rasterizer = createSharpRasterizer();
  const source = await sourceMaster();
  const master = await rasterizer.renderMaster({
    source,
    width: 40,
    height: 60,
    overlaySvg:
      '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="60"><rect x="10" y="20" width="20" height="10" fill="#111111"/></svg>',
  });

  const metadata = await sharp(Buffer.from(master)).metadata();
  assert.equal(metadata.format, "png");
  assert.equal(metadata.width, 40);
  assert.equal(metadata.height, 60);
});

test("SharpRasterizer produces an exact derivative canvas without enlarging source pixels", async () => {
  const rasterizer = createSharpRasterizer();
  const source = await sourceMaster();
  const master = await rasterizer.renderMaster({
    source,
    width: 40,
    height: 60,
    overlaySvg: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="60"/>',
  });

  const derivative = await rasterizer.renderDerivative({
    master,
    width: 80,
    height: 80,
    format: "webp",
    quality: 90,
    background: "#d2d2d2",
  });

  const metadata = await sharp(Buffer.from(derivative)).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 80);
  assert.equal(metadata.height, 80);
});

test("SharpRasterizer fails closed when master dimensions do not match template metadata", async () => {
  const rasterizer = createSharpRasterizer();
  const source = await sourceMaster();

  await assert.rejects(
    () =>
      rasterizer.renderMaster({
        source,
        width: 41,
        height: 60,
        overlaySvg: '<svg xmlns="http://www.w3.org/2000/svg" width="41" height="60"/>',
      }),
    /expected 41x60/,
  );
});
