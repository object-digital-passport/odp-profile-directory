#!/usr/bin/env node
// Every rule the format states, checked. Runs on every pull request, because a directory
// that people are asked to trust cannot be the one file nobody checks.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import {
  COLUMNS,
  PROFILE_TYPES,
  EVIDENCE_KINDS,
  CHECK_METHODS,
  STATUSES,
  PROFILE_ID,
  DATE,
  INSTANT,
  readDirectory,
} from "./csv.mjs";

const toolsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(toolsDir, "..");
const isV07 = process.argv.includes("--v0.7");
const config = JSON.parse(readFileSync(join(toolsDir, isV07 ? "config-v0.7.json" : "config.json"), "utf8"));
const csvPath = join(repoRoot, config.csvFile);
const raw = readFileSync(csvPath, "utf8");
const problems = [];
const fail = (line, msg) => problems.push(`${config.csvFile}:${line} ${msg}`);

// --- file-level rules ------------------------------------------------------------
if (raw.includes("\r")) problems.push(`${config.csvFile}: contains CR — line endings must be LF`);
if (raw.charCodeAt(0) === 0xfeff) problems.push(`${config.csvFile}: starts with a BOM — must be UTF-8 without BOM`);
if (!raw.endsWith("\n")) problems.push(`${config.csvFile}: must end with a newline`);

// The filename carries the registry generation; the address it maps to lives in config.json.
if (!/^odp-directory-v\d+\.\d+\.csv$/.test(config.csvFile)) {
  problems.push(`tools/config.json: csvFile "${config.csvFile}" does not match odp-directory-v<MAJOR>.<MINOR>.csv`);
}

const entries = readDirectory(csvPath);
const seen = new Map();

entries.forEach((e, i) => {
  const line = i + 2;

  if (!PROFILE_ID.test(e.profileId)) fail(line, `profileId "${e.profileId}" is not T-NNN-NNN-NNN-NNN`);
  if (seen.has(e.profileId)) fail(line, `profileId "${e.profileId}" already appears on line ${seen.get(e.profileId)}`);
  else seen.set(e.profileId, line);

  if (!PROFILE_TYPES.includes(e.profileType)) fail(line, `profileType "${e.profileType}" is not one of ${PROFILE_TYPES}`);
  if (e.profileId[0] !== e.profileType) fail(line, `profileType "${e.profileType}" contradicts the profileId prefix "${e.profileId[0]}"`);

  if (!EVIDENCE_KINDS.includes(e.evidenceKind)) fail(line, `evidenceKind "${e.evidenceKind}" is not one of ${EVIDENCE_KINDS}`);
  if (!CHECK_METHODS.includes(e.checkMethod)) fail(line, `checkMethod "${e.checkMethod}" is not one of ${CHECK_METHODS}`);
  if (!STATUSES.includes(e.status)) fail(line, `status "${e.status}" is not one of ${STATUSES}`);

  let host = null;
  try {
    const u = new URL(e.evidenceUrl);
    if (u.protocol !== "https:") fail(line, `evidenceUrl must be https`);
    host = u.host;
  } catch {
    fail(line, `evidenceUrl "${e.evidenceUrl}" is not a URL`);
  }
  if (host && e.evidenceHost !== host) fail(line, `evidenceHost "${e.evidenceHost}" is not the host of evidenceUrl ("${host}")`);

  // A social profile is served by a platform, never by the organization's own server —
  // so it can never be the thing the bot reads. Saying otherwise would let a row claim
  // machine verification it never had.
  if (e.evidenceKind === "social" && e.checkMethod === "auto") {
    fail(line, `social evidence cannot be checkMethod=auto — no platform serves /.well-known/odp.json for its users`);
  }

  if (e.lastCheckedAt !== "" && !INSTANT.test(e.lastCheckedAt)) fail(line, `lastCheckedAt "${e.lastCheckedAt}" is not YYYY-MM-DDThh:mm:ssZ`);
  if (e.lastVerifiedAt !== "" && !DATE.test(e.lastVerifiedAt)) fail(line, `lastVerifiedAt "${e.lastVerifiedAt}" is not YYYY-MM-DD`);
  if (!DATE.test(e.addedAt)) fail(line, `addedAt "${e.addedAt}" is not YYYY-MM-DD`);

  if (e.checkMethod === "auto" && e.lastCheckedAt === "" && e.status !== "withdrawn") {
    fail(line, `checkMethod=auto with no lastCheckedAt — the bot has never seen this row`);
  }
  // A human-checked row is only as good as the proof that the human saw what they claim.
  if (e.checkMethod === "manual") {
    if (e.lastVerifiedAt === "") fail(line, `checkMethod=manual requires lastVerifiedAt`);
    if (e.archiveUrl === "") fail(line, `checkMethod=manual requires archiveUrl — a snapshot of the evidence as it was seen`);
  }
  if (e.archiveUrl !== "") {
    try {
      if (new URL(e.archiveUrl).protocol !== "https:") fail(line, `archiveUrl must be https`);
    } catch {
      fail(line, `archiveUrl "${e.archiveUrl}" is not a URL`);
    }
  }
  if (e.status === "unverifiable" && e.checkMethod !== "manual") {
    fail(line, `status=unverifiable only applies to rows the bot cannot read (checkMethod=manual)`);
  }
});

const sorted = [...entries].map((e) => e.profileId).sort();
entries.forEach((e, i) => {
  if (e.profileId !== sorted[i]) {
    fail(i + 2, `rows must be sorted by profileId ("${sorted[i]}" expected here) — sorted order keeps pull-request diffs readable`);
  }
});

if (problems.length > 0) {
  console.error(`validate: ${problems.length} problem(s)\n`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`validate: ${entries.length} row(s) OK, ${COLUMNS.length} columns`);
