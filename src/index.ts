import { marked } from "marked";
import hljs from "highlight.js/lib/core";
// Import only the languages we want to support to keep bundle size down
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import json from "highlight.js/lib/languages/json";
import xml from "highlight.js/lib/languages/xml"; // HTML, XML
import css from "highlight.js/lib/languages/css";
import markdown from "highlight.js/lib/languages/markdown";
import bash from "highlight.js/lib/languages/bash";
import yaml from "highlight.js/lib/languages/yaml";
import sql from "highlight.js/lib/languages/sql";
import java from "highlight.js/lib/languages/java";
import cpp from "highlight.js/lib/languages/cpp";
import go from "highlight.js/lib/languages/go";
import rust from "highlight.js/lib/languages/rust";
import ruby from "highlight.js/lib/languages/ruby";
import php from "highlight.js/lib/languages/php";

// Import MUI styles
import { getHomepageHTML, getMuiCSS, getMarkdownStyles } from "./muiStyles";

// Import analytics
import { createAnalytics, WorkerAnalytics } from "./analytics";

// Register languages with highlight.js
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("json", json);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("html", xml); // HTML is handled by XML
hljs.registerLanguage("css", css);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash); // Shell alias
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("sql", sql);
hljs.registerLanguage("java", java);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("c++", cpp); // C++ alias
hljs.registerLanguage("go", go);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("ruby", ruby);
hljs.registerLanguage("php", php);

// Define the environment interface for Cloudflare Workers
type Env = {
  PASTE_BUCKET: R2Bucket;
  PASTE_METADATA?: KVNamespace; // Optional KV namespace for metadata storage
};

type PasteMetadata = {
  contentType: string;
  isOneTime: boolean;
  createdAt: number;
  filename?: string; // Optional filename for detecting markdown files
  // We don't need to store encryption info in metadata
  // since the server doesn't need to know if content is encrypted
  // The URL path (/e/) is sufficient to indicate encryption
};

// For one-time pastes, we'll use a completely different key format
// with a prefix to make identifying them clear
const ONE_TIME_PREFIX = "onetime-";

// Generate a random ID for the paste
function generateId(length = 8): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Create a tracking system for one-time pastes to ensure they're only accessed once
// This will help prevent issues with caching and edge replication lag
interface ViewedPasteTracker {
  [key: string]: {
    viewedAt: number;
    deleted: boolean;
    attempts: number;
  };
}

// Using a more structured tracking mechanism for better state management
const viewedPastes: ViewedPasteTracker = {};

// KV namespace key for tracking viewed pastes (to persist across worker restarts/instances)
const VIEWED_PASTES_KEY = "viewed_pastes_registry";

