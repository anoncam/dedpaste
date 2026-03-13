---
name: release-notes
description: Generate release notes from conventional commits since the last git tag
disable-model-invocation: true
---

# Release Notes Generator

Generate a formatted changelog from conventional commits since the last release tag.

## Steps

1. **Find the latest tag** — Run `git describe --tags --abbrev=0` to get the most recent tag
2. **Collect commits** — Run `git log <tag>..HEAD --oneline --no-merges` to get all commits since that tag
3. **Parse conventional commits** — Group commits by type prefix:
   - `feat:` → **Features**
   - `fix:` → **Bug Fixes**
   - `perf:` → **Performance**
   - `docs:` → **Documentation**
   - `refactor:` → **Refactoring**
   - `test:` → **Tests**
   - `chore:` / `ci:` / `build:` → **Maintenance**
   - `BREAKING CHANGE:` or `!:` → **Breaking Changes** (highlighted at top)
4. **Determine next version** — Based on commit types:
   - Any breaking change → major bump
   - Any `feat:` → minor bump
   - Only `fix:` / other → patch bump
5. **Format output** — Generate markdown release notes

## Output Format

```markdown
# v{version} — {date}

## Breaking Changes
- {description} ({short-hash})

## Features
- {scope}: {description} ({short-hash})

## Bug Fixes
- {description} ({short-hash})

## Maintenance
- {description} ({short-hash})

**Full Changelog**: {compare-url}
```

## Notes

- If there are no commits since the last tag, report that there's nothing to release
- If there are no tags at all, use the initial commit as the base
- Include the GitHub compare URL: `https://github.com/anoncam/dedpaste/compare/{old-tag}...{new-tag}`
- Strip the conventional commit prefix from descriptions for cleaner output
- Include the scope in parentheses if present (e.g., `feat(cli): add encryption`)
