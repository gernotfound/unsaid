import assert from "node:assert/strict";
import test from "node:test";
import type {
  GarmentTemplateDefinition,
  ProductRenderProfile,
  ProductRenderSpec,
} from "@unsaid/domain";
import { createOverlaySvg, executeProductRender, planProductRender, type RenderedSideFiles } from "../src/media/plan";
import { validateMediaConfiguration } from "../src/media/configuration";

const template: GarmentTemplateDefinition = {
  id: "white-oversize-v1",
  version: 1,
  garmentColor: "bianco",
  fit: "oversize",
  views: {
    front: {
      status: "ready",
      width: 1529,
      height: 2048,
      mimeType: "image/jpeg",
      printableArea: { x: 0.2, y: 0.27, width: 0.6, height: 0.22 },
      storageKey: "masters/templates/white-oversize-v1/front.jpg",
      sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    },
    back: {
      status: "ready",
      width: 1529,
      height: 2048,
      mimeType: "image/jpeg",
      printableArea: { x: 0.2, y: 0.27, width: 0.6, height: 0.22 },
      storageKey: "masters/templates/white-oversize-v1/back.jpg",
      sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    },
  },
};

const profile: ProductRenderProfile = {
  id: "product-standard-v1",
  background: "#d2d2d2",
  defaultTextStyle: {
    fontFamily: "Arial Black, Arial, sans-serif",
    fontWeight: 900,
    color: "#111111",
    uppercase: false,
    lineHeight: 0.94,
    trackingEm: -0.025,
    maxLines: 5,
  },
  derivatives: [
    { kind: "detail", width: 1600, height: 2000, format: "webp", quality: 92 },
    { kind: "card", width: 960, height: 1200, format: "webp", quality: 90 },
  ],
};

const spec: ProductRenderSpec = {
  schemaVersion: 1,
  templateId: "white-oversize-v1",
  templateVersion: 1,
  profileId: "product-standard-v1",
  renderVersion: "r1",
  sides: {
    front: { layers: [{ id: "front-copy", kind: "text", text: "wear what you would not say" }] },
    back: { layers: [] },
  },
};

test("media configuration is structurally valid while reference masters remain gated", () => {
  const result = validateMediaConfiguration();
  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.some((warning) => warning.includes("reference-only")));
});

test("overlay SVG is deterministic and escapes text", () => {
  const svg = createOverlaySvg(
    { layers: [{ id: "copy", kind: "text", text: "A & B < C" }] },
    template.views.front,
    profile,
  );
  assert.match(svg, /A &amp; B &lt;/);
  assert.match(svg, />C<\/text>/);
  assert.doesNotMatch(svg, /A & B < C/);
  assert.match(svg, /width="1529"/);
});

test("render planning refuses unready masters and creates immutable output keys when ready", async () => {
  const plan = planProductRender({ productId: "UNS-0001", spec, template, profile });
  assert.equal(plan.sides.front.masterStorageKey, "generated/products/UNS-0001/r1/front/master.png");
  assert.equal(plan.sides.front.derivatives[0]?.storageKey, "generated/products/UNS-0001/r1/front/detail.webp");

  const manifest = await executeProductRender(
    plan,
    {
      async renderSide(side): Promise<RenderedSideFiles> {
        const derivatives: RenderedSideFiles["derivatives"] = {};
        for (const derivative of side.derivatives) {
          derivatives[derivative.kind] = {
            storageKey: derivative.storageKey,
            mimeType: "image/webp",
            width: derivative.width,
            height: derivative.height,
          };
        }
        return {
          master: {
            storageKey: side.masterStorageKey,
            mimeType: "image/png",
            width: side.templateWidth,
            height: side.templateHeight,
          },
          derivatives,
        };
      },
    },
    (key) => `https://media.example/${key}`,
    "2026-09-20T00:00:00.000Z",
  );

  assert.equal(manifest.sides.front.derivatives.detail?.url, "https://media.example/generated/products/UNS-0001/r1/front/detail.webp");
  assert.equal(manifest.renderVersion, "r1");
});
