// Browser-facing HTML viewer templates for DedPaste.
// These pages are only served when a request's Accept header includes
// text/html (i.e. real browsers); CLI/curl clients always receive raw bytes.

import { getMuiCSS } from './muiStyles';

/**
 * Escapes HTML special characters to prevent XSS.
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Safely embeds a string into a <script> block as JSON.
 * Escapes angle brackets so the value cannot break out of the script context.
 */
function safeJsonEmbed(value: string): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
}

/**
 * Formats a byte count as a human-readable size label.
 * @param bytes Number of bytes
 * @returns Human readable string such as "1.2 KB"
 */
export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return 'unknown size';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ['KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 'B';
  for (const next of units) {
    if (value < 1024) break;
    value = value / 1024;
    unit = next;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${unit}`;
}

/**
 * Highlight.js GitHub-Dark theme used by both the markdown viewer and the
 * universal text viewer so the two pages render code identically.
 */
export function getHljsThemeStyles(): string {
  return `
    .hljs {
      color: #e1e4e8;
      background: #18171c;
    }

    .hljs-doctag,
    .hljs-keyword,
    .hljs-meta .hljs-keyword,
    .hljs-template-tag,
    .hljs-template-variable,
    .hljs-type,
    .hljs-variable.language_ {
      color: #ff7b72;
    }

    .hljs-title,
    .hljs-title.class_,
    .hljs-title.class_.inherited__,
    .hljs-title.function_ {
      color: #d2a8ff;
    }

    .hljs-attr,
    .hljs-attribute,
    .hljs-literal,
    .hljs-meta,
    .hljs-number,
    .hljs-operator,
    .hljs-selector-attr,
    .hljs-selector-class,
    .hljs-selector-id,
    .hljs-variable {
      color: #79c0ff;
    }

    .hljs-meta .hljs-string,
    .hljs-regexp,
    .hljs-string {
      color: #a5d6ff;
    }

    .hljs-built_in,
    .hljs-symbol {
      color: #ffa657;
    }

    .hljs-code,
    .hljs-comment,
    .hljs-formula {
      color: #8b949e;
    }

    .hljs-name,
    .hljs-quote,
    .hljs-selector-pseudo,
    .hljs-selector-tag {
      color: #7ee83f;
    }

    .hljs-subst {
      color: #e1e4e8;
    }

    .hljs-section {
      color: #1f6feb;
      font-weight: bold;
    }

    .hljs-bullet {
      color: #f2cc60;
    }

    .hljs-emphasis {
      color: #e1e4e8;
      font-style: italic;
    }

    .hljs-strong {
      color: #e1e4e8;
      font-weight: bold;
    }

    .hljs-addition {
      color: #aff5b4;
      background-color: #033a16;
    }

    .hljs-deletion {
      color: #ffdcd7;
      background-color: #67060c;
    }
  `;
}

/**
 * Shared page chrome styles (header, footer, buttons) used by every
 * browser-facing viewer page. Mirrors the markdown viewer's visual language
 * built on the MUI dark palette variables.
 */
function getViewerChromeStyles(): string {
  return `
    body {
      margin: 0;
      padding: 0;
      background-color: var(--mui-palette-background-default);
      color: var(--mui-palette-text-primary);
      font-family: 'Inter', 'Roboto', system-ui, -apple-system, sans-serif;
    }

    .header {
      position: sticky;
      top: 0;
      z-index: 10;
      background: var(--mui-palette-background-paper);
      border-bottom: 1px solid var(--mui-palette-divider);
      padding: var(--mui-spacing-2) var(--mui-spacing-3);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
      box-shadow: var(--mui-shadows-2);
    }

    .header-title {
      font-size: 1.25rem;
      font-weight: 500;
      color: var(--mui-palette-text-primary);
      overflow-wrap: anywhere;
    }

    .header-title .brand {
      color: var(--mui-palette-primary-main);
    }

    .paste-info {
      display: flex;
      gap: var(--mui-spacing-1);
      align-items: center;
      flex-wrap: wrap;
      font-size: 0.875rem;
      color: var(--mui-palette-text-secondary);
    }

    .paste-id,
    .meta-chip {
      font-family: 'Roboto Mono', 'Fira Code', monospace;
      background: var(--mui-palette-background-default);
      padding: 4px 8px;
      border-radius: var(--mui-shape-borderRadius);
      border: 1px solid var(--mui-palette-divider);
      white-space: nowrap;
    }

    .one-time-badge {
      background: var(--mui-palette-error-main);
      color: white;
      padding: 4px 8px;
      border-radius: 16px;
      font-weight: 500;
      font-size: 0.75rem;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .container {
      max-width: 1100px;
      margin: 0 auto;
      padding: var(--mui-spacing-4) var(--mui-spacing-3);
    }

    .toolbar {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
    }

    .viewer-button {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background: #2c2b31;
      border: 1px solid #4a4952;
      border-radius: 0.5rem;
      color: #e1e4e8;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .viewer-button:hover {
      background: #4a4952;
      border-color: var(--mui-palette-primary-main);
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    }

    .viewer-button:active {
      transform: translateY(0);
    }

    .viewer-button.copied {
      background: #10b981;
      border-color: #10b981;
      color: #ffffff;
    }

    .viewer-button-icon {
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }

    .footer {
      text-align: center;
      padding: 2rem;
      color: #6b7280;
      font-size: 0.875rem;
    }

    .footer a {
      color: var(--mui-palette-primary-main);
      text-decoration: none;
    }

    .footer a:hover {
      text-decoration: underline;
    }

    @media (max-width: 768px) {
      .header {
        flex-direction: column;
        text-align: center;
      }

      .container {
        padding: 1rem;
      }
    }
  `;
}

/** Copy icon SVG shared by viewer buttons */
const COPY_ICON_SVG = `<svg class="viewer-button-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;

/**
 * Shared clipboard helper script: tries navigator.clipboard first and falls
 * back to a hidden textarea + document.execCommand for older browsers.
 */
function getClipboardScript(): string {
  return `
    function legacyCopy(text) {
      var textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      document.body.appendChild(textarea);
      var ok = false;
      try {
        textarea.select();
        ok = document.execCommand('copy');
      } catch (err) {
        ok = false;
      }
      document.body.removeChild(textarea);
      return ok;
    }

    function copyTextToClipboard(text, onSuccess, onFailure) {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(onSuccess).catch(function () {
          if (legacyCopy(text)) { onSuccess(); } else { onFailure(); }
        });
      } else if (legacyCopy(text)) {
        onSuccess();
      } else {
        onFailure();
      }
    }

    function flashCopied(button, labelSelector, copiedLabel) {
      var label = labelSelector ? button.querySelector(labelSelector) : button;
      var originalText = label.textContent;
      button.classList.add('copied');
      label.textContent = copiedLabel || 'Copied!';
      setTimeout(function () {
        button.classList.remove('copied');
        label.textContent = originalText;
      }, 2000);
    }
  `;
}

/** Common header markup for viewer pages */
function renderHeader(
  titleHtml: string,
  pasteId: string,
  infoChips: string[],
  isOneTime: boolean
): string {
  const chips = infoChips.join('\n      ');
  return `<header class="header">
    <div class="header-title">
      <span class="brand">Ded</span>Paste${titleHtml ? ` &middot; ${titleHtml}` : ''}
    </div>
    <div class="paste-info">
      ${chips}
      <span class="paste-id">ID: ${escapeHtml(pasteId)}</span>
      ${isOneTime ? '<span class="one-time-badge">⚠️ One-Time Paste</span>' : ''}
    </div>
  </header>`;
}

/** Common footer markup for viewer pages */
function renderFooter(rawUrl: string | null): string {
  return `<footer class="footer">
    <p>Served by <a href="https://github.com/anoncam/dedpaste" target="_blank" rel="noopener noreferrer">DedPaste</a></p>
    <p style="margin-top: 0.5rem;">
      ${rawUrl ? `<a href="${escapeHtml(rawUrl)}">View Raw</a> &bull; ` : ''}<a href="/">Create New Paste</a>
    </p>
  </footer>`;
}

/** Options for the universal text/code viewer page */
export interface TextViewerOptions {
  /** Paste ID for display */
  pasteId: string;
  /** Filename if known (used as page title) */
  filename: string;
  /** Content type of the paste */
  contentType: string;
  /** Size of the paste in bytes */
  sizeBytes: number;
  /** Pre-escaped (highlighted or escapeHtml'd) HTML of the paste content */
  highlightedHtml: string;
  /** Number of lines in the original content */
  lineCount: number;
  /** Detected/declared language label */
  language: string;
  /** Whether syntax highlighting was skipped (large paste) */
  highlightingSkipped: boolean;
  /** Whether this is a one-time paste */
  isOneTime: boolean;
}

/**
 * Renders the universal syntax-highlighted viewer page for text-like pastes.
 * The content passed in `highlightedHtml` MUST already be HTML-escaped
 * (highlight.js output or escapeHtml fallback).
 */
export function renderTextViewerPage(options: TextViewerOptions): string {
  const {
    pasteId,
    filename,
    contentType,
    sizeBytes,
    highlightedHtml,
    lineCount,
    language,
    highlightingSkipped,
    isOneTime,
  } = options;

  const title = filename || pasteId;
  const lineNumbers = Array.from({ length: Math.max(lineCount, 1) }, (_, i) => String(i + 1)).join(
    '\n'
  );

  const chips = [
    `<span class="meta-chip">${escapeHtml(contentType)}</span>`,
    `<span class="meta-chip">${escapeHtml(formatSize(sizeBytes))}</span>`,
    `<span class="meta-chip">${escapeHtml(language)}</span>`,
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>${escapeHtml(title)} - DedPaste</title>
  <style>
    ${getMuiCSS()}
    ${getViewerChromeStyles()}
    ${getHljsThemeStyles()}

    .truncation-note {
      background: var(--mui-palette-background-paper);
      border: 1px solid var(--mui-palette-warning-main);
      border-radius: var(--mui-shape-borderRadius);
      color: var(--mui-palette-warning-main);
      padding: 0.75rem 1rem;
      margin-bottom: 1rem;
      font-size: 0.875rem;
    }

    .code-panel {
      background: #18171c;
      border: 1px solid #4a4952;
      border-radius: 0.5rem;
      overflow: hidden;
      box-shadow: var(--mui-shadows-1);
    }

    .code-area {
      display: flex;
      overflow-x: auto;
    }

    .code-area pre {
      margin: 0;
      padding: 1rem 0;
      font-family: 'Fira Code', 'Roboto Mono', 'Courier New', monospace;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .line-numbers {
      flex-shrink: 0;
      text-align: right;
      color: #6b7280;
      background: #1f1e24;
      border-right: 1px solid #4a4952;
      padding-left: 1rem !important;
      padding-right: 0.75rem !important;
      user-select: none;
      position: sticky;
      left: 0;
    }

    .code-content {
      flex: 1;
      padding-left: 1rem !important;
      padding-right: 1rem !important;
      white-space: pre;
    }

    .code-content code {
      background: transparent;
      border: none;
      padding: 0;
      font-family: inherit;
      font-size: inherit;
      line-height: inherit;
      color: #f3f4f6;
    }
  </style>
</head>
<body>
  ${renderHeader(escapeHtml(title), pasteId, chips, isOneTime)}

  <main class="container">
    <div class="toolbar">
      <button class="viewer-button" id="copy-all-button" onclick="copyAllContent()" title="Copy the entire paste">
        ${COPY_ICON_SVG}
        <span class="viewer-button-label">Copy All</span>
      </button>
      <a class="viewer-button" href="?raw=true" title="View the raw paste content">View Raw</a>
      <a class="viewer-button" href="?raw=true&amp;download=true" title="Download the paste as a file">Download</a>
    </div>
    ${
      highlightingSkipped
        ? `<div class="truncation-note">⚠️ Syntax highlighting was skipped because this paste is larger than 500 KB. Showing plain text.</div>`
        : ''
    }
    <div class="code-panel">
      <div class="code-area">
        <pre class="line-numbers" aria-hidden="true">${lineNumbers}</pre>
        <pre class="code-content"><code id="paste-content" class="hljs language-${escapeHtml(language)}">${highlightedHtml}</code></pre>
      </div>
    </div>
  </main>

  ${renderFooter('?raw=true')}

  <script>
    ${getClipboardScript()}

    function copyAllContent() {
      var button = document.getElementById('copy-all-button');
      var code = document.getElementById('paste-content');
      if (!button || !code) return;
      var text = code.textContent || code.innerText || '';
      copyTextToClipboard(text, function () {
        flashCopied(button, '.viewer-button-label');
      }, function () {
        alert('Failed to copy. Please select the text and copy manually.');
      });
    }
  </script>
</body>
</html>`;
}

/** Options for the encrypted paste landing page */
export interface EncryptedLandingOptions {
  /** Paste ID for display */
  pasteId: string;
  /** Full canonical paste URL (no query string) used in the CLI command */
  pasteUrl: string;
  /** Whether this is also a one-time paste */
  isOneTime: boolean;
}

/**
 * Renders the landing page shown to browsers for encrypted pastes (/e/<id>).
 * Explains that decryption is client-side and shows the CLI command to use.
 */
export function renderEncryptedLandingPage(options: EncryptedLandingOptions): string {
  const { pasteId, pasteUrl, isOneTime } = options;
  const cliCommand = `dedpaste get ${pasteUrl}`;
  const installCommand = 'npm install -g dedpaste';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>Encrypted Paste - DedPaste</title>
  <style>
    ${getMuiCSS()}
    ${getViewerChromeStyles()}

    .landing-card {
      max-width: 640px;
      margin: var(--mui-spacing-6) auto;
      background: var(--mui-palette-background-paper);
      border: 1px solid var(--mui-palette-divider);
      border-radius: 0.5rem;
      padding: var(--mui-spacing-4);
      box-shadow: var(--mui-shadows-2);
      text-align: center;
    }

    .landing-icon {
      font-size: 3rem;
      margin-bottom: 0.5rem;
    }

    .landing-card h1 {
      font-size: 1.5rem;
      font-weight: 600;
      margin: 0 0 1rem;
      color: var(--mui-palette-text-primary);
    }

    .landing-card p {
      color: var(--mui-palette-text-secondary);
      line-height: 1.7;
      margin: 0 0 1rem;
    }

    .one-time-note {
      background: rgba(244, 67, 54, 0.1);
      border: 1px solid var(--mui-palette-error-main);
      border-radius: var(--mui-shape-borderRadius);
      color: var(--mui-palette-error-main);
      padding: 0.75rem 1rem;
      margin-bottom: 1rem;
      font-size: 0.875rem;
      text-align: left;
    }

    .command-block {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: #18171c;
      border: 1px solid #4a4952;
      border-radius: 0.5rem;
      padding: 0.75rem 1rem;
      margin: 0 0 1rem;
      text-align: left;
    }

    .command-block code {
      flex: 1;
      font-family: 'Fira Code', 'Roboto Mono', monospace;
      font-size: 0.875rem;
      color: #a5d6ff;
      overflow-x: auto;
      white-space: nowrap;
      background: transparent;
      border: none;
    }

    .command-label {
      text-align: left;
      font-size: 0.8125rem;
      color: var(--mui-palette-text-secondary);
      margin: 0 0 0.25rem;
    }

    .raw-link {
      display: inline-block;
      margin-top: 0.5rem;
      font-size: 0.875rem;
      color: var(--mui-palette-text-secondary);
    }

    .raw-link a {
      color: var(--mui-palette-primary-main);
      text-decoration: none;
    }

    .raw-link a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  ${renderHeader('Encrypted Paste', pasteId, [], isOneTime)}

  <main class="container">
    <div class="landing-card">
      <div class="landing-icon">🔐</div>
      <h1>This paste is end-to-end encrypted</h1>
      <p>
        The server only stores ciphertext &mdash; it never sees the plaintext or
        any decryption keys. Decryption happens entirely on your machine using
        the DedPaste CLI.
      </p>
      ${
        isOneTime
          ? `<div class="one-time-note">⚠️ This is also a <strong>one-time paste</strong>: it will be permanently destroyed after the first time it is retrieved. Viewing this page does not consume it.</div>`
          : ''
      }
      <p class="command-label">Retrieve and decrypt with the CLI:</p>
      <div class="command-block">
        <code id="cli-command">${escapeHtml(cliCommand)}</code>
        <button class="viewer-button" id="copy-command-button" onclick="copyCommand('cli-command', this)" title="Copy command">
          ${COPY_ICON_SVG}
          <span class="viewer-button-label">Copy</span>
        </button>
      </div>
      <p class="command-label">Don't have the CLI yet?</p>
      <div class="command-block">
        <code id="install-command">${escapeHtml(installCommand)}</code>
        <button class="viewer-button" id="copy-install-button" onclick="copyCommand('install-command', this)" title="Copy command">
          ${COPY_ICON_SVG}
          <span class="viewer-button-label">Copy</span>
        </button>
      </div>
      <p class="raw-link"><a href="?raw=true">View raw encrypted payload</a></p>
    </div>
  </main>

  ${renderFooter(null)}

  <script>
    ${getClipboardScript()}

    function copyCommand(codeId, button) {
      var code = document.getElementById(codeId);
      if (!code || !button) return;
      copyTextToClipboard(code.textContent || '', function () {
        flashCopied(button, '.viewer-button-label');
      }, function () {
        alert('Failed to copy. Please select the command and copy manually.');
      });
    }
  </script>
</body>
</html>`;
}

/** Options for the one-time paste interstitial page */
export interface OneTimeInterstitialOptions {
  /** Paste ID for display */
  pasteId: string;
  /** Filename if known */
  filename: string;
  /** Content type of the paste */
  contentType: string;
  /** Size of the paste in bytes */
  sizeBytes: number;
}

/**
 * Renders the confirmation interstitial for one-time pastes. The paste is NOT
 * consumed by serving this page; the reveal button fetches the same URL with
 * `?confirm=true&raw=true`, which triggers the normal consume-and-delete flow.
 * Because link-unfurling bots don't execute JavaScript, they can no longer
 * burn one-time pastes before the recipient opens them.
 */
export function renderOneTimeInterstitialPage(options: OneTimeInterstitialOptions): string {
  const { pasteId, filename, contentType, sizeBytes } = options;
  const downloadName = filename || `${pasteId}.bin`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>One-Time Paste - DedPaste</title>
  <style>
    ${getMuiCSS()}
    ${getViewerChromeStyles()}

    .interstitial-card {
      max-width: 640px;
      margin: var(--mui-spacing-6) auto;
      background: var(--mui-palette-background-paper);
      border: 1px solid var(--mui-palette-error-main);
      border-radius: 0.5rem;
      padding: var(--mui-spacing-4);
      box-shadow: var(--mui-shadows-2);
      text-align: center;
    }

    .interstitial-icon {
      font-size: 3rem;
      margin-bottom: 0.5rem;
    }

    .interstitial-card h1 {
      font-size: 1.5rem;
      font-weight: 600;
      margin: 0 0 1rem;
      color: var(--mui-palette-text-primary);
    }

    .interstitial-card p {
      color: var(--mui-palette-text-secondary);
      line-height: 1.7;
      margin: 0 0 1rem;
    }

    .reveal-button {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      background: var(--mui-palette-error-main);
      border: 1px solid var(--mui-palette-error-main);
      border-radius: 0.5rem;
      color: #ffffff;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .reveal-button:hover:not(:disabled) {
      filter: brightness(1.1);
      transform: translateY(-1px);
    }

    .reveal-button:disabled {
      opacity: 0.6;
      cursor: wait;
    }

    .reveal-error {
      display: none;
      background: rgba(244, 67, 54, 0.1);
      border: 1px solid var(--mui-palette-error-main);
      border-radius: var(--mui-shape-borderRadius);
      color: var(--mui-palette-error-main);
      padding: 0.75rem 1rem;
      margin-top: 1rem;
      font-size: 0.875rem;
    }

    #revealed-section {
      display: none;
    }

    .revealed-panel {
      background: #18171c;
      border: 1px solid #4a4952;
      border-radius: 0.5rem;
      overflow: hidden;
      box-shadow: var(--mui-shadows-1);
      text-align: left;
    }

    .revealed-panel pre {
      margin: 0;
      padding: 1rem;
      overflow-x: auto;
      font-family: 'Fira Code', 'Roboto Mono', 'Courier New', monospace;
      font-size: 0.875rem;
      line-height: 1.5;
      color: #f3f4f6;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .destroyed-note {
      background: var(--mui-palette-background-paper);
      border: 1px solid var(--mui-palette-warning-main);
      border-radius: var(--mui-shape-borderRadius);
      color: var(--mui-palette-warning-main);
      padding: 0.75rem 1rem;
      margin-bottom: 1rem;
      font-size: 0.875rem;
      text-align: left;
    }
  </style>
</head>
<body>
  ${renderHeader(
    escapeHtml(filename || 'One-Time Paste'),
    pasteId,
    [
      `<span class="meta-chip">${escapeHtml(contentType)}</span>`,
      `<span class="meta-chip">${escapeHtml(formatSize(sizeBytes))}</span>`,
    ],
    true
  )}

  <main class="container">
    <div class="interstitial-card" id="reveal-warning">
      <div class="interstitial-icon">⚠️</div>
      <h1>One-time paste: viewing will permanently destroy it</h1>
      <p>
        This paste self-destructs the first time its content is retrieved.
        Opening this page has <strong>not</strong> consumed it yet. Click the
        button below to reveal the content &mdash; after that, it is gone
        forever.
      </p>
      <button class="reveal-button" id="reveal-button" onclick="revealPaste()">
        🔥 Reveal (and destroy) this paste
      </button>
      <div class="reveal-error" id="reveal-error"></div>
    </div>

    <div id="revealed-section">
      <div class="destroyed-note">
        🔥 This one-time paste has now been destroyed on the server. Copy the
        content below before leaving this page &mdash; it cannot be retrieved
        again.
      </div>
      <div class="toolbar">
        <button class="viewer-button" id="copy-all-button" onclick="copyRevealedContent()" title="Copy the entire paste">
          ${COPY_ICON_SVG}
          <span class="viewer-button-label">Copy All</span>
        </button>
      </div>
      <div class="revealed-panel">
        <pre id="paste-content"></pre>
      </div>
    </div>
  </main>

  ${renderFooter(null)}

  <script>
    ${getClipboardScript()}

    var downloadFilename = ${safeJsonEmbed(downloadName)};

    function showRevealError(message) {
      var errorBox = document.getElementById('reveal-error');
      errorBox.textContent = message;
      errorBox.style.display = 'block';
      var button = document.getElementById('reveal-button');
      button.disabled = false;
      button.textContent = '🔥 Reveal (and destroy) this paste';
    }

    async function revealPaste() {
      var button = document.getElementById('reveal-button');
      button.disabled = true;
      button.textContent = 'Retrieving…';
      try {
        // The confirm+raw request performs the server's consume-and-delete
        // flow and returns the raw content (Accept is not text/html).
        var response = await fetch(window.location.pathname + '?confirm=true&raw=true', {
          headers: { 'Accept': 'application/octet-stream' },
          cache: 'no-store'
        });
        if (!response.ok) {
          showRevealError('This paste is no longer available. It may have already been viewed or expired.');
          return;
        }
        var contentType = (response.headers.get('Content-Type') || '').toLowerCase();
        var isText = contentType.indexOf('text/') === 0 ||
          contentType.indexOf('application/json') !== -1 ||
          contentType.indexOf('application/xml') !== -1 ||
          contentType.indexOf('application/javascript') !== -1;
        if (isText) {
          var text = await response.text();
          // textContent assignment is XSS-safe: the browser treats it as text.
          document.getElementById('paste-content').textContent = text;
          document.getElementById('reveal-warning').style.display = 'none';
          document.getElementById('revealed-section').style.display = 'block';
        } else {
          var blob = await response.blob();
          var url = URL.createObjectURL(blob);
          var link = document.createElement('a');
          link.href = url;
          link.download = downloadFilename;
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
          document.getElementById('paste-content').textContent =
            'Binary content downloaded as "' + downloadFilename + '". The paste has been destroyed on the server.';
          document.getElementById('reveal-warning').style.display = 'none';
          document.getElementById('revealed-section').style.display = 'block';
        }
      } catch (err) {
        showRevealError('Failed to retrieve the paste: ' + (err && err.message ? err.message : 'unknown error'));
      }
    }

    function copyRevealedContent() {
      var button = document.getElementById('copy-all-button');
      var pre = document.getElementById('paste-content');
      if (!button || !pre) return;
      copyTextToClipboard(pre.textContent || '', function () {
        flashCopied(button, '.viewer-button-label');
      }, function () {
        alert('Failed to copy. Please select the text and copy manually.');
      });
    }
  </script>
</body>
</html>`;
}

/** Options for styled error pages */
export interface ErrorPageOptions {
  /** Page heading, e.g. "Paste not found" */
  title: string;
  /** Explanatory message shown under the heading */
  message: string;
}

/**
 * Renders a styled error page (e.g. 404) for browser clients.
 * Non-browser clients keep receiving plain-text errors.
 */
export function renderErrorPage(options: ErrorPageOptions): string {
  const { title, message } = options;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>${escapeHtml(title)} - DedPaste</title>
  <style>
    ${getMuiCSS()}
    ${getViewerChromeStyles()}

    .error-card {
      max-width: 560px;
      margin: var(--mui-spacing-8) auto;
      background: var(--mui-palette-background-paper);
      border: 1px solid var(--mui-palette-divider);
      border-radius: 0.5rem;
      padding: var(--mui-spacing-4);
      box-shadow: var(--mui-shadows-2);
      text-align: center;
    }

    .error-icon {
      font-size: 3rem;
      margin-bottom: 0.5rem;
    }

    .error-card h1 {
      font-size: 1.5rem;
      font-weight: 600;
      margin: 0 0 1rem;
      color: var(--mui-palette-text-primary);
    }

    .error-card p {
      color: var(--mui-palette-text-secondary);
      line-height: 1.7;
      margin: 0 0 1.5rem;
    }

    .home-link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1.25rem;
      background: var(--mui-palette-primary-main);
      border-radius: 0.5rem;
      color: var(--mui-palette-primary-contrastText);
      font-weight: 600;
      text-decoration: none;
      transition: filter 0.2s;
    }

    .home-link:hover {
      filter: brightness(1.1);
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="header-title">
      <span class="brand">Ded</span>Paste
    </div>
  </header>

  <main class="container">
    <div class="error-card">
      <div class="error-icon">🪦</div>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      <a class="home-link" href="/">Back to homepage</a>
    </div>
  </main>

  ${renderFooter(null)}
</body>
</html>`;
}
