# DedPaste UX Review & Improvement Proposals

**Review Date:** 2026-02-22
**Reviewer:** Design & User Experience Agent
**Scope:** CLI, Web Interface, Documentation, Accessibility

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Web Interface Assessment](#web-interface-assessment)
3. [CLI Assessment](#cli-assessment)
4. [Documentation Assessment](#documentation-assessment)
5. [Accessibility Findings](#accessibility-findings)
6. [Quick Wins](#quick-wins)
7. [Larger Initiatives](#larger-initiatives)
8. [Prioritized Recommendations](#prioritized-recommendations)

---

## Executive Summary

DedPaste is a feature-rich, security-focused pastebin with a powerful CLI and a web-based landing page. The application has grown organically, adding PGP, Keybase, GitHub key integration, groups, and large-file multipart uploads over time. This growth has introduced several UX inconsistencies and gaps that can be addressed to significantly improve usability.

**Key Themes:**
- The web interface has orphaned JavaScript (upload form UI elements are missing from the HTML)
- The CLI has excellent help text but inconsistent output patterns and duplicated code paths between the default command and the `send` command
- Shell completions are stale and do not cover newer features (PGP, Keybase, GitHub, groups, completion command itself)
- Accessibility is minimal -- the web interface lacks ARIA attributes, focus management, and skip navigation
- Error messages are generally helpful but inconsistent in format (some use emoji, some do not; some provide next steps, some do not)
- The footer version is hardcoded and stale (displays 1.13.2 vs actual 1.23.2)

---

## Web Interface Assessment

### Current State

The homepage uses a custom MUI-inspired CSS framework (`src/muiStyles.ts`) with dark theme only. It consists of:
- An AppBar with logo, GitHub link, and Install button
- A hero section with feature cards
- Installation instructions
- Quick Start code examples
- Troubleshooting section
- API usage section
- A footer

### Issues Found

#### CRITICAL: Orphaned Upload Form JavaScript

**File:** `/home/cam/workspace/github.com/anoncam/dedpaste/src/muiStyles.ts` lines 1231-1427

The homepage HTML includes extensive JavaScript that references DOM elements which do not exist in the rendered HTML:
- `document.getElementById('dropZone')` -- no element with id `dropZone`
- `document.getElementById('fileInput')` -- no element with id `fileInput`
- `document.getElementById('tab-upload')` / `document.getElementById('tab-text')` -- no tab elements
- `document.getElementById('textContent')` -- no textarea
- `document.getElementById('resultContainer')` -- no result container
- `document.getElementById('oneTime')` / `document.getElementById('textOneTime')` -- no checkboxes
- `document.getElementById('fileName')` / `document.getElementById('fileSize')` -- no file info display

**Problem:** The JavaScript for an upload/text-sharing form is present, but the corresponding HTML form elements are completely absent. This means there is dead code being shipped to every visitor, and the web interface has no functional paste-creation capability.

**Impact:** Users visiting the homepage cannot create pastes through the web interface at all. The site is effectively a static landing page, not a functional tool.

#### Stale Version in Footer

**File:** `/home/cam/workspace/github.com/anoncam/dedpaste/src/muiStyles.ts` line 1446

```
Version 1.13.2
```

The actual version in `package.json` is `1.23.2`. This is a 10-version gap. The copyright also says 2024.

**Proposed Fix:** Make the version dynamic by passing it from the worker or reading from a constant.

#### Dark-Theme Only

**File:** `/home/cam/workspace/github.com/anoncam/dedpaste/src/muiStyles.ts` lines 14-56

The CSS only defines dark theme variables. There is no `prefers-color-scheme` media query or theme toggle. While dark theme is appropriate for developer tools, offering no alternative excludes users in bright environments or those who prefer light themes.

#### External Font Loading Without Fallback Period

**File:** `/home/cam/workspace/github.com/anoncam/dedpaste/src/muiStyles.ts` line 12

```css
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&family=Roboto+Mono:wght@400;500&display=swap');
```

Using `@import` inside a `<style>` tag blocks rendering until the font loads. The `display=swap` parameter in the Google Fonts URL helps, but the `@import` itself is render-blocking. This should be a `<link>` in the `<head>`.

#### No Paste View Form for Web Users

There is no way for a web user to create a paste directly from the browser. The homepage is entirely informational. The JavaScript for upload/text sharing exists but has no corresponding HTML. This is the single biggest UX gap for web visitors.

#### Inline Styles Overuse

**File:** `/home/cam/workspace/github.com/anoncam/dedpaste/src/muiStyles.ts` lines 870-984

The feature cards use extensive `onmouseover`/`onmouseout` inline event handlers and inline `style` attributes. This creates maintenance issues and prevents CSS-only hover effects:

```html
onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='var(--mui-shadows-4)';"
onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='var(--mui-shadows-3)';"
```

**Proposed Fix:** Move hover effects to CSS classes:
```css
.MuiCard:hover {
  transform: translateY(-4px);
  box-shadow: var(--mui-shadows-4);
}
```

#### `document.execCommand('copy')` is Deprecated

**File:** `/home/cam/workspace/github.com/anoncam/dedpaste/src/muiStyles.ts` line 1418

```js
document.execCommand('copy');
```

This API is deprecated. Modern browsers support `navigator.clipboard.writeText()`.

---

## CLI Assessment

### Current State

The CLI is built with Commander.js and provides five command modes: default (pipe-based), `keys`, `keys:enhanced`, `send`, `get`, and `completion`. It has rich help text, PGP/Keybase/GitHub integration, and both standard and enhanced interactive modes.

### Issues Found

#### Duplicated Logic Between Default Command and `send` Command

**File:** `/home/cam/workspace/github.com/anoncam/dedpaste/cli/index.ts`

The default command (line 1934+) and the `send` command (line 1111+) share nearly identical code paths for:
- Reading from stdin/file
- Encryption handling
- PGP flag detection workarounds
- File option parsing workarounds
- API upload
- Clipboard handling
- Result output formatting

This duplication means bug fixes or UX improvements must be applied in two places. It also creates subtle differences -- for example:

- The `DefaultOptions.for` type is `string` (line 208) while `SendOptions.for` is `string[]` (line 162), meaning multi-recipient support only works with the `send` command
- The default command does not support `--list-friends`, `--chunk-size`, `--resume`, or `--list-uploads`

**Proposed Fix:** Extract shared upload logic into a single function used by both command handlers.

#### Manual `process.argv` Parsing Workarounds

**File:** `/home/cam/workspace/github.com/anoncam/dedpaste/cli/index.ts` lines 1176, 1302-1312, 1315-1317, 1348, 2027, 2030-2050, 2053-2056

There are numerous instances of manually checking `process.argv` to detect flags that Commander.js should be handling:

```typescript
// Line 1176
if (!options.temp && (process.argv.includes('--temp') || process.argv.includes('-t'))) {
  options.temp = true;
}

// Line 1348
const shouldEncrypt = process.argv.includes('--encrypt') || process.argv.includes('-e');
```

This is a sign that Commander.js option parsing is not configured correctly for the default command. It creates fragility and means options may behave differently depending on argument order.

#### Inconsistent Output Formatting

The CLI uses multiple output patterns without consistency:

**Success messages** (various locations):
```
checkmark Paste created successfully!        (line 1554, uses emoji + styled output)
checkmark Added PGP key:                     (line 823, uses checkmark + indented details)
checkmark Generated new key pair:            (line 1069, uses checkmark + indented details)
```

**Error messages** (various locations):
```
Error: File '...' does not exist             (line 1323, plain text)
Error: PGP encryption requires...            (line 1370, plain text)
Encryption failed: ...                       (line 1405, no "Error:" prefix)
Network error: ...                           (line 1564, no "Error:" prefix)
Error: ...                                   (line 1569, generic catch-all)
```

**Informational messages**:
```
Using PGP encryption                         (line 1399, no prefix/icon)
No encryption requested                      (line 1419, printed for every unencrypted paste)
Fetching paste from ...                      (line 1672, always shown even in piped output)
```

**Problems:**
1. "No encryption requested" is printed on stderr even for normal, intended unencrypted usage (line 1419) -- this is noise for the 80% use case
2. `console.log('Fetching paste from ...')` in the `get` command (line 1672) pollutes stdout when users pipe output, making `dedpaste get URL > file.txt` include the status message
3. No structured `--json` output option for machine consumption

#### "No encryption requested" Message on Every Unencrypted Paste

**File:** `/home/cam/workspace/github.com/anoncam/dedpaste/cli/index.ts` line 1419

```typescript
} else {
    console.log('No encryption requested');
}
```

When a user runs `echo "hello" | dedpaste`, they see "No encryption requested" even though they never asked for encryption. This is confusing and noisy for the most common use case.

**Proposed Fix:** Remove this message entirely, or only display it when `--verbose` is enabled.

#### `get` Command Mixes Status Output with Content on stdout

**File:** `/home/cam/workspace/github.com/anoncam/dedpaste/cli/index.ts` line 1672

```typescript
console.log(`Fetching paste from ${fetchUrl}...`);
```

This message goes to stdout via `console.log`. When users do `dedpaste get URL > output.txt`, this status message ends up in the file. Status messages should go to stderr.

**Proposed Fix:** Change `console.log` to `console.error` or `process.stderr.write` for all status/progress messages in the `get` command.

#### Enhanced Mode 60-Second Timeout is Too Short

**File:** `/home/cam/workspace/github.com/anoncam/dedpaste/cli/index.ts` lines 273-276 and 442-445

The `keys:enhanced` command has a 60-second timeout (line 273) and the `keys --enhanced` flag has a 30-second timeout (line 442). These are interactive TUI sessions where users might spend several minutes managing keys. An automatic timeout with a terse error message is a poor experience.

**Proposed Fix:** Remove the timeout for interactive modes, or increase it to 10+ minutes with a visible countdown warning.

#### Shell Completions are Stale

**File:** `/home/cam/workspace/github.com/anoncam/dedpaste/completion/dedpaste-completion.bash`
**File:** `/home/cam/workspace/github.com/anoncam/dedpaste/completion/dedpaste-completion.zsh`

The completion scripts only cover basic options. Missing completions include:
- `keys:enhanced` command
- `completion` command
- PGP options: `--pgp-key`, `--pgp-name`, `--import-pgp-key`, `--pgp-passphrase`, `--native-pgp`, `--from-gpg`, `--gpg-import`
- Keybase options: `--keybase`, `--keybase-name`, `--no-verify`
- GitHub options: `--github`, `--github-name`, `--refresh-github-keys`
- Group options: `--group-create`, `--group-add`, `--group-remove`, `--group-delete`, `--group-list`
- Large file options: `--chunk-size`, `--resume`, `--no-progress`, `--list-uploads`, `--abort-upload`
- Get options: `--pgp-key-file`, `--pgp-passphrase`, `--use-gpg-keyring`, `--no-gpg-keyring`, `--show-metadata`, `--interactive`
- Logging options: `--verbose`, `--debug`, `--log-level`, `--log-file`
- `--diagnostics`, `--search`, `--details`, `--backup`

This significantly limits the discoverability of the CLI's power features.

#### Clipboard Failure Fallback is Weak

**File:** `/home/cam/workspace/github.com/anoncam/dedpaste/cli/index.ts` lines 25-43

When `clipboardy` fails to load (common on headless servers, SSH sessions, CI), the fallback just prints:
```
Clipboard access is not available. URL could not be copied.
Manual copy: <url>
```

This prints to stderr during module load, not when the user actually tries to use `--copy`. The error appears at startup even if the user never requests clipboard functionality.

**Proposed Fix:** Lazily detect clipboard availability only when `--copy` is used, and print a cleaner one-line message.

#### No `--output` / `-o` Flag on the `get` Command

The `send` command has `-o, --output` for script-friendly output (URL only). The `get` command has no equivalent flag to suppress metadata/status and output only content. This makes scripting with `get` harder:

```bash
# Desired: clean content to file
dedpaste get URL -o output.txt

# Actual: must redirect and hope no status messages leak
dedpaste get URL > output.txt  # includes "Fetching paste from..." in the file
```

**Proposed Addition:** Add `-o, --output <file>` to the `get` command to save directly to a file, and/or `--quiet` to suppress status messages.

---

## Documentation Assessment

### Current State

The README.md is well-structured with installation, quick start, and comprehensive usage examples. It covers all major features including PGP, Keybase, GitHub, groups, and troubleshooting.

### Issues Found

#### Feature Discoverability Overload

The README has grown to 408 lines. While comprehensive, new users face information overload. The six command modes, multiple encryption methods, and dozens of options are presented linearly without a clear "start here" path.

**Proposed Fix:**
- Add a "5-Minute Getting Started" section at the very top with exactly three commands
- Move advanced features (PGP integration, Keybase, groups) to dedicated docs/ pages
- Add a command cheatsheet/quick reference table

#### Example Mockup: Simplified Quick Start

```
## Quick Start (2 minutes)

1. Install:     npm install -g dedpaste
2. Share text:  echo "Hello" | dedpaste
3. Read paste:  dedpaste get <paste-url>

That's it! For encryption, groups, and advanced features, see the full docs.
```

#### Inconsistent Terminology

The README uses both `--temp` and `--one-time` to describe the same feature:
- Line 109: `dedpaste send --one-time` (the flag does not actually exist)
- Line 136: `dedpaste --temp`
- Line 272: `--for alice --temp`

The actual CLI flag is `--temp` / `-t`. The web page uses "one-time paste" in prose and `oneTime` in the API. The README line 109 says `--one-time` which would fail.

**Proposed Fix:** Standardize on one term in all user-facing text (suggested: "one-time" in prose, `--temp` as the flag, with a note that `--temp` creates a one-time paste).

#### Missing Documentation for Analytics

Both the CLI (`cli/analytics.ts`) and worker (`src/analytics.ts`) include Mixpanel analytics that are always enabled. There is no documentation, privacy policy, or opt-out mechanism described in the README. The CLI analytics service hard-codes `enabled: true` (line 93 of `cli/analytics.ts`).

**Proposed Fix:** Add a Privacy section to the README documenting what is collected, or implement an opt-out mechanism.

#### No API Rate Limit Documentation

The `get` command includes a helpful "Too many requests" error message (line 1686) suggesting rate limits exist, but there is no documentation of what the limits are.

---

## Accessibility Findings

### Web Interface

#### Missing ARIA Attributes

**File:** `/home/cam/workspace/github.com/anoncam/dedpaste/src/muiStyles.ts` lines 830-1454

The homepage HTML has:
- `<html lang="en">` -- GOOD
- No `role` attributes on any interactive elements
- No `aria-label` on icon-only buttons or links
- No `aria-describedby` for code blocks or feature descriptions
- The SVG icons inside links (GitHub, Install) have no `aria-hidden="true"` or `<title>` elements
- No skip navigation link
- No focus indicators beyond browser defaults (the `outline: 0` on `.MuiButton` at line 268 actually removes the default focus indicator)

#### Focus Indicator Removed

**File:** `/home/cam/workspace/github.com/anoncam/dedpaste/src/muiStyles.ts` line 268

```css
.MuiButton {
  ...
  outline: 0;
  ...
}
```

This removes the default focus outline, making keyboard navigation invisible. No replacement focus style is provided.

**Proposed Fix:**
```css
.MuiButton:focus-visible {
  outline: 2px solid var(--mui-palette-primary-main);
  outline-offset: 2px;
}
```

#### Color Contrast Issues

The following combinations may not meet WCAG AA (4.5:1) contrast requirements:
- Text secondary `rgba(255, 255, 255, 0.6)` on background `#121212` -- ratio approximately 7.5:1 (passes)
- Text disabled `rgba(255, 255, 255, 0.38)` on background `#121212` -- ratio approximately 4.7:1 (borderline)
- Chip default text on `rgba(255, 255, 255, 0.16)` background -- likely insufficient

#### No Landmark Regions

The homepage does not use `<nav>`, `<main>`, `<aside>`, or proper `role` attributes for landmark navigation. Screen reader users cannot jump between page sections.

**Note:** The `<main>` tag is present (line 868), which is good, but `<nav>` is missing for the header navigation.

### CLI

#### Color as Sole Indicator

**File:** `/home/cam/workspace/github.com/anoncam/dedpaste/cli/logger.ts` lines 191-215

Log levels are differentiated only by color (Red=ERROR, Yellow=WARN, Green=INFO, Cyan=DEBUG, Magenta=TRACE). For users with color-blind terminals or piped output where ANSI codes are stripped, the level prefix text is still visible ("ERROR", "WARN", etc.) which is good, but the enhanced interactive mode (`cli/enhancedInteractiveMode.ts`) uses chalk colors extensively without text-based alternatives for all status indicators.

#### No `--no-color` Flag

The CLI does not provide a `--no-color` flag or respect the `NO_COLOR` environment variable (https://no-color.org/). The enhanced mode depends heavily on `chalk` colors.

---

## Quick Wins

These can be implemented in a few hours each with minimal risk:

| # | Issue | File | Effort |
|---|-------|------|--------|
| 1 | Remove "No encryption requested" message | `cli/index.ts:1419` | 5 min |
| 2 | Fix stale footer version (1.13.2 -> dynamic) | `src/muiStyles.ts:1446` | 15 min |
| 3 | Fix footer copyright year (2024 -> 2025) | `src/muiStyles.ts:1446` | 5 min |
| 4 | Move status messages in `get` to stderr | `cli/index.ts:1672,1698` | 15 min |
| 5 | Replace `document.execCommand('copy')` | `src/muiStyles.ts:1418` | 15 min |
| 6 | Add `:focus-visible` styles for buttons | `src/muiStyles.ts:268` | 10 min |
| 7 | Move card hover effects from inline JS to CSS | `src/muiStyles.ts:890-972` | 20 min |
| 8 | Fix `--one-time` typo in README | `README.md:109` | 5 min |
| 9 | Move font import from `@import` to `<link>` | `src/muiStyles.ts:12,838` | 10 min |
| 10 | Add `<nav>` landmark to header | `src/muiStyles.ts:841` | 10 min |
| 11 | Lazy-load clipboard detection | `cli/index.ts:25-43` | 30 min |
| 12 | Add `aria-hidden="true"` to decorative SVGs | `src/muiStyles.ts:849-858` | 15 min |
| 13 | Remove dead upload form JavaScript | `src/muiStyles.ts:1231-1427` | 10 min |

---

## Larger Initiatives

### 1. Add a Functional Web Paste Form

**Priority:** High
**Effort:** 1-2 days

The homepage JavaScript for upload/text sharing exists but has no HTML. This should be completed by adding the missing HTML form elements (text area, file drop zone, one-time toggle, submit button, result display) above the code examples section.

**Mockup:**

```
+------------------------------------------------------------------+
| [Text] [Upload File]                                             |
+------------------------------------------------------------------+
| +--------------------------------------------------------------+ |
| |                                                              | |
| |  Enter your text here...                                     | |
| |                                                              | |
| |                                                              | |
| +--------------------------------------------------------------+ |
|                                                                  |
| [ ] One-time paste (deleted after viewing)                       |
|                                                                  |
| [    Share Text    ]              [  Clear  ]                    |
|                                                                  |
| +--------------------------------------------------------------+ |
| | [check] Your text has been shared!                           | |
| | URL: [https://paste.d3d.dev/AbCdEfGh   ] [Copy]             | |
| +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

### 2. Unify Default and Send Command Code Paths

**Priority:** High
**Effort:** 1 day

Extract shared logic (stdin reading, file reading, encryption, upload, result formatting) into a shared `uploadPaste()` function used by both the default command handler and the `send` command handler. This eliminates duplication, fixes the `DefaultOptions.for` type mismatch, and ensures consistent behavior.

### 3. Update Shell Completions to Cover All Options

**Priority:** Medium
**Effort:** 0.5 day

Both bash and zsh completion scripts need to be regenerated to include all current options: PGP, Keybase, GitHub, groups, large file uploads, logging, diagnostics, and the `completion` command itself.

### 4. Add `--json` Output Mode

**Priority:** Medium
**Effort:** 0.5 day

Add a `--json` flag to `send` and `get` commands that outputs structured JSON instead of human-readable text. This enables reliable scripting:

```bash
$ echo "hello" | dedpaste send --json
{"url":"https://paste.d3d.dev/AbCdEfGh","encrypted":false,"oneTime":false}
```

### 5. Add Light Theme Support

**Priority:** Low
**Effort:** 1 day

Add a `prefers-color-scheme: light` media query block with light-mode CSS variables, or add a theme toggle button in the header.

### 6. Implement `--quiet` / `--verbose` Consistency

**Priority:** Medium
**Effort:** 0.5 day

Establish a consistent verbosity model:
- Default: only essential output (URL on send, content on get)
- `--verbose` / `-v`: includes status messages
- `--quiet` / `-q`: suppresses all non-essential output
- `--debug`: includes trace-level information

### 7. Add `NO_COLOR` Support

**Priority:** Low
**Effort:** 2 hours

Respect the `NO_COLOR` environment variable standard. When set, disable all ANSI color codes in CLI output.

### 8. Privacy Documentation for Analytics

**Priority:** High
**Effort:** 2 hours

Document what analytics are collected, add an opt-out mechanism, or at minimum provide a `dedpaste analytics --opt-out` command. The current implementation in `cli/analytics.ts` forces `enabled: true` (line 93) with no user-facing opt-out.

---

## Prioritized Recommendations

### Tier 1: Do Immediately (High impact, Low effort)

1. **Remove "No encryption requested" noise** -- confuses the 80% use case
2. **Fix stale version and copyright in footer** -- undermines credibility
3. **Remove orphaned upload JavaScript** OR add the missing HTML form -- currently broken dead code
4. **Move `get` command status messages to stderr** -- breaks piped output
5. **Add `:focus-visible` styles** -- keyboard users currently have no visual focus indicator

### Tier 2: Do Soon (High impact, Medium effort)

6. **Build the functional web paste form** -- the HTML/JS exists in partial form; complete it
7. **Unify default/send command code paths** -- eliminates bugs from duplication
8. **Update shell completions** -- power users expect tab completion for all options
9. **Add privacy documentation for analytics** -- compliance and trust concern
10. **Fix the `DefaultOptions.for` type to `string[]`** -- multi-recipient broken on default command

### Tier 3: Do When Possible (Medium impact)

11. **Add `--json` output mode** -- enables reliable scripting
12. **Implement `--quiet` / `--verbose` consistency** -- cleaner output model
13. **Add `NO_COLOR` support** -- accessibility for terminal users
14. **Add `<nav>` landmark and ARIA attributes to web interface** -- screen reader support
15. **Move card hover effects from inline JS to CSS** -- maintainability

### Tier 4: Future Enhancement (Lower impact or Higher effort)

16. **Add light theme support** -- broader accessibility
17. **Add PWA support** -- offline capability for the web interface
18. **CLI configuration file (`~/.dedpaste/config.json`)** -- persistent preferences
19. **Setup wizard for first-time users** -- guided onboarding
20. **Redesign enhanced mode with a more polished TUI** -- better interactive experience

---

## Appendix: File References

| File | Lines | Issue Summary |
|------|-------|---------------|
| `src/muiStyles.ts` | 12 | Render-blocking `@import` for fonts |
| `src/muiStyles.ts` | 268 | Focus outline removed with `outline: 0` |
| `src/muiStyles.ts` | 830-1454 | Homepage HTML (missing form elements, inline event handlers) |
| `src/muiStyles.ts` | 1231-1427 | Dead JavaScript referencing nonexistent DOM elements |
| `src/muiStyles.ts` | 1418 | Deprecated `document.execCommand('copy')` |
| `src/muiStyles.ts` | 1446 | Hardcoded stale version "1.13.2" and year "2024" |
| `cli/index.ts` | 162 vs 208 | Type mismatch: `SendOptions.for: string[]` vs `DefaultOptions.for: string` |
| `cli/index.ts` | 1176, 1302-1317, 1348, 2027-2056 | Manual `process.argv` parsing workarounds |
| `cli/index.ts` | 1419 | "No encryption requested" printed on every unencrypted paste |
| `cli/index.ts` | 1672 | Status message on stdout instead of stderr in `get` command |
| `cli/index.ts` | 273, 442 | Arbitrary timeout on interactive enhanced mode (30-60 seconds) |
| `cli/analytics.ts` | 93 | Analytics forced enabled with no opt-out |
| `completion/dedpaste-completion.bash` | All | Missing completions for PGP, Keybase, GitHub, groups, etc. |
| `completion/dedpaste-completion.zsh` | All | Same stale completions as bash |
| `README.md` | 109 | References `--one-time` flag which does not exist |
| `src/analytics.ts` | 27 | Mixpanel token hardcoded; analytics always enabled |
