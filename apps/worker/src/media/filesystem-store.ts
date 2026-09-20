import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import type { MasterObjectStore } from "./intake";

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

function safeDestination(rootDirectory: string, storageKey: string) {
  const root = resolve(rootDirectory);
  const destination = resolve(root, storageKey);
  const rel = relative(root, destination);
  if (!rel || rel.startsWith("..") || rel.includes("../") || rel.includes("..\\")) {
    throw new Error(`Invalid media storage key: ${storageKey}`);
  }
  return destination;
}

/**
 * Local immutable object-store implementation for development and migration
 * staging. Production storage adapters must preserve the same write-once
 * semantics.
 */
export class FileSystemMasterObjectStore implements MasterObjectStore {
  constructor(private readonly rootDirectory: string) {}

  async putImmutable(input: {
    storageKey: string;
    bytes: Uint8Array;
    mimeType: string;
    sha256: string;
  }) {
    const destination = safeDestination(this.rootDirectory, input.storageKey);
    await mkdir(dirname(destination), { recursive: true });

    try {
      await writeFile(destination, input.bytes, { flag: "wx" });
      return;
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (code !== "EEXIST") throw error;
    }

    const existing = new Uint8Array(await readFile(destination));
    const existingDigest = sha256(existing);
    if (existingDigest !== input.sha256) {
      throw new Error(`Immutable media collision at ${input.storageKey}: existing sha256 ${existingDigest}, expected ${input.sha256}.`);
    }
  }
}
