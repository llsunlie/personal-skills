# Repository conventions

- Keep each skill under `skills/<name>/` with its own `SKILL.md` and required resources.
- The installed skills can be symlinks to this checkout; edits affect the live installation.
- Preserve the HTML skill's preview, session archive, folding module and renderer integration when merging upstream changes.
- HTML pages start at Full (level 1). Shift + wheel controls reading zoom.
- Keep generated pages, session logs, local configuration, credentials, caches and backups outside the repository.
- Preserve upstream license notices when importing or modifying third-party skills.
- Check changed JavaScript modules with `node --check`. Verify renderer and browser behavior when changing page interactions.
