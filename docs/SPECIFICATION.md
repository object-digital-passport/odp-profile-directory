# Directory format — normative description

🇬🇧 English · 🇷🇺 [Русский](SPECIFICATION.ru.md)

**Version 1.** This document describes the CSV interchange format used by this repository.

It is an **excerpt for convenience**. The normative source for everything about the protocol —
profile IDs, the public identity requirement, the `.well-known/odp.json` endpoint, affiliation,
and what a directory may claim — is
[`SPEC.md`](https://github.com/object-digital-passport/specifications/blob/main/SPEC.md), §3 and
§4. Where this file and `SPEC.md` disagree, `SPEC.md` wins.

Key words **MUST**, **MUST NOT**, **SHOULD**, **MAY** are used as in RFC 2119.

---

## 1. What a directory is allowed to claim

A directory is an off-chain convenience. It **MUST NOT** be presented as protocol truth.

Anyone **MAY** publish their own directory in this format, with their own admission rules and
their own data — this repository is one example of the format, not a registry others depend on.
The rules below constrain what any such directory may **claim**, not who may run one.

Any published directory **MUST** state plainly that its rows are selected by its operator, that
absence from the list carries no meaning, and that presence is not a guarantee.

Each listed profile ID **MUST** be accompanied by at least one HTTPS URL on the organization's
own official website — a page where that same profile ID is visibly published — so a reader can
confirm the mapping without relying on the directory operator. A directory listing IDs without
such links **MUST NOT** be presented as authoritative.

`displayName` is **not authoritative** and carries no verification. The authoritative artefacts
are the profile ID, the registry it belongs to, and `evidenceUrl`.

## 2. File identity

The CSV filename **MUST** be `odp-directory-v<MAJOR>.<MINOR>.csv`, naming the registry
generation its rows belong to. One file describes exactly one registry deployment; the chain ID
and contract address for it **MUST** be recorded in `tools/config.json` and carried into the built
`directory.json`.

A profile ID is meaningless without its registry: the same wallet receives a **different**
profile ID in a different deployment (`SPEC.md`, "0.x deployments"). A directory that omits the
registry is ambiguous the day a new generation ships.

## 3. Encoding and layout

- UTF-8, **no BOM**. Line endings **LF**. The file **MUST** end with a newline.
- RFC 4180. Fields are quoted only where required (`,`, `"`, newline). `""` escapes a quote.
- One header row, exactly the twelve column names below, in this order.
- Rows **MUST** be sorted by `profileId`, ascending, byte order.
- `profileId` **MUST** be unique within the file.
- An empty value is an empty field — never `null`, `-`, or `n/a`.
- Dates are ISO 8601: `YYYY-MM-DD` for days, `YYYY-MM-DDThh:mm:ssZ` (UTC) for instants.

## 4. Columns

| # | Column | Type | Required | Rule |
|:--|:--|:--|:--|:--|
| 1 | `profileId` | string | yes | `^[CBPM]-\d{3}-\d{3}-\d{3}-\d{3}$` |
| 2 | `profileType` | enum | yes | `C` `B` `P` `M`; **MUST** equal `profileId[0]` |
| 3 | `displayName` | string | no | Non-authoritative label |
| 4 | `evidenceKind` | enum | yes | `website` `social` |
| 5 | `evidenceUrl` | URL | yes | HTTPS |
| 6 | `evidenceHost` | host | yes | **MUST** equal the host of `evidenceUrl` |
| 7 | `checkMethod` | enum | yes | `auto` `manual` |
| 8 | `status` | enum | yes | §5 |
| 9 | `lastCheckedAt` | instant | conditional | Set by the checker; empty when `checkMethod=manual` |
| 10 | `lastVerifiedAt` | date | conditional | **MUST** be present when `checkMethod=manual` |
| 11 | `archiveUrl` | URL | conditional | **MUST** be present when `checkMethod=manual` |
| 12 | `addedAt` | date | yes | |

Additional constraints:

- `evidenceKind=social` **MUST NOT** have `checkMethod=auto`. No platform serves
  `/.well-known/odp.json` on behalf of its users, so such a row would claim a machine check it
  never had.
- `checkMethod=auto` **MUST** have a `lastCheckedAt`, unless `status=withdrawn`.
- `status=unverifiable` **MUST** have `checkMethod=manual`.

A directory **MUST NOT** carry affiliation (parent/child) columns. That relation lives on-chain
(`getAffiliatedParent`) and a copy in a hand-edited file will disagree with it. Wallet addresses
are likewise read from the registry (`getCreator`), not stored here.

## 5. Status semantics

| Status | Meaning | A consuming application **MUST** |
|:--|:--|:--|
| `active` | Evidence checked and present | May display the organization's identity |
| `unreachable` | Network error, 5xx, or 404 | Display **no owner identity at all** — and **no warning** |
| `unverifiable` | Never machine-readable (social, client-rendered) | Display with the date a human last checked |
| `removed` | Endpoint still serves, ID no longer listed | Display a prominent warning on the entry |
| `withdrawn` | Retired by request or by the operator | Display nothing; the row is history |

`unreachable` and `removed` **MUST NOT** be collapsed into one state. A site that fails to load
is missing data; an ID deliberately deleted from a page that still answers is an act. Presenting
the first as the second accuses honest organizations over routine downtime.

A warning **MUST NOT** be raised for evidence that was never machine-readable. Absence of a
finding is not a finding.

## 6. Re-checking

- Machine re-checks read `https://<evidenceHost>/.well-known/odp.json` (`SPEC.md` §3) — never
  the human page. A profile counts as listed only when the entry's `profileId` matches **and**
  its effective `chainId` and `registry` match the file's registry.
- A non-JSON 200 response (a single-page app answering every path) is **UNREADABLE**, not
  `removed`.
- `unreachable` **SHOULD** be set only after several consecutive failures — three in this
  repository's configuration — so a brief outage does not change what users see.
- `removed` **MUST** only be reachable for a profile the checker has previously found. The
  checker **MUST** persist that fact.
- Manual rows **SHOULD** be re-checked by a person periodically — 183 days here — and their
  staleness surfaced.

## 7. Built JSON

`directory.json` is generated from the CSV and **MUST** carry the format version, spec line,
chain ID, registry address, source filename, generation instant, row count, the curation
disclaimer, and the entries. Applications **SHOULD** read the JSON; the CSV is the editable
source of record.
