# Sprint Plan: DedPaste Innovation Sprint

**Sprint Duration**: 2 weeks
**Sprint Goal**: Deliver high-impact innovative features that differentiate DedPaste, harden the security posture, and improve both CLI and web UX within the Cloudflare Workers architecture.
**Created**: 2026-02-22
**Team Lead**: Team Lead Agent

---

## Current State Assessment

### What Exists
- **Worker** (`src/index.ts`, ~2800 lines): Handles paste CRUD, one-time pastes, encrypted pastes, markdown rendering with syntax highlighting and Mermaid diagrams, web upload/text API, and multipart upload for large files (up to 5GB).
- **CLI** (`cli/index.ts`, ~2000+ lines): Full-featured CLI with Commander.js, supporting paste/get, encryption (RSA+AES hybrid, PGP, Keybase, GitHub keys), interactive key management, group recipients, large file uploads with resume, progress display, analytics.
- **Storage**: R2 for paste content, KV for metadata and upload sessions.
- **Encryption**: Client-side E2E encryption with RSA+AES-256-GCM hybrid, PGP (via openpgp), Keybase and GitHub key fetching, key groups, streaming encryption for large files (v4 format).
- **Web Interface**: MUI-styled homepage served from the worker with paste creation UI, markdown viewer with code highlighting.
- **Tests**: Only 3 test files (encryption, friend-encryption, pgp-decryption) -- all focused on encryption. No worker tests, no CLI command tests, no integration tests.
- **CI/CD**: auto-version-bump and release-with-sbom workflows. No test workflow, no security scanning.
- **Types**: Comprehensive type definitions including service interfaces (IPasteService, IEncryptionService, etc.) but no actual service layer implementation.

### What Is Missing (Biggest Gaps)
1. **No rate limiting** -- RateLimitError class exists but nothing enforces it. The service is open to abuse.
2. **No paste expiration** -- Pastes live forever unless they are one-time. No TTL-based cleanup.
3. **No password protection** -- No way to add a password to a paste beyond encryption keys.
4. **No API key/auth system** -- All endpoints are unauthenticated. No way to manage pastes after creation.
5. **No service layer** -- All logic is in the monolithic `src/index.ts` handler function.
6. **No test coverage** for the worker or CLI commands.
7. **No health endpoint** -- No way to check if the service is up.
8. **No OpenAPI spec** -- API is undocumented.
9. **Web decryption is stubbed** -- `handleWebDecrypt` just redirects; browser-side decryption with key input is not implemented.
10. **No paste deletion API** -- Once created, non-one-time pastes cannot be deleted by the creator.

### Where the Biggest Innovation Opportunities Are
1. **Paste Expiration with TTL** -- Simple, high-impact, uses existing R2/KV infrastructure.
2. **Password-Protected Pastes** -- Differentiator: encryption without needing key management.
3. **Rate Limiting via KV** -- Essential for production-readiness.
4. **Paste Deletion Tokens** -- Give creators a delete token at creation time.
5. **Web-Based Decryption** -- Let users decrypt pastes in-browser without the CLI.
6. **Health + Info Endpoints** -- Low effort, high value for monitoring.
7. **CLI Config File** -- Persistent user preferences for the CLI.

---

## Sprint Backlog

### Track 1: Security Hardening (Security Agent)

#### Task 1.1: Implement Rate Limiting
**Priority**: P0
**Assigned To**: Security Agent
**Dependencies**: None
**TODOs.md Reference**: Section 2.1 (Rate limiting)
**Description**: Implement per-IP rate limiting using Cloudflare KV. The worker should track request counts per IP with a sliding window and return 429 responses when limits are exceeded. This is the single most important security gap -- without it, the service is trivially abusable.

**Implementation approach**:
- Use the existing `PASTE_METADATA` KV namespace (or create a new `RATE_LIMITS` namespace if preferred) to store counters keyed by hashed IP.
- Define endpoint-specific limits:
  - POST `/upload`, `/temp`, `/e/upload`, `/e/temp`: 30 requests per minute per IP.
  - POST `/api/upload`, `/api/text`: 30 requests per minute per IP.
  - POST `/upload/init` (multipart): 5 per minute per IP.
  - GET `/{id}`: 120 requests per minute per IP.
