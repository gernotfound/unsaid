import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import type { MediaBinaryStore } from "./backend";
import type { MasterObjectStore } from "./intake";

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

function safeDestination(rootDirectory: string, storageKey: string) {
  const root = resolve(rootDirectory);
  const destination = resolve(root, storageKey);
  const rel = relative(root, destination);
  if (!rel || rel.startsWith("..") || rel.includes("../") || rel.includes("..\\\\")) {
    throw new Error(`Invalid media storage key: ${storageKey}`);
  }
  return destination;
}

/**
 * Local immutable object-store implementation for development, migration
 * staging and visual QA. Production storage adapters must preserve the same
 * write-once semantics.
 */
export class FileSystemMediaObjectStore implements MasterObjectStore, MediaBinaryStore {
  constructor(private readonly rootDirectory: string) {}

  async get(storageKey: string) {
    return new Uint8Array(await readFile(safeDestination(this.rootDirectory, storageKey)));
  }

  async putImmutable(input: {
    storageKey: string;
    bytes: Uint8Array;
    mimeType: string;
    sha256: string;
    cacheControl?: string;
  }) {
    const actualDigest = sha256(input.bytes);
    if (actualDigest !== input.sha256.toLocaleLowerCase()) {
      throw new Error(
        `Refusing ${input.storageKey}: supplied bytes sha256 ${actualDigest} does not match ${input.sha256}.`,
      );
    }

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
      throw new Error(
        `Immutable media collision at ${input.storageKey}: existing sha256 ${existingDigest}, expected ${input.sha256}.`,
      );
    }
  }
}

/** @deprecated Prefer FileSystemMediaObjectStore for new code. */
export class FileSystemMasterObjectStore extends FileSystemMediaObjectStore {}
