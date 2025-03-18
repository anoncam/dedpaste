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

      // Try to serve styles.css directly if [site] configuration doesn't work
      if (path === '/styles.css') {
        // Fallback CSS in case the site asset isn't found
        const cssContent = `*,:after,:before{--tw-border-spacing-x:0;--tw-border-spacing-y:0;--tw-translate-x:0;--tw-translate-y:0;--tw-rotate:0;--tw-skew-x:0;--tw-skew-y:0;--tw-scale-x:1;--tw-scale-y:1;--tw-pan-x: ;--tw-pan-y: ;--tw-pinch-zoom: ;--tw-scroll-snap-strictness:proximity;--tw-gradient-from-position: ;--tw-gradient-via-position: ;--tw-gradient-to-position: ;--tw-ordinal: ;--tw-slashed-zero: ;--tw-numeric-figure: ;--tw-numeric-spacing: ;--tw-numeric-fraction: ;--tw-ring-inset: ;--tw-ring-offset-width:0px;--tw-ring-offset-color:#fff;--tw-ring-color:rgba(59,130,246,.5);--tw-ring-offset-shadow:0 0 #0000;--tw-ring-shadow:0 0 #0000;--tw-shadow:0 0 #0000;--tw-shadow-colored:0 0 #0000;--tw-blur: ;--tw-brightness: ;--tw-contrast: ;--tw-grayscale: ;--tw-hue-rotate: ;--tw-invert: ;--tw-saturate: ;--tw-sepia: ;--tw-drop-shadow: ;--tw-backdrop-blur: ;--tw-backdrop-brightness: ;--tw-backdrop-contrast: ;--tw-backdrop-grayscale: ;--tw-backdrop-hue-rotate: ;--tw-backdrop-invert: ;--tw-backdrop-opacity: ;--tw-backdrop-saturate: ;--tw-backdrop-sepia: ;--tw-contain-size: ;--tw-contain-layout: ;--tw-contain-paint: ;--tw-contain-style: }::backdrop{--tw-border-spacing-x:0;--tw-border-spacing-y:0;--tw-translate-x:0;--tw-translate-y:0;--tw-rotate:0;--tw-skew-x:0;--tw-skew-y:0;--tw-scale-x:1;--tw-scale-y:1;--tw-pan-x: ;--tw-pan-y: ;--tw-pinch-zoom: ;--tw-scroll-snap-strictness:proximity;--tw-gradient-from-position: ;--tw-gradient-via-position: ;--tw-gradient-to-position: ;--tw-ordinal: ;--tw-slashed-zero: ;--tw-numeric-figure: ;--tw-numeric-spacing: ;--tw-numeric-fraction: ;--tw-ring-inset: ;--tw-ring-offset-width:0px;--tw-ring-offset-color:#fff;--tw-ring-color:rgba(59,130,246,.5);--tw-ring-offset-shadow:0 0 #0000;--tw-ring-shadow:0 0 #0000;--tw-shadow:0 0 #0000;--tw-shadow-colored:0 0 #0000;--tw-blur: ;--tw-brightness: ;--tw-contrast: ;--tw-grayscale: ;--tw-hue-rotate: ;--tw-invert: ;--tw-saturate: ;--tw-sepia: ;--tw-drop-shadow: ;--tw-backdrop-blur: ;--tw-backdrop-brightness: ;--tw-backdrop-contrast: ;--tw-backdrop-grayscale: ;--tw-backdrop-hue-rotate: ;--tw-backdrop-invert: ;--tw-backdrop-opacity: ;--tw-backdrop-saturate: ;--tw-backdrop-sepia: ;--tw-contain-size: ;--tw-contain-layout: ;--tw-contain-paint: ;--tw-contain-style: }/*! tailwindcss v3.4.17 | MIT License | https://tailwindcss.com*/*,:after,:before{box-sizing:border-box;border:0 solid #e5e7eb}:after,:before{--tw-content:""}:host,html{line-height:1.5;-webkit-text-size-adjust:100%;-moz-tab-size:4;-o-tab-size:4;tab-size:4;font-family:Inter,system-ui,sans-serif;font-feature-settings:normal;font-variation-settings:normal;-webkit-tap-highlight-color:transparent}body{margin:0;line-height:inherit}hr{height:0;color:inherit;border-top-width:1px}abbr:where([title]){-webkit-text-decoration:underline dotted;text-decoration:underline dotted}h1,h2,h3,h4,h5,h6{font-size:inherit;font-weight:inherit}a{color:inherit;text-decoration:inherit}b,strong{font-weight:bolder}code,kbd,pre,samp{font-family:Fira Code,monospace;font-feature-settings:normal;font-variation-settings:normal;font-size:1em}small{font-size:80%}sub,sup{font-size:75%;line-height:0;position:relative;vertical-align:baseline}sub{bottom:-.25em}sup{top:-.5em}table{text-indent:0;border-color:inherit;border-collapse:collapse}button,input,optgroup,select,textarea{font-family:inherit;font-feature-settings:inherit;font-variation-settings:inherit;font-size:100%;font-weight:inherit;line-height:inherit;letter-spacing:inherit;color:inherit;margin:0;padding:0}button,select{text-transform:none}button,input:where([type=button]),input:where([type=reset]),input:where([type=submit]){-webkit-appearance:button;background-color:transparent;background-image:none}:-moz-focusring{outline:auto}:-moz-ui-invalid{box-shadow:none}progress{vertical-align:baseline}::-webkit-inner-spin-button,::-webkit-outer-spin-button{height:auto}[type=search]{-webkit-appearance:textfield;outline-offset:-2px}::-webkit-search-decoration{-webkit-appearance:none}::-webkit-file-upload-button{-webkit-appearance:button;font:inherit}summary{display:list-item}blockquote,dd,dl,figure,h1,h2,h3,h4,h5,h6,hr,p,pre{margin:0}fieldset{margin:0}fieldset,legend{padding:0}menu,ol,ul{list-style:none;margin:0;padding:0}dialog{padding:0}textarea{resize:vertical}input::-moz-placeholder,textarea::-moz-placeholder{opacity:1;color:#9ca3af}input::placeholder,textarea::placeholder{opacity:1;color:#9ca3af}[role=button],button{cursor:pointer}:disabled{cursor:default}audio,canvas,embed,iframe,img,object,svg,video{display:block;vertical-align:middle}img,video{max-width:100%;height:auto}[hidden]:where(:not([hidden=until-found])){display:none}html{--tw-bg-opacity:1;background-color:rgb(24 23 28/var(--tw-bg-opacity,1));--tw-text-opacity:1;color:rgb(243 244 246/var(--tw-text-opacity,1))}h1,h2,h3,h4,h5,h6{font-weight:600;--tw-text-opacity:1;color:rgb(255 255 255/var(--tw-text-opacity,1))}h1{font-size:1.875rem;line-height:2.25rem}@media (min-width:768px){h1{font-size:2.25rem;line-height:2.5rem}}h2{font-size:1.5rem;line-height:2rem}@media (min-width:768px){h2{font-size:1.875rem;line-height:2.25rem}}h3{font-size:1.25rem;line-height:1.75rem}@media (min-width:768px){h3{font-size:1.5rem;line-height:2rem}}a{color:rgb(143 143 255/var(--tw-text-opacity,1));transition-property:color,background-color,border-color,text-decoration-color,fill,stroke;transition-timing-function:cubic-bezier(.4,0,.2,1);transition-duration:.15s}a,a:hover{--tw-text-opacity:1}a:hover{color:rgb(187 195 255/var(--tw-text-opacity,1))}pre{overflow:auto;border-radius:.5rem;border-width:1px;--tw-border-opacity:1;border-color:rgb(74 73 82/var(--tw-border-opacity,1));--tw-bg-opacity:1;background-color:rgb(44 43 49/var(--tw-bg-opacity,1));padding:1rem;font-size:.875rem;line-height:1.25rem}code{font-family:Fira Code,monospace;--tw-text-opacity:1;color:rgb(243 244 246/var(--tw-text-opacity,1))}.container{width:100%}@media (min-width:640px){.container{max-width:640px}}@media (min-width:768px){.container{max-width:768px}}@media (min-width:1024px){.container{max-width:1024px}}@media (min-width:1280px){.container{max-width:1280px}}@media (min-width:1536px){.container{max-width:1536px}}.btn-primary{display:inline-flex;align-items:center;justify-content:center;border-radius:.375rem;padding:.5rem 1rem;font-weight:500;transition-property:color,background-color,border-color,text-decoration-color,fill,stroke;transition-timing-function:cubic-bezier(.4,0,.2,1);transition-duration:.15s}.btn-primary:focus{outline:2px solid transparent;outline-offset:2px;--tw-ring-offset-shadow:var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);--tw-ring-shadow:var(--tw-ring-inset) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color);box-shadow:var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow,0 0 #0000);--tw-ring-offset-width:2px;--tw-ring-offset-color:#18171c}.btn-primary{--tw-bg-opacity:1;background-color:rgb(99 74 255/var(--tw-bg-opacity,1));--tw-text-opacity:1;color:rgb(255 255 255/var(--tw-text-opacity,1))}.btn-primary:hover{--tw-bg-opacity:1;background-color:rgb(82 49 244/var(--tw-bg-opacity,1))}.btn-primary:focus{--tw-ring-opacity:1;--tw-ring-color:rgb(123 95 255/var(--tw-ring-opacity,1))}.btn-secondary{display:inline-flex;align-items:center;justify-content:center;border-radius:.375rem;padding:.5rem 1rem;font-weight:500;transition-property:color,background-color,border-color,text-decoration-color,fill,stroke;transition-timing-function:cubic-bezier(.4,0,.2,1);transition-duration:.15s}.btn-secondary:focus{outline:2px solid transparent;outline-offset:2px;--tw-ring-offset-shadow:var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);--tw-ring-shadow:var(--tw-ring-inset) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color);box-shadow:var(--tw-ring-offset-shadow),var(--tw-ring-shadow),var(--tw-shadow,0 0 #0000);--tw-ring-offset-width:2px;--tw-ring-offset-color:#18171c}.btn-secondary{--tw-bg-opacity:1;background-color:rgb(50 78 103/var(--tw-bg-opacity,1));--tw-text-opacity:1;color:rgb(255 255 255/var(--tw-text-opacity,1))}.btn-secondary:hover{--tw-bg-opacity:1;background-color:rgb(43 63 85/var(--tw-bg-opacity,1))}.btn-secondary:focus{--tw-ring-opacity:1;--tw-ring-color:rgb(78 122 155/var(--tw-ring-opacity,1))}.card{border-radius:.5rem;border-width:1px;--tw-border-opacity:1;border-color:rgb(74 73 82/var(--tw-border-opacity,1));--tw-bg-opacity:1;background-color:rgb(44 43 49/var(--tw-bg-opacity,1));padding:1.5rem;--tw-shadow:0 4px 6px -1px rgba(0,0,0,.1),0 2px 4px -2px rgba(0,0,0,.1);--tw-shadow-colored:0 4px 6px -1px var(--tw-shadow-color),0 2px 4px -2px var(--tw-shadow-color);box-shadow:var(--tw-ring-offset-shadow,0 0 #0000),var(--tw-ring-shadow,0 0 #0000),var(--tw-shadow)}.feature-tag{display:inline-flex;align-items:center;border-radius:9999px;background-color:rgba(59,31,178,.3);padding:.125rem .625rem;font-size:.875rem;line-height:1.25rem;font-weight:500;--tw-text-opacity:1;color:rgb(187 195 255/var(--tw-text-opacity,1))}.mx-auto{margin-left:auto;margin-right:auto}.mb-1{margin-bottom:.25rem}.mb-12{margin-bottom:3rem}.mb-16{margin-bottom:4rem}.mb-2{margin-bottom:.5rem}.mb-4{margin-bottom:1rem}.mb-6{margin-bottom:1.5rem}.mb-8{margin-bottom:2rem}.mr-2{margin-right:.5rem}.flex{display:flex}.grid{display:grid}.h-5{height:1.25rem}.min-h-screen{min-height:100vh}.w-5{width:1.25rem}.max-w-3xl{max-width:48rem}.max-w-4xl{max-width:56rem}.items-center{align-items:center}.justify-between{justify-content:space-between}.gap-6{gap:1.5rem}.gap-8{gap:2rem}.space-x-4>:not([hidden])~:not([hidden]){--tw-space-x-reverse:0;margin-right:calc(1rem*var(--tw-space-x-reverse));margin-left:calc(1rem*(1 - var(--tw-space-x-reverse)))}.space-y-2>:not([hidden])~:not([hidden]){--tw-space-y-reverse:0;margin-top:calc(.5rem*(1 - var(--tw-space-y-reverse)));margin-bottom:calc(.5rem*var(--tw-space-y-reverse))}.space-y-4>:not([hidden])~:not([hidden]){--tw-space-y-reverse:0;margin-top:calc(1rem*(1 - var(--tw-space-y-reverse)));margin-bottom:calc(1rem*var(--tw-space-y-reverse))}.space-y-6>:not([hidden])~:not([hidden]){--tw-space-y-reverse:0;margin-top:calc(1.5rem*(1 - var(--tw-space-y-reverse)));margin-bottom:calc(1.5rem*var(--tw-space-y-reverse))}.border-b{border-bottom-width:1px}.border-t{border-top-width:1px}.border-dark-700{--tw-border-opacity:1;border-color:rgb(74 73 82/var(--tw-border-opacity,1))}.bg-dark-800{--tw-bg-opacity:1;background-color:rgb(44 43 49/var(--tw-bg-opacity,1))}.bg-dark-900{--tw-bg-opacity:1;background-color:rgb(24 23 28/var(--tw-bg-opacity,1))}.px-4{padding-left:1rem;padding-right:1rem}.py-6{padding-top:1.5rem;padding-bottom:1.5rem}.py-8{padding-top:2rem;padding-bottom:2rem}.pb-2{padding-bottom:.5rem}.text-center{text-align:center}.text-2xl{font-size:1.5rem;line-height:2rem}.text-3xl{font-size:1.875rem;line-height:2.25rem}.text-xl{font-size:1.25rem;line-height:1.75rem}.font-bold{font-weight:700}.font-semibold{font-weight:600}.text-danger{--tw-text-opacity:1;color:rgb(207 102 121/var(--tw-text-opacity,1))}.text-gray-100{--tw-text-opacity:1;color:rgb(243 244 246/var(--tw-text-opacity,1))}.text-gray-300{--tw-text-opacity:1;color:rgb(209 213 219/var(--tw-text-opacity,1))}.text-gray-400{--tw-text-opacity:1;color:rgb(156 163 175/var(--tw-text-opacity,1))}.text-primary-400{--tw-text-opacity:1;color:rgb(143 143 255/var(--tw-text-opacity,1))}.text-white{--tw-text-opacity:1;color:rgb(255 255 255/var(--tw-text-opacity,1))}.hover\\:text-primary-300:hover{--tw-text-opacity:1;color:rgb(187 195 255/var(--tw-text-opacity,1))}@media (min-width:768px){.md\\:grid-cols-2{grid-template-columns:repeat(2,minmax(0,1fr))}.md\\:px-6{padding-left:1.5rem;padding-right:1.5rem}.md\\:text-3xl{font-size:1.875rem;line-height:2.25rem}.md\\:text-4xl{font-size:2.25rem;line-height:2.5rem}}@media (min-width:1024px){.lg\\:grid-cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}}`;
        
        console.log('Serving fallback CSS file');
        return new Response(cssContent, {
          headers: {
            'Content-Type': 'text/css',
            'Cache-Control': 'public, max-age=86400',
          },
        });
      }
      
      // Serve the HTML homepage
      if (path === '/') {
        return new Response(generateHomepage(url.origin), {
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

function generateHomepage(origin: string): string {
  return `<!DOCTYPE html>
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
            <pre><code># List all your keys
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
  </footer>
</body>
</html>`;
}

async function handleUpload(request: Request, env: Env, isOneTime: boolean, isEncrypted: boolean): Promise<Response> {
  const contentType = request.headers.get('Content-Type') || 'text/plain';
  const content = await request.arrayBuffer();
  
  // Check if the content is empty
  if (content.byteLength === 0) {
    return new Response('Content cannot be empty', { status: 400 });
  }
  
  // Generate a unique ID for the paste
  let id = generateId();
  
  // Ensure encrypted content is always stored with the correct content type
  // This fixes issues with one-time encrypted pastes
  const adjustedContentType = isEncrypted ? 'application/json' : contentType;
  
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
    
    console.log(`Created one-time paste with storage key ${storageKey}, isEncrypted=${isEncrypted}`);
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
    console.log(`[TEMP PASTE] Found one-time paste with ID: ${id}, isEncrypted=${isEncrypted}`);
    
    // Get the content and metadata before we delete the paste
    const content = await oneTimePaste.arrayBuffer();
    let contentType = 'text/plain';
    
    try {
      const metadata = oneTimePaste.customMetadata as unknown as PasteMetadata;
      contentType = metadata.contentType || 'text/plain';
      console.log(`[TEMP PASTE] Content type from metadata: ${contentType}`);
    } catch (err) {
      console.error(`[TEMP PASTE] Error retrieving metadata for one-time paste ${id}: ${err}`);
    }
    
    // Override content type if this is an encrypted paste but the content type doesn't match
    // This ensures proper decryption on the client side
    if (isEncrypted && contentType !== 'application/json') {
      console.log(`[TEMP PASTE] Overriding content type for encrypted paste from ${contentType} to application/json`);
      contentType = 'application/json';
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
        'X-One-Time': 'true', // Mark as one-time paste explicitly
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
    console.log(`[REGULAR PASTE] Content type from metadata: ${contentType}`);
  } catch (err) {
    console.error(`Error retrieving metadata for paste ${id}: ${err}`);
  }
  
  // Override content type if this is an encrypted paste but the content type doesn't match
  // This ensures proper decryption on the client side
  if (isEncrypted && contentType !== 'application/json') {
    console.log(`[REGULAR PASTE] Overriding content type for encrypted paste from ${contentType} to application/json`);
    contentType = 'application/json';
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