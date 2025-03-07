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
  const id = generateId();
  
  // Create the metadata for the paste
  const metadata: PasteMetadata = {
    contentType,
    isOneTime,
    createdAt: Date.now(),
  };
  
  // Store the content in R2 with metadata
  // Ensure isOneTime flag is explicitly set as a boolean
  metadata.isOneTime = isOneTime === true;
  
  await env.PASTE_BUCKET.put(id, content, {
    customMetadata: metadata as any,
  });
  
  console.log(`Created paste ${id} (isOneTime: ${metadata.isOneTime})`); // Log for debugging
  
  const baseUrl = new URL(request.url).origin;
  // Generate URL with /e/ prefix for encrypted pastes
  const pasteUrl = isEncrypted ? `${baseUrl}/e/${id}` : `${baseUrl}/${id}`;

  // Return the paste URL
  return new Response(pasteUrl, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'text/plain',
    },
  });
}

async function handleGet(id: string, env: Env, ctx: ExecutionContext, isEncrypted: boolean): Promise<Response> {
  // Get the paste from R2
  const paste = await env.PASTE_BUCKET.get(id);
  
  if (!paste) {
    return new Response('Paste not found', { status: 404 });
  }
  
  // Safely extract metadata with fallbacks
  let metadata: PasteMetadata;
  try {
    metadata = paste.customMetadata as unknown as PasteMetadata;
  } catch (err) {
    // Use default metadata if retrieval fails
    metadata = {
      contentType: 'text/plain',
      isOneTime: false,
      createdAt: Date.now()
    };
    console.error(`Error retrieving metadata for paste ${id}: ${err}`);
  }
  
  // Get the content buffer before deletion
  const content = await paste.arrayBuffer();
  
  // If it's a one-time paste, delete it immediately before returning the response
  if (metadata && metadata.isOneTime === true) {
    try {
      console.log(`[TEMP PASTE] Deleting one-time paste with ID: ${id}`);
      // Delete immediately and ensure it completes before returning the response
      await env.PASTE_BUCKET.delete(id);
      console.log(`[TEMP PASTE] Immediate deletion of one-time paste ${id} successful`);
    } catch (error) {
      console.error(`[TEMP PASTE] Error during immediate deletion of one-time paste ${id}: ${error}`);
      
      // If the immediate deletion fails, try a second time and wait for it to complete
      try {
        console.log(`[TEMP PASTE] Attempting second deletion for paste ${id}`);
        await env.PASTE_BUCKET.delete(id);
        console.log(`[TEMP PASTE] Second deletion of one-time paste ${id} successful`);
      } catch (secondError) {
        console.error(`[TEMP PASTE] Second deletion of one-time paste ${id} failed: ${secondError}`);
        
        // Only as a last resort, schedule a retry deletion
        ctx.waitUntil(
          (async () => {
            try {
              console.log(`[TEMP PASTE] Attempting final retry deletion for paste ${id}`);
              await env.PASTE_BUCKET.delete(id);
              console.log(`[TEMP PASTE] Final retry deletion of one-time paste ${id} successful`);
            } catch (retryError) {
              console.error(`[TEMP PASTE] Final retry deletion of one-time paste ${id} failed: ${retryError}`);
            }
          })()
        );
        
        // Return a special error message if we couldn't delete the paste after multiple attempts
        return new Response('This one-time paste could not be properly processed. Please try again later.', { 
          status: 500,
          headers: {
            'Content-Type': 'text/plain',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          }
        });
      }
    }
    
    // Verify the paste is actually deleted before returning content
    const verifyDeleted = await env.PASTE_BUCKET.head(id);
    if (verifyDeleted !== null) {
      console.error(`[TEMP PASTE] Paste ${id} still exists after deletion attempts`);
      return new Response('This one-time paste could not be properly processed. Please try again later.', { 
        status: 500,
        headers: {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        }
      });
    }
  }
  
  // Return the paste content with robust caching headers
  return new Response(content, {
    headers: {
      'Content-Type': metadata.contentType || 'text/plain',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      // Add a header to indicate if the paste is encrypted
      'X-Encrypted': isEncrypted ? 'true' : 'false',
    },
  });
}