import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { format } from "prettier";
import { buildOpenApiDocument } from "./openapi";

const outputUrl = new URL("../openapi.json", import.meta.url);
const generated = await format(JSON.stringify(await buildOpenApiDocument()), {
  parser: "json",
});

if (process.argv.includes("--check")) {
  const current = await readFile(outputUrl, "utf8").catch(() => "");
  if (current !== generated) {
    throw new Error(
      `OpenAPI snapshot is stale. Run "pnpm openapi:generate" in ${fileURLToPath(new URL("..", import.meta.url))}.`,
    );
  }
} else {
  await writeFile(outputUrl, generated);
  console.log(`Wrote ${fileURLToPath(outputUrl)}`);
}
