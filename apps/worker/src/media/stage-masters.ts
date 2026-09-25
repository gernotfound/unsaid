import { resolve } from "node:path";
import { FileSystemMasterObjectStore } from "./filesystem-store";
import { MASTER_INTAKE, ingestPreparedMasters } from "./intake";

const masterDirectory = process.argv[2] ?? process.env.UNSAID_MEDIA_MASTER_DIR;
const outputDirectory = process.argv[3] ?? process.env.UNSAID_MEDIA_STAGE_DIR ?? ".media-stage";

if (!masterDirectory) {
  throw new Error(
    "Missing master directory. Usage: pnpm media:stage-masters -- <master-directory> [stage-directory] or set UNSAID_MEDIA_MASTER_DIR.",
  );
}

const absoluteMasterDirectory = resolve(masterDirectory);
const absoluteOutputDirectory = resolve(outputDirectory);
const store = new FileSystemMasterObjectStore(absoluteOutputDirectory);
const ingested = await ingestPreparedMasters(absoluteMasterDirectory, store);

console.log(`Verified and staged ${ingested.length} clean masters for ${MASTER_INTAKE.templateId}@${MASTER_INTAKE.templateVersion}.`);
console.log(`Staging root: ${absoluteOutputDirectory}`);
console.log(JSON.stringify({
  templateId: MASTER_INTAKE.templateId,
  templateVersion: MASTER_INTAKE.templateVersion,
  views: Object.fromEntries(ingested.map((item) => [item.view, {
    status: "ready",
    width: item.width,
    height: item.height,
    mimeType: item.mimeType,
    storageKey: item.storageKey,
    sha256: item.sha256,
  }])),
}, null, 2));