- Use the existing `RateLimitError` class from `src/types/index.ts`.
- Return proper `Retry-After` headers on 429 responses.

**Acceptance Criteria**:
- [ ] Rate limit middleware function implemented in the worker
- [ ] Per-IP limits enforced on all POST endpoints
- [ ] GET endpoints have higher but still enforced limits
- [ ] 429 responses include `Retry-After` header
- [ ] Rate limit state stored in KV with TTL for auto-cleanup
- [ ] Unit tests for the rate limiting logic
- [ ] Does not break existing functionality

**Risks**: KV eventual consistency may allow slight over-counting across edge locations. This is acceptable for a first implementation.

---

#### Task 1.2: Dependency Security Audit
**Priority**: P0
**Assigned To**: Security Agent
**Dependencies**: None
**TODOs.md Reference**: Section 5.2 (Dependency scanning)
**Description**: Audit all direct and transitive dependencies using Sonatype MCP tools. The project has 18 direct dependencies and 7 dev dependencies. Key concerns: `openpgp`, `node-fetch`, `marked`, `highlight.js`, and `mixpanel`. Produce a report of vulnerabilities, license risks, and recommended version updates.

**Acceptance Criteria**:
- [ ] All dependencies scanned with Sonatype MCP tools
- [ ] Vulnerability report produced with severity ratings
- [ ] Recommended version updates documented
- [ ] Any critical/high vulnerabilities have remediation plan
- [ ] License compatibility confirmed for all dependencies

**Risks**: Upgrading major versions could break API compatibility. Changes should be tested before committing.

---

#### Task 1.3: HTTP Security Headers Audit & Hardening
**Priority**: P1
**Assigned To**: Security Agent
**Dependencies**: None
**TODOs.md Reference**: Section 2.3 (Content Security)
**Description**: The current worker responses use `Access-Control-Allow-Origin: *` everywhere and lack CSP, X-Frame-Options, and other security headers. Audit all response headers and add a centralized header-setting function.

**Implementation approach**:
- Create a `securityHeaders()` utility function that returns a base set of secure headers.
- Add `Content-Security-Policy` for the HTML pages (homepage, markdown viewer).
- Add `X-Content-Type-Options: nosniff` to all responses.
- Add `X-Frame-Options: DENY` to HTML responses.
- Tighten CORS to specific origins where possible (configurable via wrangler.toml env vars).
- Ensure `Strict-Transport-Security` is set on all responses.

**Acceptance Criteria**:
- [ ] All HTML responses include CSP, X-Frame-Options, HSTS headers
- [ ] All responses include X-Content-Type-Options: nosniff
- [ ] CORS is configurable rather than wildcard `*`
- [ ] Security headers applied via centralized utility function
- [ ] No regression in existing functionality

**Risks**: Overly restrictive CSP could break the MUI-styled homepage JavaScript. Test thoroughly.

---

### Track 2: UX & Design Improvements (Design Agent)

#### Task 2.1: Web-Based Paste Creation Overhaul
**Priority**: P1
**Assigned To**: Design Agent
**Dependencies**: None
**TODOs.md Reference**: Section 7.1 (Modern UI redesign)
**Description**: The current homepage (served from `src/muiStyles.ts`) shows documentation and examples but the actual paste creation experience via the web is minimal -- the `/api/upload` and `/api/text` endpoints exist but there is no rich paste creation form on the homepage. Design and implement an inline paste creation form with:
- Text area with syntax highlighting preview
- File drag-and-drop upload zone
- Toggle for one-time paste
- Toggle for password protection (feeds into Task 3.2)
- Expiration time selector (feeds into Task 3.1)
- Copy-to-clipboard for the resulting URL

