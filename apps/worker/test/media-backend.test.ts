import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { createManagedMediaBackend, type MediaBinaryStorePut } from "../src/media/backend";
import type { ProductSideRenderPlan } from "../src/media/plan";

const sourceBytes = new Uint8Array([9, 8, 7]);
const sourceSha256 = createHash("sha256").update(sourceBytes).digest("hex");

const plan: ProductSideRenderPlan = {
  productId: "UNS-0001",
  view: "front",
  templateStorageKey: "masters/template.webp",
  templateSha256: sourceSha256,
  templateWidth: 1536,
  templateHeight: 2048,
  background: "#d2d2d2",
  overlaySvg: "<svg />",
  masterStorageKey: "generated/products/UNS-0001/r1/front/master.png",
  derivatives: [
    {
      kind: "detail",
      width: 1600,
      height: 2000,
      format: "webp",
      quality: 92,
      storageKey: "generated/products/UNS-0001/r1/front/detail.webp",
    },
    {
      kind: "card",
      width: 960,
      height: 1200,
      format: "webp",
      quality: 90,
      storageKey: "generated/products/UNS-0001/r1/front/card.webp",
    },
  ],
};

test("managed backend separates rasterization from immutable object storage", async () => {
  const writes: MediaBinaryStorePut[] = [];
  const master = new Uint8Array([1, 2, 3, 4]);
  const backend = createManagedMediaBackend({
    store: {
      async get(key) {
        assert.equal(key, plan.templateStorageKey);
        return sourceBytes;
      },
      async putImmutable(input) {
        writes.push(input);
      },
    },
    rasterizer: {
      async renderMaster(input) {
        assert.equal(input.overlaySvg, plan.overlaySvg);
        assert.deepEqual(Array.from(input.source), [9, 8, 7]);
        return master;
      },
      async renderDerivative(input) {
        assert.strictEqual(input.master, master);
        return new Uint8Array([input.width % 251, input.height % 251, input.quality]);
      },
    },
  });

  const result = await backend.renderSide(plan);
  assert.equal(result.master.storageKey, plan.masterStorageKey);
  assert.equal(result.master.mimeType, "image/png");
  assert.equal(result.derivatives.detail?.width, 1600);
  assert.equal(result.derivatives.card?.height, 1200);
  assert.equal(writes.length, 3);
  assert.ok(writes.every((write) => /^[a-f0-9]{64}$/.test(write.sha256)));
  assert.ok(writes.every((write) => write.cacheControl.includes("immutable")));
});

test("managed backend refuses a downloaded template whose sha256 does not match the render plan", async () => {
  let rasterized = false;
  let writes = 0;
  const backend = createManagedMediaBackend({
    store: {
      async get() {
        return new Uint8Array([1, 2, 3]);
      },
      async putImmutable() {
        writes += 1;
      },
    },
    rasterizer: {
      async renderMaster() {
        rasterized = true;
        return new Uint8Array([1]);
      },
      async renderDerivative() {
        return new Uint8Array([1]);
      },
    },
  });

  await assert.rejects(() => backend.renderSide(plan), /template sha256/);
  assert.equal(rasterized, false);
  assert.equal(writes, 0);
});

test("managed backend refuses empty raster outputs before publishing them", async () => {
  const backend = createManagedMediaBackend({
    store: {
      async get() {
        return sourceBytes;
      },
      async putImmutable() {
        throw new Error("should not write");
      },
    },
    rasterizer: {
      async renderMaster() {
        return new Uint8Array();
      },
      async renderDerivative() {
        return new Uint8Array();
      },
    },
  });

  await assert.rejects(() => backend.renderSide(plan), /empty master/);
});
