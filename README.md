# ODP Profile Directory

🇬🇧 English · 🇷🇺 [Русский](docs/README.ru.md)

**A CSV format for listing Object Digital Passport profile IDs whose owners published them on
their own website — and an example file you can copy.**

If you are building an app on [ODP](https://github.com/object-digital-passport/specifications),
the protocol gives you a profile ID like `B-029-384-751-224` and nothing else. Names are
deliberately not on-chain: anyone could register as "Adidas" otherwise. So an app that wants to
show *who* issued a passport has to solve the same problem every time — find where that
organization published the ID, and check it is still there.

This repository is that work, done once, in a file you can read.

---

## Read this before you trust anything here

- **Rows are selected by the maintainer of this repository.** This is curation, not protocol truth.
- **Absence means nothing.** Most legitimate organizations are not listed. Never treat "not in
  the directory" as a warning about anyone.
- **Presence is not a guarantee.** It means the ID was found published on that domain. It does
  not mean the organization is honest, solvent, or that its passports are accurate.
- **The protocol does not know this file exists.** No mint, proof, or verification result
  depends on it. See `SPEC.md` §4 in the specification repository.

## The example data is synthetic

Every row in `odp-directory-v0.6.csv` uses reserved documentation domains (`example.com`,
`example.org`, `example.net`, RFC 2606) and invented profile IDs. **No real organization is
listed, and none has been contacted.** The rows exist to show what each column and each status
looks like — including the failure states. Running `npm run recheck` against them will report
everything as unreachable, which is correct: those domains serve nothing.

---

## This is an example. Run your own.

Nothing about this repository is privileged. It is one maintainer's list, in a format anyone can
reuse — and the expected way to use it is **not** to depend on this file, but to keep your own.

Fork it, delete every row, and you have a working directory for your project:

1. Point `tools/config.json` at the registry you verify against (`chainId`, `registryAddress`,
   `csvFile` named for that generation).
2. Add your own rows, with your own admission rules. Stricter than this one, looser, or an
   entirely closed list of partners you already have contracts with — your call.
3. Let the workflow re-read the endpoints daily and publish `directory.json`.
4. Read that JSON from your app.

Your directory answers only to you, and your users trust it exactly as much as they trust you.
That is the point: ODP has no central registry, so a directory is somebody's editorial opinion
about who is worth showing — and it is healthier for there to be many, run by parties whose
reputations differ, than one that quietly becomes the authority.

The only thing that is not yours to redefine is what a directory may **claim**. The status
rules in [SPECIFICATION.md](docs/SPECIFICATION.md) exist so that a user moving between two apps
reading two different directories is not shown "unreachable" as an accusation in one and as
silence in the other. Keep those, change everything else.

## Files

| File | What it is |
|:--|:--|
| `odp-directory-v0.6.csv` | The directory. One row per profile ID. Hand-editable. |
| `directory.json` | The same data as JSON, built by CI. **Read this one from an app.** |
| `tools/config.json` | Which registry the file describes: chain, address, spec line, thresholds. |
| `docs/SPECIFICATION.md` | The format, normatively. Excerpted from the ODP specification. |
| `tools/` | The re-checking bot and its bookkeeping. |

The filename carries the registry generation (`v0.6`). A profile ID means nothing without the
registry that issued it — the same wallet gets a **different** ID in a different deployment. When
v1 ships, a second CSV appears beside this one; nothing is rewritten.

## Columns

| # | Column | Meaning |
|:--|:--|:--|
| 1 | `profileId` | `T-NNN-NNN-NNN-NNN`. The key. Rows are sorted by it. |
| 2 | `profileType` | `C` / `B` / `P` / `M`. Repeats the prefix so the file is filterable. |
| 3 | `displayName` | **Not authoritative.** A convenience label. Never make a decision on it. |
| 4 | `evidenceKind` | `website` or `social`. |
| 5 | `evidenceUrl` | The page a human can open and see the ID on. |
| 6 | `evidenceHost` | Host of `evidenceUrl`. For `website` rows, where the bot looks. |
| 7 | `checkMethod` | `auto` (bot re-reads it daily) or `manual` (only a person can). |
| 8 | `status` | See below. |
| 9 | `lastCheckedAt` | When the bot last looked. Empty for manual rows. |
| 10 | `lastVerifiedAt` | When a person last looked. |
| 11 | `archiveUrl` | Snapshot proving what the person saw. Required for manual rows. |
| 12 | `addedAt` | When the row entered the file. |

Deliberately **absent**: parent/child links (read `getAffiliatedParent` from the contract — this
file would go stale), chain and registry address (they are in `tools/config.json` and the filename),
and the wallet (read `getCreator` from the contract).

## What an application must do with `status`

| `status` | Show |
|:--|:--|
| `active` | The organization's identity may be displayed. |
| `unreachable` | **Nothing.** No name, and no warning either. |
| `unverifiable` | The name, together with the date a human last checked it. |
| `removed` | A prominent warning on the entry. |
| `withdrawn` | Nothing. The row is kept for history only. |

`unreachable` and `removed` are not the same thing and must never be collapsed. A site that
fails to load says nothing — servers go down. An ID **deliberately deleted** from a page that
still loads is an act. Treating the first as the second means publicly accusing honest
organizations of forgery over a weekend of downtime.

A warning is **never** raised for a row the bot could not read in the first place. Absence of a
finding is not a finding.

## How the automatic check works

The bot does not scrape the human page. It reads a fixed endpoint on the organization's own
domain:

```
https://<domain>/.well-known/odp.json
```

```json
{
  "odp": 1,
  "chainId": 137,
  "registry": "0x012aC6393464A73EC16131D701ff2e000695b91b",
  "profiles": [{ "profileId": "B-029-384-751-224", "wallet": "0x742d35Cc…4438f44e" }]
}
```

Scraping the visible page fails two ways that matter: a page rendered by JavaScript hides the ID
from every non-browser checker, and a page anyone can post to — a forum, a community section —
puts an attacker's text on an official domain. A static file at a reserved path (RFC 8615) is
readable without a browser and writable only by whoever controls the server.

Organizations (`B`, `M`, `P`) **must** serve it; individuals (`C`) should where they have a
domain. Where there is no endpoint — a social profile, a client-rendered site — the row lives in
manual mode with a snapshot, and goes stale after 183 days.

## Getting listed

1. Publish your profile ID and wallet on your own site, per `SPEC.md` §3.
2. Add `/.well-known/odp.json` to that domain.
3. Open a pull request adding one row. See [CONTRIBUTING.md](docs/CONTRIBUTING.md).

Anyone may open a PR for any profile — the evidence is public either way. A maintainer merges
after checking the domain is the real one and CI passes.

## Local use

```bash
node tools/validate.mjs     # every format rule
node tools/build.mjs        # regenerate directory.json
node tools/recheck.mjs --dry-run
```

Node 22+, no dependencies.

## Licence

Data (`odp-directory-v0.6.csv`, `directory.json`) — [CC0 1.0](LICENSE).
Everything else — [MIT](LICENSE).
