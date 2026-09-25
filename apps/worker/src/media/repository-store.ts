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
  if (!rel || rel.startsWith("..") || rel.includes("../") || rel.includes("..\\\\"))
    throw new Error(`Invalid media storage key: ${storageKey}`);
  return destination;
}

function repositoryDestination(repositoryRoot: string, storageKey: string) {
  if (storageKey.startsWith("masters/")) {
    return safeDestination(resolve(repositoryRoot, "data/media"), storageKey);
  }
  if (storageKey.startsWith("generated/")) {
    return safeDestination(resolve(repositoryRoot, "apps/web/public"), storageKey);
  }
  throw new Error(`Unsupported repository media key: ${storageKey}`);
}

export function repositoryPublicMediaUrlForStorageKey(storageKey: string) {
  if (!storageKey.startsWith("generated/")) {
    throw new Error(`Refusing to expose private media key: ${storageKey}`);
  }
  return `/${storageKey}`;
}

/**
 * Production media backend for the Spark/Hobby deployment.
 *
 * - masters/** -> data/media/masters/** (not web-public)
 * - generated/** -> apps/web/public/generated/** (served by Vercel)
 *
 * Writes are immutable: the same key can be reused only for identical bytes.
 */
export class RepositoryMediaObjectStore implements MasterObjectStore, MediaBinaryStore {
  constructor(private readonly repositoryRoot: string) {}

  async get(storageKey: string) {
    return new Uint8Array(await readFile(repositoryDestination(this.repositoryRoot, storageKey)));
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

    const destination = repositoryDestination(this.repositoryRoot, input.storageKey);
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
    if (existingDigest !== actualDigest) {
      throw new Error(
        `Immutable repository media collision at ${input.storageKey}: existing sha256 ${existingDigest}, expected ${actualDigest}.`,
      );
    }
  }
}