**Implementation approach**:
- Modify `src/muiStyles.ts` to add a paste creation section to the homepage HTML.
- Use vanilla JavaScript (no framework -- this is a Cloudflare Worker serving HTML).
- Style with the existing MUI CSS variables for consistency.
- The form should POST to `/api/text` or `/api/upload` and display the resulting URL inline.

**Acceptance Criteria**:
- [ ] Homepage includes a functional paste creation form above the documentation
- [ ] Text paste creation works with a text area input
- [ ] File upload works with drag-and-drop and file picker
- [ ] One-time toggle works and is visually clear
- [ ] Expiration selector present (even if backend support comes from Task 3.1)
- [ ] Result URL displayed with one-click copy
- [ ] Responsive design works on mobile
- [ ] Accessible: keyboard navigable, proper labels, sufficient contrast

**Risks**: Adding too much JavaScript to the worker-served HTML could impact load times. Keep it lightweight.

---

#### Task 2.2: Paste Viewer Enhancement
**Priority**: P1
**Assigned To**: Design Agent
**Dependencies**: None
**TODOs.md Reference**: Section 7.1 (Web Interface)
**Description**: When a user views a paste via the web (non-markdown), they currently get raw content with headers. Design a proper paste viewer page that wraps the content in the DedPaste chrome (header, footer) with:
- Syntax highlighting for code pastes (using the already-imported highlight.js)
- Line numbers
- Copy-to-clipboard button
- Raw download link
- Metadata display (creation date, content type, one-time indicator, expiration if applicable)
- For encrypted pastes: a key input field for browser-side decryption (connects to the stubbed `handleWebDecrypt`)

**Implementation approach**:
- For text content types (`text/*`, `application/json`, `application/javascript`), render an HTML page with syntax highlighting instead of serving raw content.
- Add a `?raw=true` parameter (already partially implemented) to bypass the viewer.
- CLI requests (detected by User-Agent or Accept header) should still get raw content for backward compatibility.

**Acceptance Criteria**:
- [ ] Text pastes viewed in browser display in a styled viewer with syntax highlighting
- [ ] Line numbers displayed alongside code
- [ ] Copy-to-clipboard and raw download buttons present
- [ ] Paste metadata displayed (creation time, type, filename)
- [ ] CLI and curl requests still receive raw content (no breaking change)
- [ ] Encrypted paste viewer shows decryption key input field
- [ ] One-time paste warning banner displayed before content

**Risks**: Detecting CLI vs browser reliably can be tricky. Use Accept header (`text/html` preference) as the primary signal.

---

#### Task 2.3: CLI Error Messages & Help Text Audit
**Priority**: P2
**Assigned To**: Design Agent
**Dependencies**: None
**TODOs.md Reference**: Section 7.2 (Interactive improvements)
**Description**: Audit all error messages and help text in the CLI for clarity, actionability, and consistency. Ensure every error message tells the user: (1) what happened, (2) why, and (3) what to do about it. Review `cli/logger.ts` for message formatting consistency.

**Acceptance Criteria**:
- [ ] All error messages follow the "what/why/what-to-do" pattern
- [ ] Help text for every command is complete and includes examples
- [ ] No raw stack traces displayed in normal (non-debug) mode
- [ ] Consistent use of colors and formatting across all CLI output
- [ ] Exit codes are documented and consistent (0 = success, 1 = error, 2 = usage error)

**Risks**: Low risk. This is a polish task with no functional changes.

---

### Track 3: Feature Development (Feature Dev Agent)

#### Task 3.1: Paste Expiration (TTL) System
**Priority**: P0
**Assigned To**: Feature Dev Agent
**Dependencies**: None
**TODOs.md Reference**: Section 4.1 (Automatic cleanup)
**Description**: This is the highest-impact feature missing from DedPaste. Currently, non-one-time pastes live forever. Implement a TTL system that allows pastes to expire after a configurable duration.

