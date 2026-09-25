import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { FileSystemMasterObjectStore } from "../src/media/filesystem-store";
import { verifyPreparedMasterBytes, type PreparedMasterDefinition } from "../src/media/intake";

const abcDefinition: PreparedMasterDefinition = {
  fileName: "front.webp",
  width: 1,
  height: 1,
  mimeType: "image/webp",
  bytes: 3,
  sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
};

test("prepared masters are accepted only when byte length and sha256 match intake", () => {
  assert.deepEqual(verifyPreparedMasterBytes(abcDefinition, Buffer.from("abc")), []);

  const errors = verifyPreparedMasterBytes(abcDefinition, Buffer.from("abd"));
  assert.equal(errors.length, 1);
  assert.match(errors[0] ?? "", /sha256/);
});

test("filesystem media storage is idempotent for identical bytes and rejects immutable collisions", async () => {
  const root = await mkdtemp(join(tmpdir(), "unsaid-media-"));
  try {
    const store = new FileSystemMasterObjectStore(root);
    const key = "masters/templates/white-oversize-v1/v1/front-ba7816bf8f01cfea.webp";
    await store.putImmutable({
      storageKey: key,
      bytes: Buffer.from("abc"),
      mimeType: "image/webp",
      sha256: abcDefinition.sha256,
    });
    await store.putImmutable({
      storageKey: key,
      bytes: Buffer.from("abc"),
      mimeType: "image/webp",
      sha256: abcDefinition.sha256,
    });
    assert.equal((await readFile(join(root, key))).toString("utf8"), "abc");
    assert.equal(Buffer.from(await store.get(key)).toString("utf8"), "abc");

    await assert.rejects(
      store.putImmutable({
        storageKey: key,
        bytes: Buffer.from("abd"),
        mimeType: "image/webp",
        sha256: "a52d159f262b2c6ddb724a61840befc36eb30c88877a4030b65cbe86298449c9",
      }),
      /Immutable media collision/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
