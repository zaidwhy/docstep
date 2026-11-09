# Docstep handoff

State as of 2026-11-10. Repo: private `zaidwhy/docstep`, branch `main`. Upstream remote push URL is disabled on purpose.

## Where it stands

- Phase 1 (rebrand, upstream fixes) and phase 2 (`Docstep: Update Docstring`) are done.
- Unit tests: `npm run unit_test`. Integration tests in a real VS Code: `npm run prepare_integration_tests` then `VSCODE_VERSION=stable npm run integration_test` (cached under `.vscode-test/`).
- Lint: `npm run lint` exits 0.

## Overnight decisions (review)

Taken without Zaid on 2026-11-10 under the overnight directive. Each one is a single commit and easy to revert.

1. **Update Docstring on a class documents `__init__`.** The cursor on the `class` line, a class decorator or the class docstring updates the class docstring from the class's own `__init__` parameters. Base classes are never parameters, and Returns and Raises stay in `__init__`. A class with no `__init__` of its own (a dataclass, an inherited constructor) is refused. Why: the Google and NumPy guides both allow constructor arguments in the class docstring, and there is nothing else in a class signature worth syncing.
2. **No default keybinding for Update Docstring.** `cmd+shift+3` is the macOS screenshot shortcut, and no free chord is obviously right. Users bind `docstep.updateDocstring` themselves.
3. **Defaults written in a description are left alone.** Only `_description_` placeholders get regenerated. Editing a sentence a person wrote is worse than leaving a stale default in it.
4. **CI on Node 20 with stable VS Code.** Node 18 is past end of life, and insiders would make a red run ambiguous.

## Waiting on Zaid (outward-facing, not decided overnight)

- Public or private repo.
- Create the Marketplace and Open VSX publisher `zaidwhy`.
- Release version: `1.0.0-dev` must become a plain semver before the Marketplace accepts it.
- Keep or replace the upstream icon; keep or drop the `autodocstring` search keyword.

## Known gaps

- Generate Docstring on a class (upstream behaviour) lists base classes as Args.
- A `def` written inside a multi-line string at column 0 can still be taken for a real def by the backward scan in `src/update/locate.ts`.
