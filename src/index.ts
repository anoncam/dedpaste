export interface Env {
  PASTE_BUCKET: R2Bucket;
}

type PasteMetadata = {
  contentType: string;
  isOneTime: boolean;
  createdAt: number;
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
      if (path === '/upload' || path === '/temp') {
        const isOneTime = path === '/temp';
        return await handleUpload(request, env, isOneTime);
      }
      return new Response('Not found', { status: 404 });
    }

    // Get a paste
    if (request.method === 'GET') {
      const match = path.match(/^\/([a-zA-Z0-9]{8})$/);
      if (match) {
        const id = match[1];
        return await handleGet(id, env, ctx);
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

# Get content
curl ${url.origin}/{paste-id}
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

async function handleUpload(request: Request, env: Env, isOneTime: boolean): Promise<Response> {
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
  await env.PASTE_BUCKET.put(id, content, {
    customMetadata: metadata as any,
  });
  
  const baseUrl = new URL(request.url).origin;
  const pasteUrl = `${baseUrl}/${id}`;

  // Return the paste URL
  return new Response(pasteUrl, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'text/plain',
    },
  });
}

async function handleGet(id: string, env: Env, ctx: ExecutionContext): Promise<Response> {
  // Get the paste from R2
  const paste = await env.PASTE_BUCKET.get(id);
  
  if (!paste) {
    return new Response('Paste not found', { status: 404 });
  }
  
  const metadata = paste.customMetadata as unknown as PasteMetadata;
  
  // If it's a one-time paste, schedule a deletion
  if (metadata.isOneTime) {
    ctx.waitUntil(env.PASTE_BUCKET.delete(id));
  }
  
  // Return the paste content
  return new Response(paste.body, {
    headers: {
      'Content-Type': metadata.contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    },
  });
}