// Helper function to safely parse JSON with a default value
function safeJsonParse<T>(jsonString: string | null, defaultValue: T): T {
  if (!jsonString) return defaultValue;
  try {
    return JSON.parse(jsonString) as T;
  } catch (e) {
    console.error("Error parsing JSON:", e);
    return defaultValue;
  }
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    // Initialize analytics
    const analytics = createAnalytics(env);

    // Initialize viewedPastes from KV store if available (completely optional enhancement)
    try {
      if (env.PASTE_METADATA) {
        const storedViewedPastes =
          await env.PASTE_METADATA.get(VIEWED_PASTES_KEY);
        if (storedViewedPastes) {
          const parsedPastes = safeJsonParse<ViewedPasteTracker>(
            storedViewedPastes,
            {},
          );
          // Merge with any in-memory pastes (newer ones take precedence)
          Object.assign(viewedPastes, parsedPastes);
        }
      }
    } catch (error) {
      // Log but continue without error - KV is an enhancement, not a requirement
      console.log("[KV] Optional paste metadata storage not available:", error);
    }
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle OPTIONS requests for CORS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // Upload a new paste
    if (request.method === "POST") {
      // Handle regular uploads
      if (path === "/upload" || path === "/temp") {
        const isOneTime = path === "/temp";
        return await handleUpload(request, env, isOneTime, false, analytics);
      }

      // Handle encrypted uploads
      if (path === "/e/upload" || path === "/e/temp") {
        const isOneTime = path === "/e/temp";
        return await handleUpload(request, env, isOneTime, true, analytics);
      }

      return new Response("Not found", { status: 404 });
    }

    // Get a paste
    if (request.method === "GET") {
      // Handle regular pastes
      const regularMatch = path.match(/^\/([a-zA-Z0-9]{8})$/);
      if (regularMatch) {
        const id = regularMatch[1];
        return await handleGet(id, env, ctx, false, request);
      }

      // Handle encrypted pastes
      const encryptedMatch = path.match(/^\/e\/([a-zA-Z0-9]{8})$/);
      if (encryptedMatch) {
        const id = encryptedMatch[1];
        return await handleGet(id, env, ctx, true, request);
      }

      // Try to serve styles.css directly if [site] configuration doesn't work
      if (path === "/styles.css") {
        // Serve MUI CSS instead of Tailwind
        const cssContent = getMuiCSS();

        console.log("Serving MUI CSS file");
        return new Response(cssContent, {
          headers: {
            "Content-Type": "text/css",
            "Cache-Control": "public, max-age=86400",
          },
        });
      }

      // Serve the HTML homepage
      if (path === "/") {
        // Track homepage view
        await analytics.trackHomepageView(request);

        return new Response(generateHomepage(url.origin), {
          headers: {
            "Content-Type": "text/html",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      return new Response("Not found", { status: 404 });
    }

    return new Response("Method not allowed", { status: 405 });
  },
};

function generateHomepage(origin: string): string {
  // Use the MUI styled homepage HTML
  return getHomepageHTML();
  /* REMOVED TAILWIND HTML - Replaced with MUI version from muiStyles.ts
<html lang="en">
<head>
  <title>DedPaste - Secure Pastebin Service</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="DedPaste - A secure pastebin service with end-to-end encryption, PGP integration, and CLI client">
  <link rel="stylesheet" href="/styles.css">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&display=swap">
</head>
<body class="bg-dark-900 text-gray-100 min-h-screen">
  <header class="border-b border-dark-700 py-6">
    <div class="container mx-auto px-4 md:px-6">
      <div class="flex items-center justify-between">
        <h1 class="text-3xl md:text-4xl font-bold text-white">
          <span class="text-primary-400">Ded</span>Paste
        </h1>
        <div class="flex items-center space-x-4">
          <a href="https://github.com/anoncam/dedpaste" target="_blank" class="btn-secondary">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="w-5 h-5 mr-2">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
            </svg>
            GitHub
          </a>
          <a href="#install" class="btn-primary">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" class="w-5 h-5 mr-2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Install
          </a>
        </div>
      </div>
    </div>
  </header>

  <main class="container mx-auto px-4 md:px-6 py-8">
    <section class="mb-16">
      <div class="max-w-3xl mx-auto text-center mb-12">
        <h2 class="text-3xl md:text-4xl font-bold text-white mb-4">Secure Pastebin with Advanced Encryption</h2>
        <p class="text-xl text-gray-300">A powerful CLI tool for sharing text and files with end-to-end encryption, PGP support, and one-time pastes.</p>
      </div>

      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div class="card">
          <div class="mb-4">
            <span class="feature-tag">End-to-End Encryption</span>
          </div>
          <h3 class="text-xl font-semibold text-white mb-2">Keep Your Content Private</h3>
          <p class="text-gray-300">All encryption happens client-side. The server never sees your unencrypted content or keys.</p>
        </div>
        
        <div class="card">
          <div class="mb-4">
            <span class="feature-tag">PGP Integration</span>
          </div>
          <h3 class="text-xl font-semibold text-white mb-2">Use Your Existing Keys</h3>
          <p class="text-gray-300">Leverage PGP keys from keyservers, GPG keyring, or Keybase for trusted communications.</p>
        </div>
        
        <div class="card">
          <div class="mb-4">
            <span class="feature-tag">One-Time Pastes</span>
          </div>
          <h3 class="text-xl font-semibold text-white mb-2">Self-Destructing Content</h3>
          <p class="text-gray-300">Create pastes that automatically delete after being viewed once.</p>
        </div>
        
        <div class="card">
          <div class="mb-4">
            <span class="feature-tag">Binary Support</span>
          </div>
          <h3 class="text-xl font-semibold text-white mb-2">Beyond Just Text</h3>
          <p class="text-gray-300">Upload and share binary files with proper content type detection.</p>
        </div>
        
        <div class="card">
          <div class="mb-4">
            <span class="feature-tag">Friend-to-Friend</span>
          </div>
          <h3 class="text-xl font-semibold text-white mb-2">Secure Sharing</h3>
          <p class="text-gray-300">Easily manage keys for your friends and encrypt content specifically for them.</p>
        </div>
        
        <div class="card">
          <div class="mb-4">
            <span class="feature-tag">CLI Power</span>
          </div>
          <h3 class="text-xl font-semibold text-white mb-2">Advanced Scripting</h3>
          <p class="text-gray-300">Command-line interface for easy integration with your existing scripts and workflows.</p>
        </div>
      </div>
    </section>

    <section id="install" class="mb-16">
      <div class="max-w-3xl mx-auto">
        <h2 class="text-2xl md:text-3xl font-bold text-white mb-6 pb-2 border-b border-dark-700">Installation</h2>
        
        <div class="mb-8">
          <h3 class="text-xl font-semibold text-white mb-4">Using npm (recommended)</h3>
          <pre><code>npm install -g dedpaste</code></pre>
        </div>
        
        <div class="mb-8">
          <h3 class="text-xl font-semibold text-white mb-4">From source</h3>
          <pre><code>git clone https://github.com/anoncam/dedpaste.git
cd dedpaste
npm install
npm link</code></pre>
        </div>
      </div>
    </section>

    <section class="mb-16">
      <div class="max-w-4xl mx-auto">
        <h2 class="text-2xl md:text-3xl font-bold text-white mb-6 pb-2 border-b border-dark-700">Quick Start Examples</h2>
        
        <div class="grid md:grid-cols-2 gap-6 mb-8">
          <div class="card">
            <h3 class="text-xl font-semibold text-white mb-4">Basic Usage</h3>
            <pre><code># Create a paste from stdin
echo "Hello, World!" | dedpaste

# Create a paste from a file
dedpaste < file.txt

# Create a one-time paste
echo "Secret content" | dedpaste --temp

# Specify file explicitly
dedpaste --file path/to/file.txt</code></pre>
          </div>
          
          <div class="card">
            <h3 class="text-xl font-semibold text-white mb-4">Encryption</h3>
            <pre><code># Generate your key pair first
dedpaste keys --gen-key

# Create encrypted paste
echo "Secret data" | dedpaste --encrypt

# Encrypt for a friend
echo "For Alice" | dedpaste send --encrypt --for alice

# Use PGP encryption
echo "PGP Secret" | dedpaste send --encrypt --for user@example.com --pgp</code></pre>
          </div>
        </div>
        
        <div class="grid md:grid-cols-2 gap-6">
          <div class="card">
            <h3 class="text-xl font-semibold text-white mb-4">Key Management</h3>
            <pre><code># Enhanced interactive key management (recommended)
dedpaste keys:enhanced

# List all your keys
dedpaste keys --list

# Add a friend's public key
dedpaste keys --add-friend alice --key-file alice.pem

# Add a PGP key from keyservers
dedpaste keys --pgp-key user@example.com

# Add a Keybase user's key
dedpaste keys --keybase username</code></pre>
          </div>
          
          <div class="card">
            <h3 class="text-xl font-semibold text-white mb-4">Retrieving Pastes</h3>
            <pre><code># Get and display a paste
dedpaste get https://paste.d3d.dev/AbCdEfGh

# Get and decrypt an encrypted paste
dedpaste get https://paste.d3d.dev/e/AbCdEfGh

# Use a specific key file
dedpaste get https://paste.d3d.dev/e/AbCdEfGh --key-file private.pem</code></pre>
          </div>
        </div>
      </div>
    </section>

    <section class="mb-16">
      <div class="max-w-4xl mx-auto">
        <h2 class="text-2xl md:text-3xl font-bold text-white mb-6 pb-2 border-b border-dark-700">Troubleshooting</h2>
        
        <div class="space-y-6">
          <div class="card">
            <h3 class="text-xl font-semibold text-white mb-4">Common PGP Errors</h3>
            <div class="space-y-4">
              <div>
                <p class="text-danger font-semibold mb-1">Error: PGP encryption requires a recipient</p>
                <p class="text-gray-300">Always specify a recipient when using PGP encryption:</p>
                <pre><code>echo "secret" | dedpaste send --encrypt --for user@example.com --pgp</code></pre>
              </div>
              
              <div>
                <p class="text-danger font-semibold mb-1">Error: Failed to find PGP key for recipient</p>
                <p class="text-gray-300">Make sure you've added the recipient's PGP key first:</p>
                <pre><code>dedpaste keys --pgp-key user@example.com</code></pre>
              </div>
            </div>
          </div>
          
          <div class="card">
            <h3 class="text-xl font-semibold text-white mb-4">Key Management Issues</h3>
            <div class="space-y-4">
              <div>
                <p class="text-danger font-semibold mb-1">Error: No personal key found</p>
                <p class="text-gray-300">Generate your key pair first:</p>
                <pre><code>dedpaste keys --gen-key</code></pre>
              </div>
              
              <div>
                <p class="text-danger font-semibold mb-1">Error: Friend not found in key database</p>
                <p class="text-gray-300">Add the friend's key before encrypting for them:</p>
                <pre><code>dedpaste keys --add-friend name --key-file path/to/key.pem</code></pre>
              </div>
            </div>
          </div>
          
          <div class="card">
            <h3 class="text-xl font-semibold text-white mb-4">CLI Parameter Issues</h3>
            <div class="space-y-4">
              <div>
                <p class="text-danger font-semibold mb-1">Error: File not found with --file flag</p>
                <p class="text-gray-300">Double-check the file path and use quotes for paths with spaces:</p>
                <pre><code>dedpaste --file "path/to/my file.txt"</code></pre>
              </div>
              
              <div>
                <p class="text-danger font-semibold mb-1">Error: --for is required when using --pgp</p>
                <p class="text-gray-300">PGP encryption always requires specifying a recipient:</p>
                <pre><code>dedpaste send --encrypt --for recipient@example.com --pgp</code></pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="mb-16">
      <div class="max-w-3xl mx-auto">
        <h2 class="text-2xl md:text-3xl font-bold text-white mb-6 pb-2 border-b border-dark-700">API Usage</h2>
        
        <pre><code># Post content
curl -X POST -H "Content-Type: text/plain" --data "Your content here" ${origin}/upload

# Post one-time content
curl -X POST -H "Content-Type: text/plain" --data "Your content here" ${origin}/temp

# Post encrypted content (client-side encryption)
curl -X POST -H "Content-Type: text/plain" --data "Your encrypted content" ${origin}/e/upload

# Post encrypted one-time content
curl -X POST -H "Content-Type: text/plain" --data "Your encrypted content" ${origin}/e/temp

# Get content
curl ${origin}/{paste-id}

# Get encrypted content (requires client-side decryption)
curl ${origin}/e/{paste-id}</code></pre>
      </div>
    </section>
  </main>

  <footer class="bg-dark-800 border-t border-dark-700 py-8">
    <div class="container mx-auto px-4 md:px-6">
      <div class="grid md:grid-cols-2 gap-8">
        <div>
          <h3 class="text-xl font-semibold text-white mb-4">DedPaste</h3>
          <p class="text-gray-300 mb-4">A secure pastebin service with end-to-end encryption and advanced PGP integration.</p>
          <p class="text-gray-400">&copy; ${new Date().getFullYear()} - ISC License</p>
        </div>
        
        <div>
          <h3 class="text-xl font-semibold text-white mb-4">Resources</h3>
          <ul class="space-y-2">
            <li><a href="https://github.com/anoncam/dedpaste" class="text-primary-400 hover:text-primary-300">GitHub Repository</a></li>
            <li><a href="https://github.com/anoncam/dedpaste/issues" class="text-primary-400 hover:text-primary-300">Report Issues</a></li>
            <li><a href="https://github.com/anoncam/dedpaste#contributing" class="text-primary-400 hover:text-primary-300">Contributing Guide</a></li>
            <li><a href="https://www.npmjs.com/package/dedpaste" class="text-primary-400 hover:text-primary-300">NPM Package</a></li>
          </ul>
        </div>
      </div>
    </div>
  */
}

async function handleUpload(
  request: Request,
  env: Env,
  isOneTime: boolean,
  isEncrypted: boolean,
  analytics?: WorkerAnalytics,
): Promise<Response> {
  const contentType = request.headers.get("Content-Type") || "text/plain";
  const content = await request.arrayBuffer();

  // Check if the content is empty
  if (content.byteLength === 0) {
    return new Response("Content cannot be empty", { status: 400 });
  }

  // Generate a unique ID for the paste
  let id = generateId();

  // Ensure encrypted content is always stored with the correct content type
  // This fixes issues with one-time encrypted pastes
  const adjustedContentType = isEncrypted ? "application/json" : contentType;

  // For one-time pastes, use a completely different storage strategy with a prefix
  if (isOneTime) {
    // Add a prefix to clearly identify one-time pastes
    const storageKey = `${ONE_TIME_PREFIX}${id}`;

    // Create the metadata for the paste
    const metadata: PasteMetadata = {
      contentType: adjustedContentType,
      isOneTime: true, // Always true for this storage path
      createdAt: Date.now(),
    };

    // Store the content in R2 with the prefixed key
    await env.PASTE_BUCKET.put(storageKey, content, {
      customMetadata: metadata as any,
    });

    console.log(
      `Created one-time paste with storage key ${storageKey}, isEncrypted=${isEncrypted}`,
    );
  } else {
    // Regular paste - standard storage path
    // Create the metadata for the paste
    const metadata: PasteMetadata = {
      contentType: adjustedContentType,
      isOneTime: false, // Always false for this storage path
      createdAt: Date.now(),
    };

    // Store the content in R2 with metadata
    await env.PASTE_BUCKET.put(id, content, {
      customMetadata: metadata as any,
    });

    console.log(`Created regular paste ${id}, isEncrypted=${isEncrypted}`);
  }

  const baseUrl = new URL(request.url).origin;
  // Generate URL with /e/ prefix for encrypted pastes
  const pasteUrl = isEncrypted ? `${baseUrl}/e/${id}` : `${baseUrl}/${id}`;

  // Track paste creation
  if (analytics) {
    await analytics.trackPasteCreated(request, {
      is_encrypted: isEncrypted,
      is_one_time: isOneTime,
      content_type: contentType,
      size_bytes: content.byteLength,
    });
  }

  // Return the paste URL - we always use the unprefixed ID in the URL
  return new Response(pasteUrl, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "text/plain",
    },
  });
}

async function handleGet(
  id: string,
  env: Env,
  ctx: ExecutionContext,
  isEncrypted: boolean,
  request: Request,
): Promise<Response> {
  // Check for raw parameter to bypass markdown rendering
  const url = new URL(request.url);
  const wantsRaw = url.searchParams.get("raw") === "true";
  // First, check if this is a one-time paste by trying to get it with the one-time prefix
  const oneTimeKey = `${ONE_TIME_PREFIX}${id}`;
  console.log(
    `[GET] Checking for one-time paste with key: ${oneTimeKey}, isEncrypted=${isEncrypted}`,
  );

  // Add onlyIf condition to bust caches
  const oneTimePaste = await env.PASTE_BUCKET.get(oneTimeKey);

  // If we found a one-time paste with the prefixed key
  if (oneTimePaste) {
    // Check if this paste has already been viewed in this instance
    if (oneTimeKey in viewedPastes) {
      console.log(
        `[TEMP PASTE] Paste already viewed and pending deletion: ${id}, key=${oneTimeKey}`,
      );

      // Double-check by trying to delete it again, just to be sure
      try {
        await env.PASTE_BUCKET.delete(oneTimeKey);
      } catch (e) {
        // Ignore errors
      }

      return new Response(
        "This one-time paste has already been viewed and is no longer available.",
        {
          status: 404,
          headers: {
            "Content-Type": "text/plain",
            "Cache-Control":
              "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
            "Surrogate-Control": "no-store",
            Pragma: "no-cache",
            Expires: "0",
            "X-One-Time": "true",
            "X-Already-Viewed": "true",
          },
        },
      );
    }

    // Mark this paste as viewed with timestamp
    viewedPastes[oneTimeKey] = {
      viewedAt: Date.now(),
      deleted: false,
      attempts: 0,
    };

    // Store in KV if available (optional enhancement)
    if (env.PASTE_METADATA) {
      try {
        await env.PASTE_METADATA.put(
          VIEWED_PASTES_KEY,
          JSON.stringify(viewedPastes),
        );
      } catch (error) {
        // Non-blocking error - the in-memory tracking still works
        console.log(`[KV] Optional metadata storage unavailable: ${error}`);
      }
    }
    console.log(
      `[TEMP PASTE] Found one-time paste with ID: ${id}, isEncrypted=${isEncrypted}`,
    );

    // Get the content and metadata before we delete the paste
    const content = await oneTimePaste.arrayBuffer();
    let contentType = "text/plain";
    let filename = "";

    try {
      const metadata = oneTimePaste.customMetadata as unknown as PasteMetadata;
      contentType = metadata.contentType || "text/plain";
      filename = metadata.filename || "";
      console.log(
        `[TEMP PASTE] Content type from metadata: ${contentType}, filename: ${filename}`,
      );
    } catch (err) {
      console.error(
        `[TEMP PASTE] Error retrieving metadata for one-time paste ${id}: ${err}`,
      );
    }

    // Override content type if this is an encrypted paste but the content type doesn't match
    // This ensures proper decryption on the client side
    if (isEncrypted && contentType !== "application/json") {
      console.log(
        `[TEMP PASTE] Overriding content type for encrypted paste from ${contentType} to application/json`,
      );
      contentType = "application/json";
    }

    // Delete the paste immediately before returning the content
    try {
      // First deletion attempt - force immediate deletion
      await env.PASTE_BUCKET.delete(oneTimeKey);
      console.log(
        `[TEMP PASTE] First deletion attempt for one-time paste with ID: ${id}, key=${oneTimeKey}, isEncrypted=${isEncrypted}`,
      );

      // Important: Add a small delay to allow propagation in Cloudflare's systems
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Second deletion attempt to ensure consistency
      await env.PASTE_BUCKET.delete(oneTimeKey);
      console.log(
        `[TEMP PASTE] Second deletion attempt for one-time paste with ID: ${id}, key=${oneTimeKey}, isEncrypted=${isEncrypted}`,
      );

      // Verify the deletion worked
      const verifyDeletion = await env.PASTE_BUCKET.get(oneTimeKey);
      if (verifyDeletion) {
        console.error(
          `[TEMP PASTE] Warning: Failed to delete one-time paste: ${id}, key=${oneTimeKey}`,
        );
        // Even though deletion appears to have failed, mark it as viewed in our tracking
        // system to prevent subsequent access
        viewedPastes[oneTimeKey].deleted = false;
        viewedPastes[oneTimeKey].attempts++;

        // Store updated tracking in KV if available
        if (env.PASTE_METADATA) {
          try {
            await env.PASTE_METADATA.put(
              VIEWED_PASTES_KEY,
              JSON.stringify(viewedPastes),
            );
          } catch (kvError) {
            // Non-blocking - in-memory tracking still works
            console.log(`[KV] Optional metadata update failed: ${kvError}`);
          }
        }

        // Force another deletion attempt
        await env.PASTE_BUCKET.delete(oneTimeKey);
      } else {
        console.log(
          `[TEMP PASTE] Successfully deleted one-time paste with ID: ${id}, key=${oneTimeKey}`,
        );
        viewedPastes[oneTimeKey].deleted = true;
        viewedPastes[oneTimeKey].attempts++;

        // Store updated tracking in KV
        try {
          if (env.PASTE_METADATA) {
            await env.PASTE_METADATA.put(
              VIEWED_PASTES_KEY,
              JSON.stringify(viewedPastes),
            );
          }
        } catch (kvError) {
          console.error(
            `[TEMP PASTE] Error updating paste registry after successful deletion: ${kvError}`,
          );
        }
      }
    } catch (error) {
      console.error(
        `[TEMP PASTE] Error deleting one-time paste with ID: ${id}: ${error}`,
      );

      // Schedule multiple backup deletion attempts to make sure it gets deleted
      ctx.waitUntil(
        (async () => {
          // Add more aggressive deletion strategy for backup
          const deletionAttempts = 5; // Increased from 3 to 5 attempts
          for (let i = 0; i < deletionAttempts; i++) {
            try {
              // Add delay between attempts with exponential backoff
              const delay = 200 * Math.pow(2, i); // 200ms, 400ms, 800ms, 1600ms, 3200ms
              await new Promise((resolve) => setTimeout(resolve, delay));
              console.log(
                `[TEMP PASTE] Backup deletion attempt ${i + 1}/${deletionAttempts} for one-time paste ${id}, key=${oneTimeKey}`,
              );
              await env.PASTE_BUCKET.delete(oneTimeKey);

              // Verify after each attempt
              const checkResult = await env.PASTE_BUCKET.get(oneTimeKey);
              if (!checkResult) {
                console.log(
                  `[TEMP PASTE] Backup deletion attempt ${i + 1} successfully deleted one-time paste ${id}`,
                );

                // Update tracking with success
                viewedPastes[oneTimeKey].deleted = true;
                viewedPastes[oneTimeKey].attempts += 1;

                // Store updated tracking in KV if available
                if (env.PASTE_METADATA) {
                  try {
                    await env.PASTE_METADATA.put(
                      VIEWED_PASTES_KEY,
                      JSON.stringify(viewedPastes),
                    );
                  } catch (kvUpdateError) {
                    // Non-blocking - in-memory tracking still works
                    console.log(
                      `[KV] Optional metadata backup update failed: ${kvUpdateError}`,
                    );
                  }
                }

                break; // Successfully deleted
              }
            } catch (backupError) {
              console.error(
                `[TEMP PASTE] Backup deletion attempt ${i + 1} failed for one-time paste ${id}: ${backupError}`,
              );
            }
          }
        })(),
      );
    }

    // Check if this is markdown content that should be rendered as HTML
    const isMarkdown =
      contentType === "text/markdown" ||
      contentType === "text/x-markdown" ||
      filename.endsWith(".md") ||
      filename.endsWith(".markdown");

    if (isMarkdown && !isEncrypted && !wantsRaw) {
      // Convert markdown to HTML for browser viewing
      const textContent = new TextDecoder().decode(content);
      const renderedHTML = await renderMarkdownAsHTML(
        textContent,
        id,
        filename,
        true,
      );

      return new Response(renderedHTML, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          "CDN-Cache-Control": "no-store",
          "Surrogate-Control": "no-store",
          Pragma: "no-cache",
          Expires: "0",
          "X-Original-Content-Type": contentType,
          "X-Rendered-Markdown": "true",
          "X-One-Time": "true",
          "X-Paste-Viewed-At": new Date().toISOString(),
        },
      });
    }

    // Return the content with stronger cache control headers
    return new Response(content, {
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        "CDN-Cache-Control": "no-store", // Additional CDN-specific directive
        "Surrogate-Control": "no-store", // For Cloudflare and other CDNs
        Pragma: "no-cache",
        Expires: "0",
        "X-Encrypted": isEncrypted ? "true" : "false",
        "X-One-Time": "true", // Mark as one-time paste explicitly
        "X-Paste-Viewed-At": new Date().toISOString(), // Add timestamp of viewing
      },
    });
  }

  // If not a one-time paste or if it's already been retrieved (deleted),
  // check for a regular paste
  const paste = await env.PASTE_BUCKET.get(id);

  if (!paste) {
    return new Response("Paste not found", { status: 404 });
  }

  // Regular paste - get the content and metadata
  const content = await paste.arrayBuffer();
  let contentType = "text/plain";
  let filename = "";

  try {
    const metadata = paste.customMetadata as unknown as PasteMetadata;
    contentType = metadata.contentType || "text/plain";
    filename = metadata.filename || "";
    console.log(
      `[REGULAR PASTE] Content type from metadata: ${contentType}, filename: ${filename}`,
    );
  } catch (err) {
    console.error(`Error retrieving metadata for paste ${id}: ${err}`);
  }

  // Override content type if this is an encrypted paste but the content type doesn't match
  // This ensures proper decryption on the client side
  if (isEncrypted && contentType !== "application/json") {
    console.log(
      `[REGULAR PASTE] Overriding content type for encrypted paste from ${contentType} to application/json`,
    );
    contentType = "application/json";
  }

  // Check if this is markdown content that should be rendered as HTML
  const isMarkdown =
    contentType === "text/markdown" ||
    contentType === "text/x-markdown" ||
    filename.endsWith(".md") ||
    filename.endsWith(".markdown");

  if (isMarkdown && !isEncrypted && !wantsRaw) {
    // Convert markdown to HTML for browser viewing
    const textContent = new TextDecoder().decode(content);
    const renderedHTML = await renderMarkdownAsHTML(textContent, id, filename);

    return new Response(renderedHTML, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "X-Original-Content-Type": contentType,
        "X-Rendered-Markdown": "true",
      },
    });
  }

  // Return the paste content with robust caching headers
  return new Response(content, {
    headers: {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      // Add a header to indicate if the paste is encrypted
      "X-Encrypted": isEncrypted ? "true" : "false",
    },
  });
}

