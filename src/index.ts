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
  <title>DedPaste - Simple Pastebin Service</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #333; }
    pre { background: #f5f5f5; padding: 15px; border-radius: 5px; overflow: auto; }
    code { font-family: monospace; }
    .new { background-color: #e6ffe6; border-left: 3px solid #4CAF50; padding-left: 10px; }
  </style>
</head>
<body>
  <h1>DedPaste</h1>
  <p>A simple pastebin service with CLI client.</p>
  <h2>API Usage:</h2>
  <pre><code>
# Post content
curl -X POST -H "Content-Type: text/plain" --data "Your content here" ${url.origin}/upload

# Post one-time content (deleted after first view)
curl -X POST -H "Content-Type: text/plain" --data "Your content here" ${url.origin}/temp

<span class="new"># Post encrypted content (client-side encryption)
curl -X POST -H "Content-Type: text/plain" --data "Your encrypted content" ${url.origin}/e/upload

# Post encrypted one-time content
curl -X POST -H "Content-Type: text/plain" --data "Your encrypted content" ${url.origin}/e/temp</span>

# Get content
curl ${url.origin}/{paste-id}

<span class="new"># Get encrypted content
curl ${url.origin}/e/{paste-id}</span>
  </code></pre>
  <h2>Install CLI:</h2>
  <pre><code>npm install -g dedpaste</code></pre>
  <h2>CLI Usage:</h2>
  <pre><code>
# Post content
echo "content" | dedpaste

# Post file
dedpaste < file.txt

# Post one-time content
echo "secret" | dedpaste --temp

<span class="new"># Post encrypted content
echo "secret" | dedpaste --encrypt

# Post encrypted content with specific key
echo "secret" | dedpaste --encrypt --key-file ~/.ssh/id_rsa.pub

# Generate new key pair and encrypt
echo "secret" | dedpaste --encrypt --gen-key</span>

# Post with custom content type
dedpaste --type application/json < data.json
  </code></pre>
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
  
  // If it's a one-time paste, schedule a deletion
  // Double-check that we only delete pastes that are explicitly marked as one-time
  if (metadata && metadata.isOneTime === true) {
    console.log(`Deleting one-time paste: ${id}`);
    ctx.waitUntil(env.PASTE_BUCKET.delete(id));
  }
  
  // Return the paste content with robust caching headers
  return new Response(paste.body, {
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