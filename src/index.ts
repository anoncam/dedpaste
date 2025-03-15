export interface Env {
  PASTE_BUCKET: R2Bucket;
}

type PasteMetadata = {
  contentType: string;
  isOneTime: boolean;
  createdAt: number;
  // We don't need to store encryption info in metadata
  // since the server doesn't need to know if content is encrypted
  // The URL path (/e/) is sufficient to indicate encryption
};

// For one-time pastes, we'll use a completely different key format
// with a prefix to make identifying them clear
const ONE_TIME_PREFIX = "onetime-";

// Generate a random ID for the paste
function generateId(length = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle OPTIONS requests for CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Upload a new paste
    if (request.method === 'POST') {
      // Handle regular uploads
      if (path === '/upload' || path === '/temp') {
        const isOneTime = path === '/temp';
        return await handleUpload(request, env, isOneTime, false);
      }
      
      // Handle encrypted uploads
      if (path === '/e/upload' || path === '/e/temp') {
        const isOneTime = path === '/e/temp';
        return await handleUpload(request, env, isOneTime, true);
      }
      
      return new Response('Not found', { status: 404 });
    }

    // Get a paste
    if (request.method === 'GET') {
      // Handle regular pastes
      const regularMatch = path.match(/^\/([a-zA-Z0-9]{8})$/);
      if (regularMatch) {
        const id = regularMatch[1];
        return await handleGet(id, env, ctx, false);
      }
      
      // Handle encrypted pastes
      const encryptedMatch = path.match(/^\/e\/([a-zA-Z0-9]{8})$/);
      if (encryptedMatch) {
        const id = encryptedMatch[1];
        return await handleGet(id, env, ctx, true);
      }
      
      // Serve the HTML homepage
      if (path === '/') {
        return new Response(`<!DOCTYPE html>
<html>
<head>
  <title>DedPaste - Secure Pastebin Service</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="DedPaste - A secure pastebin service with end-to-end encryption and CLI client">
  <style>
    :root {
      --bg-color: #121212;
      --text-color: #e0e0e0;
      --heading-color: #ffffff;
      --accent-color: #bb86fc;
      --code-bg: #1e1e1e;
      --border-color: #333333;
      --highlight: #03dac6;
      --card-bg: #1e1e1e;
    }
    
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background-color: var(--bg-color);
      color: var(--text-color);
      line-height: 1.6;
    }
    
    h1, h2, h3 {
      color: var(--heading-color);
      margin-top: 1.5em;
    }
    
    h1 {
      font-size: 2.5rem;
      margin-bottom: 0.5em;
      border-bottom: 2px solid var(--accent-color);
      padding-bottom: 0.2em;
    }
    
    h2 {
      font-size: 1.8rem;
      margin-top: 1.8em;
    }
    
    a {
      color: var(--accent-color);
      text-decoration: none;
    }
    
    a:hover {
      text-decoration: underline;
    }
    
    pre {
      background: var(--code-bg);
      padding: 15px;
      border-radius: 8px;
      overflow: auto;
      border: 1px solid var(--border-color);
      margin: 1em 0;
    }
    
    code {
      font-family: 'Fira Code', 'Cascadia Code', 'Source Code Pro', Consolas, monospace;
      color: var(--text-color);
    }
    
    .feature {
      color: var(--highlight);
      font-weight: bold;
    }
    
    .card {
      background: var(--card-bg);
      border-radius: 8px;
      padding: 1.5em;
      margin: 1.5em 0;
      border: 1px solid var(--border-color);
    }
    
    .card h3 {
      margin-top: 0;
      color: var(--accent-color);
    }
    
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin: 2em 0;
    }
    
    @media (max-width: 600px) {
      body {
        padding: 15px;
      }
      h1 {
        font-size: 2rem;
      }
      .grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <h1>DedPaste</h1>
  <p>A secure pastebin service with end-to-end encryption and command-line interface.</p>
  
  <div class="grid">
    <div class="card">
      <h3>Key Features</h3>
      <ul>
        <li>Simple text and file sharing</li>
        <li><span class="feature">End-to-end encryption</span> for secure sharing</li>
        <li><span class="feature">One-time pastes</span> that self-destruct after viewing</li>
        <li>Friend-to-friend encrypted sharing</li>
        <li><span class="feature">PGP keyserver integration</span> for public keys</li>
        <li><span class="feature">Keybase user integration</span> with proofs</li>
        <li>Command-line interface for easy scripting</li>
        <li>Support for RSA key pairs and SSH keys</li>
        <li>Binary file support with custom content types</li>
      </ul>
    </div>
    
    <div class="card">
      <h3>Getting Started</h3>
      <p>Install the CLI client:</p>
      <pre><code>npm install -g dedpaste</code></pre>
      <p>Create your first paste:</p>
      <pre><code>echo "Hello World!" | dedpaste</code></pre>
      <p>Create an encrypted paste:</p>
      <pre><code>echo "Secret data" | dedpaste --encrypt</code></pre>
    </div>
  </div>
  
  <h2>API Usage</h2>
  <pre><code>
# Post content
curl -X POST -H "Content-Type: text/plain" --data "Your content here" ${url.origin}/upload

# Post one-time content (deleted after first view)
curl -X POST -H "Content-Type: text/plain" --data "Your content here" ${url.origin}/temp

# Post encrypted content (client-side encryption)
curl -X POST -H "Content-Type: text/plain" --data "Your encrypted content" ${url.origin}/e/upload

# Post encrypted one-time content
curl -X POST -H "Content-Type: text/plain" --data "Your encrypted content" ${url.origin}/e/temp

# Get content
curl ${url.origin}/{paste-id}

# Get encrypted content (requires client-side decryption)
curl ${url.origin}/e/{paste-id}</code></pre>
  
  <h2>CLI Commands</h2>
  <div class="card">
    <h3>Basic Operations</h3>
    <pre><code>
# Post content from stdin
echo "content" | dedpaste

# Post file
dedpaste < file.txt

# Post with a specific file
dedpaste --file path/to/file.txt

# Post one-time content (deleted after first view)
echo "secret" | dedpaste --temp

# Post with custom content type
dedpaste --type application/json < data.json

# Output only the URL (useful for scripts)
echo "content" | dedpaste --output</code></pre>
  </div>
  
  <div class="card">
    <h3>Encryption Features</h3>
    <pre><code>
# Post encrypted content
echo "secret" | dedpaste --encrypt

# Post encrypted content with specific key
echo "secret" | dedpaste --encrypt --key-file ~/.ssh/id_rsa.pub

# Generate new key pair and encrypt
echo "secret" | dedpaste --encrypt --gen-key

# Key management
dedpaste keys --list               # List all keys
dedpaste keys --gen-key            # Generate a new key pair
dedpaste keys --add-friend alice   # Add a friend's public key
dedpaste keys --export             # Export your public key
dedpaste keys --my-key             # Display your public key
dedpaste keys --interactive        # Interactive key management</code></pre>
  </div>

  <div class="card">
    <h3>PGP & Keybase Integration</h3>
    <pre><code>
# Add a PGP key from keyservers
dedpaste keys --pgp-key user@example.com

# Add a PGP key with custom name
dedpaste keys --pgp-key 0x1234ABCD --pgp-name alice

# Add a Keybase user's key
dedpaste keys --keybase username

# Add a Keybase key with custom name
dedpaste keys --keybase username --keybase-name bob

# Skip verification of Keybase proofs
dedpaste keys --keybase username --no-verify</code></pre>
  </div>
  
  <div class="card">
    <h3>Friend-to-Friend Sharing</h3>
    <pre><code>
# List available friends
dedpaste send --list-friends

# Send encrypted message to a friend
echo "Secret message" | dedpaste send --encrypt --for alice

# Send encrypted one-time message
echo "One-time secret" | dedpaste send --encrypt --for alice --temp

# Get and decrypt a paste
dedpaste get https://paste.d3d.dev/e/AbCdEfGh</code></pre>
  </div>
  
  <h2>Security</h2>
  <p>DedPaste uses hybrid encryption (RSA + AES-256-GCM) with all encryption/decryption happening client-side. 
  The server never sees your unencrypted content or encryption keys, ensuring true end-to-end encryption.</p>
  
  <div class="card">
    <h3>Additional Resources</h3>
    <ul>
      <li>GitHub Repository: <a href="https://github.com/anoncam/dedpaste" target="_blank">github.com/anoncam/dedpaste</a></li>
      <li>Shell Auto-Completion: <code>dedpaste completion --bash</code> or <code>dedpaste completion --zsh</code></li>
      <li>Self-Deployment Guide: Available in the README</li>
    </ul>
  </div>
</body>
</html>`, {
          headers: {
            'Content-Type': 'text/html',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      return new Response('Not found', { status: 404 });
    }

    return new Response('Method not allowed', { status: 405 });
  },
};

async function handleUpload(request: Request, env: Env, isOneTime: boolean, isEncrypted: boolean): Promise<Response> {
  const contentType = request.headers.get('Content-Type') || 'text/plain';
  const content = await request.arrayBuffer();
  
  // Check if the content is empty
  if (content.byteLength === 0) {
    return new Response('Content cannot be empty', { status: 400 });
  }
  
  // Generate a unique ID for the paste
  let id = generateId();
  
  // For one-time pastes, use a completely different storage strategy with a prefix
  if (isOneTime) {
    // Add a prefix to clearly identify one-time pastes
    const storageKey = `${ONE_TIME_PREFIX}${id}`;
    
    // Create the metadata for the paste
    const metadata: PasteMetadata = {
      contentType,
      isOneTime: true, // Always true for this storage path
      createdAt: Date.now(),
    };
    
    // Store the content in R2 with the prefixed key
    await env.PASTE_BUCKET.put(storageKey, content, {
      customMetadata: metadata as any,
    });
    
    console.log(`Created one-time paste with storage key ${storageKey}`);
  } else {
    // Regular paste - standard storage path
    // Create the metadata for the paste
    const metadata: PasteMetadata = {
      contentType,
      isOneTime: false, // Always false for this storage path
      createdAt: Date.now(),
    };
    
    // Store the content in R2 with metadata
    await env.PASTE_BUCKET.put(id, content, {
      customMetadata: metadata as any,
    });
    
    console.log(`Created regular paste ${id}`);
  }
  
  const baseUrl = new URL(request.url).origin;
  // Generate URL with /e/ prefix for encrypted pastes
  const pasteUrl = isEncrypted ? `${baseUrl}/e/${id}` : `${baseUrl}/${id}`;

  // Return the paste URL - we always use the unprefixed ID in the URL
  return new Response(pasteUrl, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'text/plain',
    },
  });
}

async function handleGet(id: string, env: Env, ctx: ExecutionContext, isEncrypted: boolean): Promise<Response> {
  // First, check if this is a one-time paste by trying to get it with the one-time prefix
  const oneTimeKey = `${ONE_TIME_PREFIX}${id}`;
  const oneTimePaste = await env.PASTE_BUCKET.get(oneTimeKey);
  
  // If we found a one-time paste with the prefixed key
  if (oneTimePaste) {
    console.log(`[TEMP PASTE] Found one-time paste with ID: ${id}`);
    
    // Get the content and metadata before we delete the paste
    const content = await oneTimePaste.arrayBuffer();
    let contentType = 'text/plain';
    
    try {
      const metadata = oneTimePaste.customMetadata as unknown as PasteMetadata;
      contentType = metadata.contentType || 'text/plain';
    } catch (err) {
      console.error(`[TEMP PASTE] Error retrieving metadata for one-time paste ${id}: ${err}`);
    }
    
    // Delete the paste immediately before returning the content
    try {
      await env.PASTE_BUCKET.delete(oneTimeKey);
      console.log(`[TEMP PASTE] Successfully deleted one-time paste with ID: ${id}`);
    } catch (error) {
      console.error(`[TEMP PASTE] Error deleting one-time paste with ID: ${id}: ${error}`);
      
      // Schedule a backup deletion attempt to make sure it gets deleted
      ctx.waitUntil(
        (async () => {
          try {
            console.log(`[TEMP PASTE] Attempting backup deletion for one-time paste ${id}`);
            await env.PASTE_BUCKET.delete(oneTimeKey);
            console.log(`[TEMP PASTE] Backup deletion successful for one-time paste ${id}`);
          } catch (backupError) {
            console.error(`[TEMP PASTE] Backup deletion failed for one-time paste ${id}: ${backupError}`);
          }
        })()
      );
    }
    
    // Return the content
    return new Response(content, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Encrypted': isEncrypted ? 'true' : 'false',
      },
    });
  }
  
  // If not a one-time paste or if it's already been retrieved (deleted),
  // check for a regular paste
  const paste = await env.PASTE_BUCKET.get(id);
  
  if (!paste) {
    return new Response('Paste not found', { status: 404 });
  }
  
  // Regular paste - get the content and metadata
  const content = await paste.arrayBuffer();
  let contentType = 'text/plain';
  
  try {
    const metadata = paste.customMetadata as unknown as PasteMetadata;
    contentType = metadata.contentType || 'text/plain';
  } catch (err) {
    console.error(`Error retrieving metadata for paste ${id}: ${err}`);
  }
  
  // Return the paste content with robust caching headers
  return new Response(content, {
    headers: {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      // Add a header to indicate if the paste is encrypted
      'X-Encrypted': isEncrypted ? 'true' : 'false',
    },
  });
}