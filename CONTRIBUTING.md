# Contributing

🇬🇧 English · 🇷🇺 [Русский](CONTRIBUTING.ru.md)

## Adding a profile

Anyone may open a pull request for any profile — the evidence is public either way, and a false
row is caught by the checks below rather than by trust in the submitter.

Before you open one:

1. **The ID is published on the organization's own site.** A page a person can open and read it
   on. That page becomes `evidenceUrl`.
2. **`https://<domain>/.well-known/odp.json` exists and lists the ID** — required for `B`, `M`,
   and `P`. Without it the row cannot be machine-checked and will be `manual` / `unverifiable`.
3. **One row per pull request**, inserted in `profileId` sort order.
4. **Run the checks locally:**

```bash
node tools/validate.mjs && node tools/build.mjs && node tools/recheck.mjs --only=<profileId> --dry-run
```

Commit both `odp-directory-v0.6.csv` and the rebuilt `directory.json`.

### Filling the row

- `checkMethod=auto` only if the endpoint answers. Otherwise `manual`, and then `archiveUrl`
  (a Wayback snapshot of the evidence page) and `lastVerifiedAt` are required.
- `displayName` is a convenience label. Write the organization's own name as it appears on that
  site, nothing promotional, and never a name the site does not itself use.
- `evidenceHost` must be exactly the host of `evidenceUrl`.

## What a maintainer checks before merging

- CI is green.
- The domain is the organization's real one — not a look-alike, not a fan site, not a
  reseller. This is a human judgement and it is why merges are not automatic.
- The evidence page genuinely shows the ID.

Being listed is curation, not certification. A maintainer can decline a row without the
submitter having done anything wrong.

## Removing a profile

Open an issue. Rows are set to `withdrawn` and kept, so that applications which cached the entry
can explain why it changed rather than silently forgetting it.

## Changing the format

Format changes belong upstream first. Open a discussion on
[`object-digital-passport/specifications`](https://github.com/object-digital-passport/specifications/discussions)
— `SPEC.md` §4 is the normative source, and this repository follows it.
