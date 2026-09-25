import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import masterIntakeSeed from "../../../../data/media/master-intake.json";

export type PreparedMasterView = "front" | "back";

export interface PreparedMasterDefinition {
  fileName: string;
  width: number;
  height: number;
  mimeType: string;
  bytes: number;
  sha256: string;
}

export interface MasterIntakeManifest {
  schemaVersion: 1;
  templateId: string;
  templateVersion: number;
  createdAt: string;
  status: "prepared-not-ingested" | "ingested";
  provenance: string;
  ingestedAt?: string;
  storageBackend?: "repository-static";
  views: Record<PreparedMasterView, PreparedMasterDefinition>;
}

export interface VerifiedPreparedMaster {
  view: PreparedMasterView;
  absolutePath: string;
  definition: PreparedMasterDefinition;
  bytes: Uint8Array;
}

export interface MasterObjectStore {
  /**
   * Persist bytes exactly once at an immutable key. Implementations must reject
   * attempts to replace a different object at the same key.
   */
  putImmutable(input: {
    storageKey: string;
    bytes: Uint8Array;
    mimeType: string;
    sha256: string;
  }): Promise<void>;
}

export interface IngestedMasterView {
  view: PreparedMasterView;
  storageKey: string;
  width: number;
  height: number;
  mimeType: string;
  sha256: string;
}

export const MASTER_INTAKE = masterIntakeSeed as unknown as MasterIntakeManifest;

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

function extensionFor(definition: PreparedMasterDefinition) {
  const extension = extname(definition.fileName).replace(/^\./, "").toLocaleLowerCase();
  if (!extension) throw new Error(`Prepared master ${definition.fileName} has no extension.`);
  return extension;
}

export function verifyPreparedMasterBytes(
  definition: PreparedMasterDefinition,
  bytes: Uint8Array,
  label = definition.fileName,
) {
  const errors: string[] = [];
  if (bytes.byteLength !== definition.bytes) {
    errors.push(`${label}: byte length ${bytes.byteLength} does not match intake ${definition.bytes}.`);
  }
  const digest = sha256(bytes);
  if (digest !== definition.sha256.toLocaleLowerCase()) {
    errors.push(`${label}: sha256 ${digest} does not match intake ${definition.sha256}.`);
  }
  return errors;
}

export async function verifyPreparedMaster(
  masterDirectory: string,
  view: PreparedMasterView,
  intake: MasterIntakeManifest = MASTER_INTAKE,
): Promise<VerifiedPreparedMaster> {
  const definition = intake.views[view];
  const absolutePath = resolve(masterDirectory, definition.fileName);
  const bytes = new Uint8Array(await readFile(absolutePath));
  const errors = verifyPreparedMasterBytes(definition, bytes, `${intake.templateId}@${intake.templateVersion}.${view}`);
  if (errors.length) throw new Error(errors.join(" "));
  return { view, absolutePath, definition, bytes };
}

export async function verifyPreparedMasters(
  masterDirectory: string,
  intake: MasterIntakeManifest = MASTER_INTAKE,
) {
  if (intake.schemaVersion !== 1) throw new Error("Unsupported master intake schema version.");
  return Promise.all([
    verifyPreparedMaster(masterDirectory, "front", intake),
    verifyPreparedMaster(masterDirectory, "back", intake),
  ]);
}

function immutableMasterKey(intake: MasterIntakeManifest, master: VerifiedPreparedMaster) {
  const extension = extensionFor(master.definition);
  return `masters/templates/${intake.templateId}/v${intake.templateVersion}/${master.view}-${master.definition.sha256.slice(0, 16)}.${extension}`;
}

/**
 * Ingests the exact hash-locked clean masters. This function deliberately does
 * not mutate templates.json: promoting a template to `ready` remains a reviewed
 * repository change after the exact bytes have been committed to the canonical repository media path.
 */
export async function ingestPreparedMasters(
  masterDirectory: string,
  store: MasterObjectStore,
  intake: MasterIntakeManifest = MASTER_INTAKE,
): Promise<readonly IngestedMasterView[]> {
  const masters = await verifyPreparedMasters(masterDirectory, intake);
  const ingested: IngestedMasterView[] = [];

  for (const master of masters) {
    const storageKey = immutableMasterKey(intake, master);
    await store.putImmutable({
      storageKey,
      bytes: master.bytes,
      mimeType: master.definition.mimeType,
      sha256: master.definition.sha256,
    });
    ingested.push({
      view: master.view,
      storageKey,
      width: master.definition.width,
      height: master.definition.height,
      mimeType: master.definition.mimeType,
      sha256: master.definition.sha256,
    });
  }

  return ingested;
}
