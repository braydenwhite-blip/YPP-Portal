import {
  parseArgs,
  readAcademyContent,
  validateAcademyContent,
  loadCurriculumRegistry,
  loadBeatSchemas,
  validateCurriculumRegistry,
} from "./training-academy-content-utils.mjs";

function printList(title, values) {
  if (values.length === 0) return;
  console.log(`\n${title}:`);
  for (const value of values) {
    console.log(`- ${value}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // ── Pass 1: Legacy JSON content ────────────────────────────────────────────
  const { absolutePath, content } = readAcademyContent(args.file);
  const { errors: jsonErrors, warnings: jsonWarnings } = validateAcademyContent(content);

  console.log(`[training:validate] File: ${absolutePath}`);

  printList("Warnings", jsonWarnings);
  if (jsonErrors.length > 0) {
    printList("Errors", jsonErrors);
    console.error(`\n[training:validate] JSON content failed with ${jsonErrors.length} error(s).`);
    process.exit(1);
  }

  console.log("\n[training:validate] JSON content: Passed.");

  // ── Pass 2: Curriculum registry (TypeScript sources) ───────────────────────
  console.log("\n[training:validate] Curriculum registry:");

  let curriculumList;
  try {
    const { list } = await loadCurriculumRegistry();
    curriculumList = list;
  } catch (err) {
    console.error(`[training:validate] Failed to load curriculum registry: ${err.message}`);
    process.exit(1);
  }

  let beatConfigSchemas;
  try {
    const schemas = await loadBeatSchemas();
    beatConfigSchemas = schemas.beatConfigSchemas;
  } catch (err) {
    console.error(`[training:validate] Failed to load beat schemas: ${err.message}`);
    process.exit(1);
  }

  const { errors: currErrors, warnings: currWarnings } = validateCurriculumRegistry(
    curriculumList,
    { beatConfigSchemas }
  );

  printList("Curriculum Warnings", currWarnings);
  if (currErrors.length > 0) {
    printList("Curriculum Errors", currErrors);
    console.error(
      `\n[training:validate] Curriculum registry failed with ${currErrors.length} error(s).`
    );
    process.exit(1);
  }

  console.log(
    `[training:validate] Curriculum registry: Passed (${curriculumList.length} curriculum(a) validated).`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
