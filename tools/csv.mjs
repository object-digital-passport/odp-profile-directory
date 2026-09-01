// The one place that knows what a directory row looks like. Every other script imports
// from here, so the column order lives in exactly one file.

import { readFileSync, writeFileSync } from "node:fs";

export const COLUMNS = [
  "profileId",
  "profileType",
  "displayName",
  "evidenceKind",
  "evidenceUrl",
  "evidenceHost",
  "checkMethod",
  "status",
  "lastCheckedAt",
  "lastVerifiedAt",
  "archiveUrl",
  "addedAt",
];

export const PROFILE_TYPES = ["C", "B", "P", "M"];
export const EVIDENCE_KINDS = ["website", "social"];
export const CHECK_METHODS = ["auto", "manual"];
export const STATUSES = ["active", "unreachable", "unverifiable", "removed", "withdrawn"];

export const PROFILE_ID = /^[CBPM]-\d{3}-\d{3}-\d{3}-\d{3}$/;
export const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

/** RFC 4180: fields may be quoted, "" is an escaped quote inside a quoted field. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field === "") {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch === "\r") {
      // Rejected by the validator, tolerated by the parser so the error is the useful one.
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Quotes only what RFC 4180 requires, so a hand-edited file stays hand-editable. */
export function serializeField(value) {
  const v = value ?? "";
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function readDirectory(path) {
  const rows = parseCsv(readFileSync(path, "utf8"));
  if (rows.length === 0) throw new Error(`${path} is empty`);
  const header = rows[0];
  if (header.join(",") !== COLUMNS.join(",")) {
    throw new Error(
      `${path}: header does not match the format\n  expected: ${COLUMNS.join(",")}\n  found:    ${header.join(",")}`,
    );
  }
  return rows.slice(1).map((cells, i) => {
    if (cells.length !== COLUMNS.length) {
      throw new Error(`${path}: line ${i + 2} has ${cells.length} fields, expected ${COLUMNS.length}`);
    }
    return Object.fromEntries(COLUMNS.map((c, j) => [c, cells[j]]));
  });
}

export function writeDirectory(path, entries) {
  const lines = [COLUMNS.join(",")];
  for (const e of entries) {
    lines.push(COLUMNS.map((c) => serializeField(e[c])).join(","));
  }
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}
