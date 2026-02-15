import {
  parseArgs,
  readAcademyContent,
  validateAcademyContent,
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
  const { absolutePath, content } = readAcademyContent(args.file);
  const { errors, warnings } = validateAcademyContent(content);

  console.log(`[training:validate] File: ${absolutePath}`);

  printList("Warnings", warnings);
  if (errors.length > 0) {
    printList("Errors", errors);
    console.error(`\n[training:validate] Failed with ${errors.length} error(s).`);
    process.exit(1);
  }

  console.log("\n[training:validate] Passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