**Implementation approach -- Worker side** (`src/index.ts`):
- Extend the `PasteMetadata` type to include `expiresAt?: number` (Unix timestamp in ms).
- Accept an `X-Expires-In` header on upload endpoints with values like `1h`, `1d`, `7d`, `30d`, `never`.
- Accept an `expiresIn` field in the `/api/text` and `/api/upload` JSON/form body.
- On paste retrieval, check `expiresAt` against `Date.now()`. If expired, delete the paste from R2 and return 404 with "This paste has expired."
- Store expiration in KV metadata for efficient lookup.
- Add a scheduled handler (Cloudflare Cron Trigger) to periodically clean up expired pastes from R2.

**Implementation approach -- CLI side** (`cli/index.ts`):
- Add `--expires <duration>` flag to the default command and `send` command.
- Parse durations like `1h`, `6h`, `1d`, `7d`, `30d`.
- Send the parsed duration as `X-Expires-In` header.
- Display expiration info in the paste URL output.

**Acceptance Criteria**:
- [ ] Pastes can be created with an expiration time via CLI (`--expires`) and API (`X-Expires-In` header)
- [ ] Expired pastes return 404 with "This paste has expired" message
- [ ] Expiration metadata stored in R2 custom metadata
- [ ] Web upload form supports expiration selection (when Task 2.1 is complete)
- [ ] Default expiration is "never" (backward compatible)
- [ ] CLI `--expires` flag accepts human-readable durations: `1h`, `6h`, `1d`, `7d`, `30d`
- [ ] Scheduled cleanup handler removes expired pastes from R2 (cron trigger)
- [ ] Unit tests for expiration logic and duration parsing
- [ ] Existing pastes without expiration continue to work forever

**Risks**: Cloudflare Cron Triggers have a minimum interval of 1 minute. Expired pastes may be accessible for up to 1 minute after expiry. The on-access check mitigates this.

---

#### Task 3.2: Password-Protected Pastes
**Priority**: P1
**Assigned To**: Feature Dev Agent
**Dependencies**: Task 1.3 (Security headers -- should be done first or in parallel)
**TODOs.md Reference**: Section 2.3 (Password protection layer)
**Description**: Allow users to add a password to a paste without requiring PGP key management. This is a major differentiator -- most pastebins either have no encryption or require complex key setups. Password protection provides a middle ground: easy to use, still secure.

**Implementation approach -- Worker side**:
- When a paste is created with a password, the CLI/web client derives an AES-256 key from the password using PBKDF2 (100,000 iterations, SHA-256, random 16-byte salt).
- The content is encrypted client-side with AES-256-GCM.
- The salt is stored in paste metadata (it is not secret).
- On retrieval, the worker returns the encrypted content with a header `X-Password-Protected: true` and the salt in `X-Password-Salt`.
- The CLI or web client prompts for the password, derives the key, and decrypts.
- Use a new URL prefix `/p/` to distinguish password-protected pastes (similar to `/e/` for encrypted).

**Implementation approach -- CLI side**:
- Add `--password` flag to create a password-protected paste.
- Prompt for password interactively if `--password` is used without a value.
- On `get`, detect `X-Password-Protected` header and prompt for password.

**Implementation approach -- Web side**:
- On the paste viewer page, if `X-Password-Protected` is true, show a password input form.
- Derive the key in-browser using the Web Crypto API (`crypto.subtle.importKey` + `deriveKey`).
- Decrypt and display the content.

**Acceptance Criteria**:
- [ ] Pastes can be created with `--password` flag (CLI) or password field (web)
- [ ] Password derivation uses PBKDF2 with 100k iterations and random salt
- [ ] Encryption is AES-256-GCM (client-side)
- [ ] Salt stored in paste metadata, password never sent to server
- [ ] CLI prompts for password on retrieval of password-protected pastes
- [ ] Web viewer shows password input form for protected pastes
- [ ] Web decryption works entirely client-side using Web Crypto API
- [ ] Unit tests for PBKDF2 derivation and AES-GCM encrypt/decrypt
- [ ] Password strength validation (minimum 8 characters)

**Risks**: PBKDF2 with 100k iterations may be slow on low-power devices. This is a security/UX tradeoff that should be documented. The Web Crypto API is available in all modern browsers.

