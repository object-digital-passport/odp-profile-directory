#!/usr/bin/env node
// Re-reads every machine-checkable row against the organization's own /.well-known/odp.json
// and updates its status.
//
// The rule this file exists to enforce: a warning is raised only when something CHANGED.
// A site that fails to load, a catch-all page that answers 200 with HTML, a row the bot has
// never been able to read — none of those are evidence of anything, and none of them may
// turn into a red flag. Only an endpoint that still answers correctly, and no longer lists
// the profile it used to list, is a deliberate act worth reporting.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { readDirectory, writeDirectory } from "./csv.mjs";

const toolsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(toolsDir, "..");
const isV07 = process.argv.includes("--v0.7");
const config = JSON.parse(readFileSync(join(toolsDir, isV07 ? "config-v0.7.json" : "config.json"), "utf8"));
const csvPath = join(repoRoot, config.csvFile);
const statePath = join(toolsDir, "state", isV07 ? "recheck-state-v0.7.json" : "recheck-state.json");
const dryRun = process.argv.includes("--dry-run");
const only = process.argv.find((a) => a.startsWith("--only="))?.slice("--only=".length);

const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {};
const entries = readDirectory(csvPath);
const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

/** OK, MISSING (endpoint fine, profile absent), or UNREADABLE (nothing conclusive). */
async function probe(entry) {
  const url = `https://${entry.evidenceHost}/.well-known/odp.json`;
  let res;
  try {
    res = await fetch(url, {
      redirect: "error",
      headers: { accept: "application/json", "user-agent": "odp-profile-directory recheck" },
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    return { kind: "UNREADABLE", detail: `request failed: ${err.message}` };
  }
  if (!res.ok) return { kind: "UNREADABLE", detail: `HTTP ${res.status}` };

  if (!/^application\/json(?:\s*;|\s*$)/i.test(res.headers.get("content-type") ?? "")) return { kind: "UNREADABLE", detail: "response is not application/json" };
  let doc;
  try {
    const reader = res.body?.getReader();
    if (!reader) return { kind: "UNREADABLE", detail: "empty response" };
    const chunks = []; let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1048576) { await reader.cancel(); return { kind: "UNREADABLE", detail: "response too large" }; }
      chunks.push(value);
    }
    const body = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    doc = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    // A single-page app answers 200 with HTML for every path. That is a site that does not
    // publish the endpoint, not a site that withdrew a profile.
    return { kind: "UNREADABLE", detail: "response is not JSON" };
  }
  if (doc?.odp !== 1 || !Array.isArray(doc.profiles)) return { kind: "UNREADABLE", detail: "unsupported format or no profiles array" };

  const wanted = config.registryAddress.toLowerCase();
  const listed = doc.profiles.some((p) => {
    const registry = (p.registry ?? doc.registry ?? "").toLowerCase();
    const chainId = p.chainId ?? doc.chainId;
    return p.profileId === entry.profileId && registry === wanted && Number(chainId) === config.chainId;
  });
  return listed
    ? { kind: "OK" }
    : { kind: "MISSING", detail: `endpoint served, ${entry.profileId} not listed for registry ${config.registryAddress}` };
}

let changed = 0;
for (const entry of entries) {
  if (only && entry.profileId !== only) continue;
  if (entry.checkMethod !== "auto") continue;
  if (entry.status === "withdrawn") continue;

  const s = (state[entry.profileId] ??= { consecutiveFailures: 0, everFound: false });
  const before = entry.status;
  const result = await probe(entry);
  entry.lastCheckedAt = now;

  if (result.kind === "OK") {
    s.consecutiveFailures = 0;
    s.everFound = true;
    entry.status = "active";
  } else if (result.kind === "MISSING" && s.everFound) {
    // The only path to a warning.
    s.consecutiveFailures = 0;
    entry.status = "removed";
  } else {
    s.consecutiveFailures += 1;
    if (s.consecutiveFailures >= config.unreachableAfterConsecutiveFailures && entry.status !== "removed") {
      entry.status = "unreachable";
    }
  }
  s.lastResult = result.kind;
  s.lastDetail = result.detail ?? "";
  s.lastCheckedAt = now;

  const note = result.detail ? ` (${result.detail})` : "";
  if (entry.status !== before) {
    changed += 1;
    console.log(`${entry.profileId}: ${before} -> ${entry.status}${note}`);
  } else {
    console.log(`${entry.profileId}: ${entry.status}${note}`);
  }
}

// A manual row cannot be re-read by anything but a person; say so when the promise expires.
const staleBefore = Date.now() - config.manualEntryStaleAfterDays * 86400000;
for (const entry of entries) {
  if (entry.checkMethod !== "manual" || entry.status === "withdrawn") continue;
  if (entry.lastVerifiedAt && Date.parse(`${entry.lastVerifiedAt}T00:00:00Z`) < staleBefore) {
    console.log(`${entry.profileId}: manual check from ${entry.lastVerifiedAt} is older than ${config.manualEntryStaleAfterDays} days — needs a human`);
  }
}

if (dryRun) {
  console.log(`recheck: dry run, nothing written (${changed} status change(s) would apply)`);
} else {
  writeDirectory(csvPath, entries);
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  console.log(`recheck: ${entries.length} row(s) processed, ${changed} status change(s)`);
}
