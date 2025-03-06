# DedPaste

A simple pastebin CLI application powered by Cloudflare Workers and R2 storage.

## Features

- Upload plain text or binary files to a pastebin service
- Get a unique URL that can be shared with others
- Create one-time pastes that are deleted after first view
- Command-line interface for easy integration with scripts and tools

## Installation

### Using npm (recommended)

```bash
npm install -g dedpaste
```

This will install the CLI globally, allowing you to use the `dedpaste` command from anywhere.

### From source

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Link for local development:
   ```bash
   npm link
   ```

## Usage

### Command Line

```bash
# Post content
echo "Hello, world!" | dedpaste

# Post content from a file
dedpaste < file.txt

# Post with a specific file
dedpaste --file path/to/file.txt

# Post one-time content (deleted after first view)
echo "Secret message" | dedpaste --temp

# Post with custom content type
dedpaste --type application/json < data.json

# Output only the URL (useful for scripts)
echo "content" | dedpaste --output
```

### API Usage

```bash
# Post content
curl -X POST -H "Content-Type: text/plain" --data "Your content here" https://paste.d3d.dev/upload

# Post one-time content
curl -X POST -H "Content-Type: text/plain" --data "Your secret content here" https://paste.d3d.dev/temp

# Get content
curl https://paste.d3d.dev/{paste-id}
```

## Configuration

You can configure the CLI using environment variables:

- `DEDPASTE_API_URL`: Set the URL of your deployed Cloudflare Worker (default is https://paste.d3d.dev)
  ```bash
  export DEDPASTE_API_URL="https://your-worker.example.com"
  ```

## Self-Deployment Guide

This section provides detailed instructions on how to deploy your own instance of DedPaste.

### Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher)
- [Cloudflare](https://cloudflare.com) account
- Cloudflare Workers subscription (has a generous free tier)
- Cloudflare R2 storage subscription (has a generous free tier)

### Step 1: Clone the Repository

```bash
git clone https://github.com/anoncam/dedpaste.git
cd dedpaste
npm install
```

### Step 2: Set Up Cloudflare R2 Bucket

1. Log in to your Cloudflare dashboard
2. Navigate to R2 > Buckets
3. Create a new bucket named `dedpaste-bucket`
4. Create another bucket named `dedpaste-bucket-preview` for development/testing

### Step 3: Configure Wrangler (Cloudflare Worker CLI)

1. Install Wrangler globally if you haven't already:
   ```bash
   npm install -g wrangler
   ```

2. Log in to your Cloudflare account via Wrangler:
   ```bash
   wrangler login
   ```

3. Review and customize the `wrangler.toml` file if necessary:
   - Ensure the R2 bucket names match the ones you created
   - You can change the worker name if desired

```toml
name = "dedpaste"
main = "src/index.ts"
compatibility_date = "2023-10-02"

[[r2_buckets]]
binding = "PASTE_BUCKET"
bucket_name = "dedpaste-bucket"
preview_bucket_name = "dedpaste-bucket-preview"
```

### Step 4: Deploy Your Worker

```bash
npm run deploy
```

This will deploy your worker to Cloudflare. The output will show the URL of your deployed worker, which should look like `https://dedpaste.<your-subdomain>.workers.dev`.

### Step 5: Test Your Deployment

Test that your worker is functioning correctly:

```bash
curl -X POST -H "Content-Type: text/plain" --data "Test content" https://dedpaste.<your-subdomain>.workers.dev/upload
```

You should receive a URL in response. Visit that URL to verify that your content was uploaded successfully.

### Step 6: Configure the CLI for Your Worker

If you want to use the dedpaste CLI with your own worker, set the `DEDPASTE_API_URL` environment variable:

```bash
export DEDPASTE_API_URL="https://dedpaste.<your-subdomain>.workers.dev"
```

Add this to your shell profile (.bashrc, .zshrc, etc.) to make it permanent:

```bash
echo 'export DEDPASTE_API_URL="https://dedpaste.<your-subdomain>.workers.dev"' >> ~/.bashrc
# Or for ZSH
echo 'export DEDPASTE_API_URL="https://dedpaste.<your-subdomain>.workers.dev"' >> ~/.zshrc
```

### Step 7: Custom Domain (Optional)

To use a custom domain with your DedPaste instance:

1. In your Cloudflare dashboard, go to the Workers & Pages section
2. Find your dedpaste worker and click on it
3. Go to Triggers > Custom Domains
4. Add your custom domain (e.g., paste.yourdomain.com)
5. Follow the instructions to verify domain ownership and configure DNS

After setting up your custom domain, update your `DEDPASTE_API_URL` environment variable:

```bash
export DEDPASTE_API_URL="https://paste.yourdomain.com"
```

## Customization

### Worker Customization

You can customize the Worker behavior by modifying `src/index.ts`:

- Change the ID generation algorithm
- Modify paste expiration behavior
- Add authentication
- Change CORS settings
- Customize the homepage HTML

### CLI Customization

You can customize the CLI behavior by modifying `cli/index.js`:

- Add new commands
- Change output formatting
- Add authentication mechanisms
- Modify error handling

After making changes, build and deploy:

```bash
npm run build
npm run deploy
```

## Troubleshooting

### CORS Issues

If you're experiencing CORS issues when accessing your pastes from a browser:

1. Verify that the CORS headers in `src/index.ts` are properly configured
2. Make sure your client is making a proper CORS request

### R2 Storage Issues

If your pastes aren't being stored properly:

1. Check that your R2 buckets exist and are correctly named in wrangler.toml
2. Verify that your Cloudflare Worker has proper permissions to access R2

### CLI Connection Issues

If the CLI can't connect to your worker:

1. Check that the `DEDPASTE_API_URL` environment variable is correctly set
2. Verify that your worker is deployed and accessible

## Security Considerations

- DedPaste doesn't implement authentication out of the box. Anyone with your worker URL can create pastes.
- Consider adding authentication if you're using it in a sensitive environment.
- The data is stored in Cloudflare R2, which provides encryption at rest.
- One-time pastes are designed to be viewed only once but depend on proper client behavior.

## License

ISC