---

#### Task 3.3: Paste Deletion Tokens
**Priority**: P1
**Assigned To**: Feature Dev Agent
**Dependencies**: None
**TODOs.md Reference**: Section 3.1 (Paste Management)
**Description**: Currently, non-one-time pastes cannot be deleted by their creator. Implement a deletion token system: when a paste is created, generate a random deletion token, return it to the creator alongside the URL, and provide a DELETE endpoint that accepts the token.

**Implementation approach**:
- On paste creation, generate a 32-character random token.
- Store the token hash (SHA-256) in the paste's KV metadata.
- Return the deletion token to the creator in a `X-Delete-Token` header and in the response body (for API uploads, include it in the JSON response).
- Add a `DELETE /{id}` endpoint that requires the deletion token in `Authorization: Bearer <token>` or `X-Delete-Token` header.
- Verify by hashing the provided token and comparing to the stored hash.
- CLI: display the deletion token after paste creation, and add a `dedpaste delete <url-or-id> --token <token>` command.

**Acceptance Criteria**:
- [ ] Deletion token generated and returned on paste creation
- [ ] Token hash stored in KV metadata (not the raw token)
- [ ] DELETE endpoint validates token and removes paste from R2
- [ ] CLI displays deletion token after creation
- [ ] CLI `delete` command added with `--token` flag
- [ ] Invalid tokens return 403 Forbidden
- [ ] Missing tokens return 401 Unauthorized
- [ ] Deletion of one-time pastes also works
- [ ] Unit tests for token generation, hashing, and validation

**Risks**: Users may lose their deletion tokens. This is by design -- the token is the only way to prove ownership without an auth system.

---

#### Task 3.4: Health & Info API Endpoints
**Priority**: P1
**Assigned To**: Feature Dev Agent
**Dependencies**: None
**TODOs.md Reference**: Section 8.2 (Health checks)
**Description**: Add `/api/health` and `/api/info` endpoints for monitoring and discovery.

**Implementation approach**:
- `GET /api/health`: Returns `{ "status": "ok", "timestamp": "..." }` with a 200 status. Optionally checks R2 and KV connectivity.
- `GET /api/info`: Returns `{ "version": "1.23.2", "features": ["encryption", "one-time", "multipart", "password-protection", "expiration"], "limits": { "maxFileSize": "5GB", "maxPasteSize": "100MB" } }`.

**Acceptance Criteria**:
- [ ] `GET /api/health` returns 200 with status and timestamp
- [ ] `GET /api/info` returns version, feature list, and limits
- [ ] Health check verifies R2 and KV connectivity (optional, with timeout)
- [ ] Response times for health check are under 50ms
- [ ] No sensitive information exposed in either endpoint

**Risks**: None. Low-complexity task.

---

#### Task 3.5: CLI Configuration File Support
**Priority**: P2
**Assigned To**: Feature Dev Agent
**Dependencies**: None
**TODOs.md Reference**: Section 7.2 (Configuration file support)
**Description**: Allow users to set persistent configuration via a `~/.dedpaste/config.json` file. This avoids repeating flags like `--encrypt`, custom API URLs, or preferred expiration times.

**Implementation approach**:
- Define configuration schema in `src/types/index.ts` (the `DedPasteConfig` interface already exists).
- Load config from `~/.dedpaste/config.json` on CLI startup.
- CLI flags override config file values (flags take precedence).
- Add `dedpaste config` command to view/set config values interactively.
- Add `dedpaste config set <key> <value>` and `dedpaste config get <key>`.

Supported config keys:
- `apiUrl` -- Custom API URL (default: `https://paste.d3d.dev`)
- `defaultExpiry` -- Default expiration (e.g., `7d`)
- `defaultEncrypt` -- Always encrypt by default (boolean)
- `copyToClipboard` -- Auto-copy URL to clipboard (boolean)
- `theme` -- CLI color theme

