import { createHash } from "node:crypto";
import { getAdminStorageBucket, getAdminStorageBucketName } from "./firebase";

export interface ImmutableStorageObjectInput {
  storageKey: string;
  bytes: Uint8Array;
  mimeType: string;
  sha256: string;
  cacheControl?: string;
}

function digest(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

function errorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  const value = Number((error as { code?: unknown }).code);
  return Number.isFinite(value) ? value : undefined;
}

export async function putImmutableStorageObject(input: ImmutableStorageObjectInput) {
  const actualDigest = digest(input.bytes);
  if (actualDigest !== input.sha256.toLocaleLowerCase()) {
    throw new Error(`Refusing ${input.storageKey}: supplied bytes sha256 ${actualDigest} does not match ${input.sha256}.`);
  }

  const file = getAdminStorageBucket().file(input.storageKey);
  try {
    await file.save(Buffer.from(input.bytes), {
      resumable: false,
      validation: "crc32c",
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: {
        contentType: input.mimeType,
        cacheControl: input.cacheControl ?? "public,max-age=31536000,immutable",
        metadata: {
          sha256: actualDigest,
          immutable: "true",
        },
      },
    });
    return;
  } catch (error) {
    const code = errorCode(error);
    if (code !== 409 && code !== 412) throw error;
  }

  const [existingBytes] = await file.download();
  const existingDigest = digest(existingBytes);
  if (existingDigest !== actualDigest) {
    throw new Error(
      `Immutable Firebase Storage collision at ${input.storageKey}: existing sha256 ${existingDigest}, expected ${actualDigest}.`,
    );
  }
}

export async function downloadStorageObject(storageKey: string) {
  const [bytes] = await getAdminStorageBucket().file(storageKey).download();
  return new Uint8Array(bytes);
}

export function publicMediaUrlForStorageKey(storageKey: string) {
  const bucket = encodeURIComponent(getAdminStorageBucketName());
  const object = encodeURIComponent(storageKey);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${object}?alt=media`;
}
