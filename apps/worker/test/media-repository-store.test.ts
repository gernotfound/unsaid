import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  RepositoryMediaObjectStore,
  repositoryPublicMediaUrlForStorageKey,
} from "../src/media/repository-store";

function digest(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

test("repository media store separates private masters from public generated assets", async () => {
  const root = await mkdtemp(join(tmpdir(), "unsaid-repo-media-"));
  try {
    const store = new RepositoryMediaObjectStore(root);
    const master = new Uint8Array([1, 2, 3]);
    const generated = new Uint8Array([4, 5, 6]);

    await store.putImmutable({
      storageKey: "masters/templates/t/v1/front.webp",
      bytes: master,
      mimeType: "image/webp",
      sha256: digest(master),
    });
    await store.putImmutable({
      storageKey: "generated/products/P/r1/front/card.webp",
      bytes: generated,
      mimeType: "image/webp",
      sha256: digest(generated),
    });

    assert.deepEqual(
      new Uint8Array(await readFile(join(root, "data/media/masters/templates/t/v1/front.webp"))),
      master,
    );
    assert.deepEqual(
      new Uint8Array(await readFile(join(root, "apps/web/public/generated/products/P/r1/front/card.webp"))),
      generated,
    );
    assert.equal(
      repositoryPublicMediaUrlForStorageKey("generated/products/P/r1/front/card.webp"),
      "/generated/products/P/r1/front/card.webp",
    );
    assert.throws(
      () => repositoryPublicMediaUrlForStorageKey("masters/templates/t/v1/front.webp"),
      /private media key/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("repository media store rejects different bytes at an immutable key", async () => {
  const root = await mkdtemp(join(tmpdir(), "unsaid-repo-media-"));
  try {
    const store = new RepositoryMediaObjectStore(root);
    const first = new Uint8Array([7, 8, 9]);
    await store.putImmutable({
      storageKey: "generated/products/P/r1/front/card.webp",
      bytes: first,
      mimeType: "image/webp",
      sha256: digest(first),
    });

    const second = new Uint8Array([9, 8, 7]);
    await assert.rejects(
      () =>
        store.putImmutable({
          storageKey: "generated/products/P/r1/front/card.webp",
          bytes: second,
          mimeType: "image/webp",
          sha256: digest(second),
        }),
      /Immutable repository media collision/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