**Acceptance Criteria**:
- [ ] Config file loaded from `~/.dedpaste/config.json`
- [ ] CLI flags override config file values
- [ ] `dedpaste config` command works for viewing and setting values
- [ ] Config schema validated on load (invalid values produce clear warnings)
- [ ] Default values used when no config file exists
- [ ] Config migration path if schema changes in future versions

**Risks**: Need to handle corrupt config files gracefully. Schema validation should warn, not crash.

---

## Sprint Priority Order & Dependencies

```
Week 1 (Parallel Tracks):
  Security:   [1.1 Rate Limiting] ------> [1.2 Dep Audit] ------> [1.3 Headers]
  Design:     [2.1 Web Paste Form] -----> [2.2 Paste Viewer] ---->
  Feature:    [3.1 Expiration/TTL] -----> [3.3 Delete Tokens] --->

Week 2 (Parallel Tracks):
  Security:   [1.3 Headers cont'd] ----> [Review 3.2 crypto]
  Design:     [2.2 Viewer cont'd] ------> [2.3 CLI Error Audit]
  Feature:    [3.2 Password Protect] ---> [3.4 Health API] -------> [3.5 Config File]
```

### Critical Path
The critical path is: **Task 3.1 (Expiration)** and **Task 1.1 (Rate Limiting)** -- these must be completed first as they are P0 and represent the most significant gaps in the service.

### Cross-Agent Dependencies
| Task | Requires Review By | Before Shipping |
|------|--------------------|-----------------|
| 3.1 Expiration | Security Agent (metadata integrity) | Yes |
| 3.2 Password Protection | Security Agent (PBKDF2 params, AES-GCM usage) | Yes, mandatory |
| 3.3 Delete Tokens | Security Agent (token generation, hashing) | Yes, mandatory |
| 2.1 Web Paste Form | Feature Dev (API integration) | After API changes land |
| 2.2 Paste Viewer | Security Agent (XSS prevention in content display) | Yes |
| 1.1 Rate Limiting | Feature Dev (integration into request handler) | Coordinated merge |

---

## Definition of Done (All Tasks)

Every task is considered done when:
1. Code is written following `CLAUDE.md` conventions (2-space indent, camelCase, types everywhere)
2. `npm run build` passes without errors
3. `npm run lint` passes without warnings
4. `npm run format` has been run
5. Unit tests are written and passing for new functionality
6. No `any` types introduced without justification
7. Security-sensitive changes reviewed by Security Agent
8. User-facing changes reviewed by Design Agent
9. Changes work within Cloudflare Workers constraints (no Node.js APIs in worker code)
10. Backward compatibility maintained for existing CLI commands and API endpoints

---

## What We Are NOT Doing This Sprint

To avoid scope creep, the following are explicitly out of scope:
- **Full authentication system** (Section 2.1) -- Too large; rate limiting provides the immediate protection needed.
- **Collaborative editing** (Section 3.2) -- Requires WebSocket/Durable Objects, which is a major architecture change.
- **Service layer refactor** (Section 1.2) -- Important but not user-facing; defer to next sprint.
- **Browser extension / IDE plugins** (Section 3.3) -- Downstream of a stable API; premature now.
- **Mobile app** (Section 9.1) -- P3, not yet warranted.
- **Multi-region deployment** (Section 10.1) -- Cloudflare Workers are already global.
- **Database migration system** (Section 4.1) -- Not needed with R2/KV; applicable if we add D1 later.

---

## Success Metrics for This Sprint

| Metric | Target |
|--------|--------|
| Rate limiting deployed | Yes/No |
| Paste expiration functional | Yes/No |
| Password-protected pastes working | Yes/No |
| Deletion tokens working | Yes/No |
| Web paste creation form live | Yes/No |
| New test files added | >= 4 new test files |
| Security vulnerabilities found and addressed | All critical/high |
| CLI `--expires`, `--password`, `delete` commands | All functional |
| Health endpoint responding | Yes/No |

---

*Sprint plan authored by Team Lead Agent. Last updated: 2026-02-22.*
