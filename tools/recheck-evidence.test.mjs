import test from "node:test";
import assert from "node:assert/strict";
import { classifyEvidence, stateForEvidence } from "./recheck-evidence.mjs";

const config = { chainId: 137, registryAddress: "0xabc" };
const entry = { profileId: "B-123", evidenceHost: "brand.example" };
const doc = { odp: 1, chainId: 137, registry: "0xabc", profiles: [{ profileId: "B-123" }] };

test("only valid matching evidence is found", () => {
  assert.equal(classifyEvidence(doc, entry, config), "OK");
  assert.equal(classifyEvidence({ ...doc, profiles: [] }, entry, config), "MISSING");
  assert.equal(classifyEvidence({ ...doc, profiles: [null] }, entry, config), "UNREADABLE");
  assert.equal(classifyEvidence({ ...doc, registry: 42 }, entry, config), "UNREADABLE");
});

test("success history never follows a changed or unknown evidence source", () => {
  const saved = { source: "137:0xabc:brand.example", everFound: true, consecutiveFailures: 0 };
  assert.equal(stateForEvidence(saved, entry, config).everFound, true);
  assert.equal(stateForEvidence(saved, { ...entry, evidenceHost: "other.example" }, config).everFound, false);
  assert.equal(stateForEvidence({ everFound: true }, entry, config).everFound, false);
  assert.equal(stateForEvidence(saved, entry, { ...config, chainId: 1 }).everFound, false);
});
