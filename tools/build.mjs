#!/usr/bin/env node
// Builds directory.json from the CSV. Applications should read this file: it carries the
// registry the profile IDs belong to, which a bare profile ID does not.
//
// The output is deterministic — `generatedAt` is the newest timestamp in the data, not the
// build clock — so CI can rebuild it and fail on any difference.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { readDirectory } from "./csv.mjs";

const toolsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(toolsDir, "..");
const config = JSON.parse(readFileSync(join(toolsDir, "config.json"), "utf8"));
const entries = readDirectory(join(repoRoot, config.csvFile));

const instants = [];
for (const e of entries) {
  if (e.lastCheckedAt) instants.push(e.lastCheckedAt);
  if (e.lastVerifiedAt) instants.push(`${e.lastVerifiedAt}T00:00:00Z`);
  instants.push(`${e.addedAt}T00:00:00Z`);
}
instants.sort();

const out = {
  formatVersion: config.formatVersion,
  specLine: config.specLine,
  chainId: config.chainId,
  network: config.network,
  registryAddress: config.registryAddress,
  source: config.csvFile,
  generatedAt: instants[instants.length - 1] ?? null,
  rowCount: entries.length,
  curation: "Rows are selected by the maintainer of this repository. Absence means nothing; presence is not a guarantee.",
  entries,
};

const target = join(repoRoot, "directory.json");
const next = `${JSON.stringify(out, null, 2)}\n`;
if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(target, "utf8");
  } catch {
    /* not built yet */
  }
  if (current !== next) {
    console.error("build --check: directory.json is out of date — run `npm run build` and commit the result");
    process.exit(1);
  }
  console.log("build --check: directory.json matches the CSV");
} else {
  writeFileSync(target, next, "utf8");
  console.log(`build: directory.json written (${entries.length} entries, data as of ${out.generatedAt})`);
}
