# DedPaste

A simple pastebin CLI application powered by Cloudflare Workers and R2 storage.

## Features

- Upload plain text or binary files to a pastebin service
- Get a unique URL that can be shared with others
- Create one-time pastes that are deleted after first view
- Command-line interface for easy integration with scripts and tools

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher)
- [Cloudflare](https://cloudflare.com) account with Workers and R2 access

### Deployment

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Deploy the Cloudflare Worker:
   ```
   npm run deploy
   ```

### CLI Installation

Install the CLI globally:

```bash
npm install -g .
```

Or link it for development:

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
curl -X POST -H "Content-Type: text/plain" --data "Your content here" https://your-worker.example.com/upload

# Post one-time content
curl -X POST -H "Content-Type: text/plain" --data "Your secret content here" https://your-worker.example.com/temp

# Get content
curl https://your-worker.example.com/{paste-id}
```

## Configuration

You can configure the CLI using environment variables:

- `DEDPASTE_API_URL`: Set the URL of your deployed Cloudflare Worker
  ```bash
  export DEDPASTE_API_URL="https://your-worker.example.com"
  ```

## License

ISC