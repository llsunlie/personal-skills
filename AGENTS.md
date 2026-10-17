# Repository conventions

- Keep each skill under `skills/<name>/` with its own `SKILL.md` and required resources.
- The installed skills can be symlinks to this checkout; edits affect the live installation.
- Preserve the HTML skill's preview, session archive, folding module and renderer integration when merging upstream changes.
- HTML pages start at Full (level 1). Shift + wheel controls reading zoom.
- Keep generated personal pages, session logs, local configuration, credentials, caches and backups outside the repository. The curated public `docs/demo.html` is built only from `skills/answer-me-with-html/examples/reading.md` using `node scripts/build-demo.mjs`.
- Preserve upstream license notices when importing or modifying third-party skills.
- Keep `SOURCE.md` for each skill with upstream URLs, the known import version, reference projects, local changes and license locations. Distinguish copied code from design inspiration; do not infer an exact upstream commit for an untracked installation.
- Check changed JavaScript modules with `node --check`. Verify renderer and browser behavior when changing page interactions.

- GitHub Pages serves `docs/` from `main`. Keep site asset links relative to support the `/personal-skills/` base path. Verify desktop/mobile layout, search/filter, install-copy, provenance dialogs and the public reading demo when changing the site.
