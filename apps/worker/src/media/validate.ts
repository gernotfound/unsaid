import { validateMediaConfiguration } from "./configuration";

const result = validateMediaConfiguration();
for (const warning of result.warnings) console.warn(`MEDIA WARNING: ${warning}`);
if (result.errors.length) {
  for (const error of result.errors) console.error(`MEDIA ERROR: ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Media configuration valid (${result.warnings.length} warning(s)).`);
}