/**
 * Renders markdown content as HTML with proper styling
 * @param markdownContent The markdown text to render
 * @param pasteId The paste ID for display
 * @param filename Optional filename for display
 * @param isOneTime Whether this is a one-time paste
 * @returns Complete HTML page with rendered markdown
 */
async function renderMarkdownAsHTML(
  markdownContent: string,
  pasteId: string,
  filename: string = "",
  isOneTime: boolean = false,
): Promise<string> {
  // Create a custom renderer for marked
  const renderer = new marked.Renderer();
  let codeBlockId = 0;

  // Track if we have any mermaid diagrams
  let hasMermaidDiagrams = false;
  let mermaidBlockId = 0;

  // Override code block rendering to add syntax highlighting
  renderer.code = function ({
    text,
    lang,
    escaped,
  }: {
    text: string;
    lang?: string;
    escaped?: boolean;
  }): string {
    const blockId = `code-block-${++codeBlockId}`;

    // Check if this is a mermaid diagram
    if (lang === "mermaid") {
      hasMermaidDiagrams = true;
      const mermaidId = `mermaid-${++mermaidBlockId}`;

      // Return a special wrapper for mermaid diagrams with toggle functionality
      return `<div class="mermaid-wrapper" id="${mermaidId}-wrapper">
        <div class="mermaid-header">
          <span class="code-language">mermaid</span>
          <div class="mermaid-controls">
            <button class="toggle-view-button" onclick="toggleMermaidView('${mermaidId}')" title="Toggle code/diagram view">
              <svg class="toggle-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              <span class="toggle-text">View Diagram</span>
            </button>
            <button class="copy-button" data-code-id="${blockId}" onclick="copyCode('${blockId}')" title="Copy code">
              <svg class="copy-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span class="copy-text">Copy</span>
            </button>
          </div>
        </div>
        <div class="mermaid-content">
          <div class="mermaid-code" id="${mermaidId}-code">
            <pre><code id="${blockId}" class="hljs language-mermaid">${escapeHtml(text)}</code></pre>
          </div>
          <div class="mermaid-diagram" id="${mermaidId}-diagram" style="display: none;">
            <pre class="mermaid">${escapeHtml(text)}</pre>
          </div>
        </div>
      </div>`;
    }

    // Regular code block handling
    let highlighted: string;
    let detectedLanguage = lang || "plaintext";

    try {
      if (lang && hljs.getLanguage(lang)) {
        // Use specified language if it's supported
        highlighted = hljs.highlight(text, { language: lang }).value;
      } else {
        // Auto-detect language
        const result = hljs.highlightAuto(text);
        highlighted = result.value;
        detectedLanguage = result.language || "plaintext";
      }
    } catch (err) {
      // Fallback to plain text if highlighting fails
      highlighted = escapeHtml(text);
      detectedLanguage = "plaintext";
    }

    // Return the highlighted code with a wrapper for the copy button
    return `<div class="code-block-wrapper">
      <div class="code-block-header">
        <span class="code-language">${escapeHtml(detectedLanguage)}</span>
        <button class="copy-button" data-code-id="${blockId}" onclick="copyCode('${blockId}')" title="Copy code">
          <svg class="copy-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span class="copy-text">Copy</span>
        </button>
      </div>
      <pre><code id="${blockId}" class="hljs language-${escapeHtml(detectedLanguage)}">${highlighted}</code></pre>
    </div>`;
  };

  // Configure marked with our custom renderer
  marked.setOptions({
    breaks: true,
    gfm: true,
    renderer: renderer,
  });

  // Parse the markdown to HTML
  const htmlContent = await marked.parse(markdownContent);

  // Generate a title from the filename or first heading
  let title = filename || "Markdown Document";
  if (title.endsWith(".md")) {
    title = title.slice(0, -3);
  } else if (title.endsWith(".markdown")) {
    title = title.slice(0, -9);
  }

  // Try to extract the first heading from the content as title
  const headingMatch = markdownContent.match(/^#\s+(.+)$/m);
  if (headingMatch) {
    title = headingMatch[1];
  }

  // Generate the complete HTML page
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - DedPaste</title>
  <style>
    ${getMuiCSS()}
    ${getMarkdownStyles()}
    
    /* Additional specific styles for markdown viewer */
    body {
      margin: 0;
      padding: 0;
      background-color: var(--mui-palette-background-default);
      color: var(--mui-palette-text-primary);
    }
    
    /* Header using MUI styles */
    .header {
      background: var(--mui-palette-background-paper);
      border-bottom: 1px solid var(--mui-palette-divider);
      padding: var(--mui-spacing-2) var(--mui-spacing-3);
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: var(--mui-shadows-2);
    }
    
    .header-title {
      font-size: 1.25rem;
      font-weight: 500;
      color: var(--mui-palette-text-primary);
    }
    
    .header-title .brand {
      color: var(--mui-palette-primary-main);
    }
    
    .paste-info {
      display: flex;
      gap: var(--mui-spacing-2);
      align-items: center;
      font-size: 0.875rem;
      color: var(--mui-palette-text-secondary);
    }
    
    .paste-id {
      font-family: 'Roboto Mono', monospace;
      background: var(--mui-palette-background-default);
      padding: 4px 8px;
      border-radius: var(--mui-shape-borderRadius);
      border: 1px solid var(--mui-palette-divider);
    }
    
    .one-time-badge {
      background: var(--mui-palette-error-main);
      color: white;
      padding: 4px 8px;
      border-radius: 16px;
      font-weight: 500;
      font-size: 0.75rem;
      text-transform: uppercase;
    }
    
    /* Main content using MUI styles */
    .container {
      max-width: 900px;
      margin: 0 auto;
      padding: var(--mui-spacing-4) var(--mui-spacing-3);
    }
    
    .markdown-content {
      background: var(--mui-palette-background-paper);
      border: 1px solid var(--mui-palette-divider);
      border-radius: var(--mui-shape-borderRadius);
      padding: var(--mui-spacing-4);
      box-shadow: var(--mui-shadows-1);
    }
    
    /* Markdown styles */
    .markdown-content h1,
    .markdown-content h2,
    .markdown-content h3,
    .markdown-content h4,
    .markdown-content h5,
    .markdown-content h6 {
      color: #ffffff;
      font-weight: 600;
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      line-height: 1.3;
    }
    
    .markdown-content h1:first-child,
    .markdown-content h2:first-child {
      margin-top: 0;
    }
    
    .markdown-content h1 { font-size: 2em; border-bottom: 1px solid #4a4952; padding-bottom: 0.3em; }
    .markdown-content h2 { font-size: 1.5em; border-bottom: 1px solid #4a4952; padding-bottom: 0.3em; }
    .markdown-content h3 { font-size: 1.25em; }
    .markdown-content h4 { font-size: 1.1em; }
    .markdown-content h5 { font-size: 1em; }
    .markdown-content h6 { font-size: 0.95em; color: #9ca3af; }
    
    .markdown-content p {
      margin-bottom: 1em;
      line-height: 1.7;
    }
    
    .markdown-content a {
      color: #8f8fff;
      text-decoration: none;
      transition: color 0.15s;
    }
    
    .markdown-content a:hover {
      color: #bbc3ff;
      text-decoration: underline;
    }
    
    .markdown-content code {
      font-family: 'Fira Code', 'Courier New', monospace;
      background: #18171c;
      border: 1px solid #4a4952;
      padding: 0.125rem 0.25rem;
      border-radius: 0.25rem;
      font-size: 0.9em;
      color: #f3f4f6;
    }
    
    /* Code block wrapper and header */
    .code-block-wrapper {
      position: relative;
      margin-bottom: 1em;
      border-radius: 0.5rem;
      overflow: hidden;
      border: 1px solid #4a4952;
      background: #18171c;
    }
    
    .code-block-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 1rem;
      background: #2c2b31;
      border-bottom: 1px solid #4a4952;
    }
    
    .code-language {
      font-size: 0.875rem;
      color: #8f8fff;
      font-weight: 500;
      text-transform: lowercase;
    }
    
    .copy-button {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.5rem;
      background: transparent;
      border: 1px solid #4a4952;
      border-radius: 0.25rem;
      color: #9ca3af;
      font-size: 0.75rem;
      cursor: pointer;
      transition: all 0.15s;
    }
    
    .copy-button:hover {
      background: #4a4952;
      color: #ffffff;
      border-color: #8f8fff;
    }
    
    .copy-button.copied {
      background: #10b981;
      color: #ffffff;
      border-color: #10b981;
    }
    
    .copy-icon {
      width: 14px;
      height: 14px;
    }
    
    .markdown-content pre {
      background: #18171c;
      border: none;
      border-radius: 0;
      padding: 1rem;
      overflow-x: auto;
      margin: 0;
    }
    
    .markdown-content pre code {
      background: transparent;
      border: none;
      padding: 0;
      font-size: 0.875rem;
      line-height: 1.5;
      color: #f3f4f6;
    }
    
    /* Highlight.js theme - GitHub Dark */
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
    
    .markdown-content blockquote {
      border-left: 4px solid #8f8fff;
      padding-left: 1rem;
      margin: 1em 0;
      color: #d1d5db;
      font-style: italic;
    }
    
    /* Mermaid diagram styles */
    .mermaid-wrapper {
      position: relative;
      margin-bottom: 1em;
      border-radius: 0.5rem;
      overflow: hidden;
      border: 1px solid #4a4952;
      background: #18171c;
    }
    
    .mermaid-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 1rem;
      background: #2c2b31;
      border-bottom: 1px solid #4a4952;
    }
    
    .mermaid-controls {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }
    
    .toggle-view-button {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.5rem;
      background: transparent;
      border: 1px solid #4a4952;
      border-radius: 0.25rem;
      color: #9ca3af;
      font-size: 0.75rem;
      cursor: pointer;
      transition: all 0.15s;
    }
    
    .toggle-view-button:hover {
      background: #4a4952;
      color: #ffffff;
      border-color: #8f8fff;
    }
    
    .toggle-view-button.active {
      background: #8f8fff;
      color: #ffffff;
      border-color: #8f8fff;
    }
    
    .toggle-icon {
      width: 14px;
      height: 14px;
    }
    
    .mermaid-content {
      position: relative;
      min-height: 100px;
    }
    
    .mermaid-code pre {
      margin: 0;
      background: #18171c;
      border: none;
      border-radius: 0;
    }
    
    .mermaid-diagram {
      padding: 2rem;
      display: flex;
      justify-content: center;
      align-items: center;
      background: #ffffff;
      min-height: 200px;
    }
    
    .mermaid-diagram.dark {
      background: #1e1e2e;
    }
    
    /* Override Mermaid default styles for dark theme */
    .mermaid-diagram svg {
      max-width: 100%;
      height: auto;
    }
    
    .markdown-content ul,
    .markdown-content ol {
      margin-bottom: 1em;
      padding-left: 2rem;
    }
    
    .markdown-content li {
      margin-bottom: 0.25em;
    }
    
    .markdown-content table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 1em;
      overflow-x: auto;
      display: block;
    }
    
    .markdown-content th,
    .markdown-content td {
      padding: 0.5rem;
      border: 1px solid #4a4952;
      text-align: left;
    }
    
    .markdown-content th {
      background: #18171c;
      font-weight: 600;
      color: #ffffff;
    }
    
    .markdown-content tr:nth-child(even) {
      background: rgba(24, 23, 28, 0.5);
    }
    
    .markdown-content img {
      max-width: 100%;
      height: auto;
      border-radius: 0.5rem;
      margin: 1em 0;
    }
    
    .markdown-content hr {
      border: none;
      border-top: 1px solid #4a4952;
      margin: 2em 0;
    }
    
    /* Footer */
    /* Copy All Button Styles */
    .copy-all-container {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 1rem;
      padding: 0 1.5rem;
    }
    
    .copy-all-button {
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
      transition: all 0.2s;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    
    .copy-all-button:hover {
      background: #4a4952;
      border-color: #8f8fff;
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    }
    
    .copy-all-button:active {
      transform: translateY(0);
    }
    
    .copy-all-button.copied {
      background: #10b981;
      border-color: #10b981;
      color: #ffffff;
    }
    
    .copy-all-icon {
      width: 18px;
      height: 18px;
    }
    
    .footer {
      text-align: center;
      padding: 2rem;
      color: #6b7280;
      font-size: 0.875rem;
    }
    
    .footer a {
      color: #8f8fff;
      text-decoration: none;
    }
    
    .footer a:hover {
      text-decoration: underline;
    }
    
    /* Responsive */
    @media (max-width: 768px) {
      .header {
        flex-direction: column;
        gap: 1rem;
        text-align: center;
      }
      
      .container {
        padding: 1rem;
      }
      
      .markdown-content {
        padding: 1.5rem;
      }
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="header-title">
      <span class="brand">Ded</span>Paste - Markdown Viewer
    </div>
    <div class="paste-info">
      ${filename ? `<span>📄 ${escapeHtml(filename)}</span>` : ""}
      <span class="paste-id">ID: ${escapeHtml(pasteId)}</span>
      ${isOneTime ? '<span class="one-time-badge">⚠️ One-Time Paste</span>' : ""}
    </div>
  </header>
  
  <div class="container">
    <div class="copy-all-container">
      <button class="copy-all-button" onclick="copyAllMarkdown()" title="Copy original markdown source">
        <svg class="copy-all-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        <span class="copy-all-text">Copy Markdown Source</span>
      </button>
    </div>
  </div>
  
  <main class="container">
    <div class="markdown-content">
      ${htmlContent}
    </div>
  </main>
  
  <footer class="footer">
    <p>Rendered with <a href="https://github.com/anoncam/dedpaste" target="_blank">DedPaste</a></p>
    <p style="margin-top: 0.5rem;">
      <a href="/${pasteId}?raw=true">View Raw</a> • 
      <a href="https://paste.d3d.dev">Create New Paste</a>
    </p>
  </footer>
  
  <script>
    // Store the original markdown content
    const originalMarkdown = ${JSON.stringify(markdownContent)};
    
    // Copy all markdown source to clipboard
    function copyAllMarkdown() {
      const button = document.querySelector('.copy-all-button');
      const buttonText = button.querySelector('.copy-all-text');
      const originalText = buttonText.textContent;
      
      // Create a temporary textarea to copy from
      const textarea = document.createElement('textarea');
      textarea.value = originalMarkdown;
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      document.body.appendChild(textarea);
      
      try {
        // Select and copy the text
        textarea.select();
        document.execCommand('copy');
        
        // Update button state
        button.classList.add('copied');
        buttonText.textContent = 'Copied!';
        
        // Reset after 2 seconds
        setTimeout(() => {
          button.classList.remove('copied');
          buttonText.textContent = originalText;
        }, 2000);
      } catch (err) {
        console.error('Failed to copy markdown:', err);
        // Try modern clipboard API as fallback
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(originalMarkdown).then(() => {
            button.classList.add('copied');
            buttonText.textContent = 'Copied!';
            setTimeout(() => {
              button.classList.remove('copied');
              buttonText.textContent = originalText;
            }, 2000);
          }).catch(err => {
            console.error('Clipboard API also failed:', err);
            alert('Failed to copy markdown. Please try selecting and copying manually.');
          });
        }
      } finally {
        document.body.removeChild(textarea);
      }
    }
    
    function copyCode(blockId) {
      const codeBlock = document.getElementById(blockId);
      const button = document.querySelector(\`button[data-code-id="\${blockId}"]\`);
      
      if (!codeBlock || !button) return;
      
      // Get the text content without HTML tags
      const codeText = codeBlock.textContent || codeBlock.innerText;
      
      // Create a temporary textarea to copy from
      const textarea = document.createElement('textarea');
      textarea.value = codeText;
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      document.body.appendChild(textarea);
      
      try {
        // Select and copy the text
        textarea.select();
        document.execCommand('copy');
        
        // Update button state
        button.classList.add('copied');
        const copyText = button.querySelector('.copy-text');
        const originalText = copyText.textContent;
        copyText.textContent = 'Copied!';
        
        // Reset after 2 seconds
        setTimeout(() => {
          button.classList.remove('copied');
          copyText.textContent = originalText;
        }, 2000);
      } catch (err) {
        console.error('Failed to copy code:', err);
      } finally {
        document.body.removeChild(textarea);
      }
    }
    
    // Alternative modern copy method for browsers that support it
    if (navigator.clipboard && window.isSecureContext) {
      window.copyCode = function(blockId) {
        const codeBlock = document.getElementById(blockId);
        const button = document.querySelector(\`button[data-code-id="\${blockId}"]\`);
        
        if (!codeBlock || !button) return;
        
        const codeText = codeBlock.textContent || codeBlock.innerText;
        
        navigator.clipboard.writeText(codeText).then(() => {
          // Update button state
          button.classList.add('copied');
          const copyText = button.querySelector('.copy-text');
          const originalText = copyText.textContent;
          copyText.textContent = 'Copied!';
          
          // Reset after 2 seconds
          setTimeout(() => {
            button.classList.remove('copied');
            copyText.textContent = originalText;
          }, 2000);
        }).catch(err => {
          console.error('Failed to copy code:', err);
        });
      };
    }
    
    // Toggle between code and diagram view for Mermaid blocks
    function toggleMermaidView(mermaidId) {
      const codeView = document.getElementById(mermaidId + '-code');
      const diagramView = document.getElementById(mermaidId + '-diagram');
      const button = document.querySelector(\`#\${mermaidId}-wrapper .toggle-view-button\`);
      const toggleText = button.querySelector('.toggle-text');
      
      if (codeView.style.display === 'none') {
        // Switch to code view
        codeView.style.display = 'block';
        diagramView.style.display = 'none';
        button.classList.remove('active');
        toggleText.textContent = 'View Diagram';
      } else {
        // Switch to diagram view
        codeView.style.display = 'none';
        diagramView.style.display = 'block';
        button.classList.add('active');
        toggleText.textContent = 'View Code';
        
        // Initialize mermaid if not already done
        if (!window.mermaidInitialized) {
          loadMermaid();
        }
      }
    }
    
    // Load and initialize Mermaid.js
    function loadMermaid() {
      if (window.mermaidInitialized) return;
      
      // Check if there are any mermaid diagrams
      const mermaidElements = document.querySelectorAll('.mermaid');
      if (mermaidElements.length === 0) return;
      
      // Load Mermaid.js from CDN
      const script = document.createElement('script');
      script.type = 'module';
      script.textContent = \`
        import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
        
        // Configure mermaid for dark theme
        mermaid.initialize({
          startOnLoad: true,
          theme: 'dark',
          themeVariables: {
            primaryColor: '#8f8fff',
            primaryTextColor: '#fff',
            primaryBorderColor: '#8f8fff',
            lineColor: '#8f8fff',
            secondaryColor: '#6c5ce7',
            tertiaryColor: '#18171c',
            background: '#2c2b31',
            mainBkg: '#2c2b31',
            secondBkg: '#18171c',
            tertiaryBkg: '#4a4952',
            primaryTextColor: '#fff',
            secondaryTextColor: '#fff',
            tertiaryTextColor: '#fff',
            lineColor: '#8f8fff',
            textColor: '#e1e4e8',
            mainContrastColor: '#e1e4e8',
            darkMode: true,
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '14px',
            altBackground: '#18171c',
            edgeLabelBackground: '#2c2b31',
            nodeTextColor: '#e1e4e8',
            actorBkg: '#8f8fff',
            actorBorder: '#8f8fff',
            actorTextColor: '#18171c',
            actorLineColor: '#e1e4e8',
            signalColor: '#e1e4e8',
            signalTextColor: '#e1e4e8',
            labelBoxBkgColor: '#2c2b31',
            labelBoxBorderColor: '#8f8fff',
            labelTextColor: '#e1e4e8',
            loopTextColor: '#e1e4e8',
            noteBorderColor: '#8f8fff',
            noteBkgColor: '#2c2b31',
            noteTextColor: '#e1e4e8',
            activationBorderColor: '#8f8fff',
            activationBkgColor: '#4a4952',
            sequenceNumberColor: '#18171c',
            sectionBkgColor: '#4a4952',
            altSectionBkgColor: '#2c2b31',
            sectionBkgColor2: '#2c2b31',
            excludeBkgColor: '#18171c',
            taskBorderColor: '#8f8fff',
            taskBkgColor: '#4a4952',
            taskTextColor: '#e1e4e8',
            taskTextLightColor: '#e1e4e8',
            taskTextOutsideColor: '#e1e4e8',
            taskTextClickableColor: '#8f8fff',
            activeTaskBorderColor: '#8f8fff',
            activeTaskBkgColor: '#8f8fff',
            gridColor: '#4a4952',
            doneTaskBkgColor: '#10b981',
            doneTaskBorderColor: '#10b981',
            critBorderColor: '#ff7b72',
            critBkgColor: '#ff7b72',
            todayLineColor: '#ff7b72',
            personBorder: '#8f8fff',
            personBkg: '#2c2b31',
            labelColor: '#e1e4e8',
            errorBkgColor: '#ff7b72',
            errorTextColor: '#18171c',
            clusterBkg: '#2c2b31',
            clusterBorder: '#8f8fff',
            defaultLinkColor: '#8f8fff',
            titleColor: '#e1e4e8',
            edgeLabelBackground: '#2c2b31',
            nodeTextColor: '#e1e4e8'
          },
          flowchart: {
            htmlLabels: true,
            curve: 'basis'
          },
          sequence: {
            diagramMarginX: 50,
            diagramMarginY: 10,
            actorMargin: 50,
            width: 150,
            height: 65,
            boxMargin: 10,
            boxTextMargin: 5,
            noteMargin: 10,
            messageMargin: 35,
            mirrorActors: true,
            bottomMarginAdj: 1,
            useMaxWidth: true
          },
          er: {
            layoutDirection: 'TB',
            minEntityWidth: 100,
            minEntityHeight: 75,
            entityPadding: 15,
            stroke: 'gray',
            fill: 'honeydew',
            fontSize: 12
          }
        });
        
        // Render all mermaid diagrams
        mermaid.run();
        window.mermaidInitialized = true;
      \`;
      
      document.body.appendChild(script);
    }
  </script>
</body>
</html>`;
}

/**
 * Escapes HTML special characters to prevent XSS
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
