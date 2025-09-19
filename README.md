# DedPaste 🔐

A secure, privacy-focused pastebin CLI application powered by Cloudflare Workers and R2 storage with advanced encryption capabilities and a modern Material-UI web interface.

## ✨ Features

### 🔒 Security & Privacy
- **End-to-end encryption** - All encryption happens client-side
- **One-time pastes** - Self-destructing content after first view
- **PGP/GPG support** - Full integration with existing PGP infrastructure
- **RSA key pairs** - Support for PEM format keys
- **Friend-to-friend encryption** - Manage keys for trusted contacts
- **Keybase integration** - Import keys with proof verification
- **Zero-knowledge architecture** - Server never sees unencrypted content

### 🛠️ Developer Features
- **CLI-first design** - Powerful command-line interface
- **Script integration** - Easy to use in automation workflows
- **Binary file support** - Upload any file type with proper MIME detection
- **Interactive key management** - Enhanced mode for complex operations
- **Multiple encryption methods** - RSA, PGP, symmetric encryption
- **Markdown rendering** - Automatic syntax highlighting for code

### 🎨 User Interface
- **Modern Material-UI design** - Clean, responsive web interface
- **Dark theme** - Easy on the eyes for extended use
- **Mobile-friendly** - Works great on all devices
- **Syntax highlighting** - Support for 15+ programming languages
- **Copy-to-clipboard** - One-click copying of content

### 📦 Infrastructure
- **Cloudflare Workers** - Global edge deployment
- **R2 Storage** - Cost-effective object storage
- **SBOM included** - Software Bill of Materials with each release
- **TypeScript** - Fully typed for better developer experience

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

### Shell Auto-Completion

DedPaste includes built-in commands to set up shell completion for Bash and Zsh:

#### For Bash

```bash
# Generate the completion script
dedpaste completion --bash > ~/.dedpaste-completion.bash

# Add this to your ~/.bashrc
echo 'source ~/.dedpaste-completion.bash' >> ~/.bashrc

# Apply changes to current session
source ~/.bashrc
```

#### For Zsh

```bash
# Generate the completion script
dedpaste completion --zsh > ~/.dedpaste-completion.zsh

# Add this to your ~/.zshrc
echo 'source ~/.dedpaste-completion.zsh' >> ~/.zshrc

# Apply changes to current session
source ~/.zshrc
```

## 🚀 Quick Start

```bash
# Install globally
npm install -g dedpaste

# Create your first paste
echo "Hello, World!" | dedpaste

# Generate encryption keys (one-time setup)
dedpaste keys --gen-key

# Create an encrypted paste
echo "Secret message" | dedpaste send --encrypt

# Create a self-destructing paste
echo "Confidential" | dedpaste send --one-time
```

## 📖 Usage

DedPaste CLI has six main command modes:

1. **Default mode** - Basic paste operations (no subcommand)
2. **`keys`** - Key management operations
3. **`keys:enhanced`** - Enhanced interactive key management (recommended)
4. **`send`** - Create and send encrypted pastes
5. **`get`** - Retrieve and decrypt pastes
6. **`completion`** - Generate shell auto-completion scripts

### Basic Usage (Default Command)

```bash
# Post content from stdin
echo "Hello, world!" | dedpaste

# Post content from a file
dedpaste < file.txt

# Post with a specific file (using --file flag)
dedpaste --file path/to/file.txt

# Post one-time content (deleted after first view)
echo "Secret message" | dedpaste --temp

# Post with custom content type
dedpaste --type application/json < data.json

# Output only the URL (useful for scripts)
echo "content" | dedpaste --output

# Post encrypted content (for yourself)
echo "Secret data" | dedpaste --encrypt
```

### Key Management (`keys` and `keys:enhanced` Commands)

```bash
# Generate a new key pair (required before encryption)
dedpaste keys --gen-key

# List all your keys (yours and friends')
dedpaste keys --list

# Add a friend's public key
dedpaste keys --add-friend alice --key-file alice_public.pem

# Export your public key to share with friends
dedpaste keys --export

# Output your public key to the console
dedpaste keys --my-key

# Remove a friend's key
dedpaste keys --remove alice

# Interactive key management (menu-driven interface)
dedpaste keys --interactive

# Enhanced interactive key management (recommended - full TUI interface)
dedpaste keys:enhanced
```

### PGP Integration

```bash
# Add a PGP key from keyservers by email
dedpaste keys --pgp-key user@example.com

# Add a PGP key from keyservers by key ID
dedpaste keys --pgp-key 0x1234ABCD

# Add with custom name
dedpaste keys --pgp-key user@example.com --pgp-name alice

# Send with native PGP encryption (IMPORTANT: requires --for parameter)
echo "secret" | dedpaste send --encrypt --for user@example.com --pgp

# Decrypt a paste with PGP key
dedpaste get https://paste.d3d.dev/e/AbCdEfGh --pgp-key-file key.pgp
```

### Keybase Integration

```bash
# Add a Keybase user's key
dedpaste keys --keybase username

# Add with custom name
dedpaste keys --keybase username --keybase-name bob

# Skip verification of proofs
dedpaste keys --keybase username --no-verify

# Send to a Keybase user
echo "secret" | dedpaste send --encrypt --for keybase:username
```

### Sending Encrypted Pastes (`send` Command)

```bash
# List available friends for encryption
dedpaste send --list-friends

# Send an encrypted message to a friend
echo "Secret message for Alice" | dedpaste send --encrypt --for alice

# Send an encrypted one-time message to a friend
echo "Secret one-time message" | dedpaste send --encrypt --for alice --temp

# Send an encrypted file to a friend
dedpaste send --encrypt --for alice --file secret.txt

# Interactive mode for sending encrypted messages
dedpaste send --interactive --encrypt
```

### Retrieving Pastes (`get` Command)

```bash
# Get and display a regular paste
dedpaste get https://paste.d3d.dev/AbCdEfGh

# Get and decrypt an encrypted paste
dedpaste get https://paste.d3d.dev/e/AbCdEfGh

# Get a paste using just the ID
dedpaste get AbCdEfGh

# Get an encrypted paste using a specific private key file
dedpaste get https://paste.d3d.dev/e/AbCdEfGh --key-file /path/to/private.pem
```

## Documentation

Documentation for DedPaste is organized in the `docs/` directory:

- [Contributing Guide](docs/CONTRIBUTING.md) - How to contribute to the project
- [Release Process](docs/RELEASE-PROCESS.md) - How releases are managed
- [Testing Guide](docs/TESTING.md) - How to test the application
- [Encryption Implementation Plan](docs/encryption-implementation-plan.md) - Details on the encryption design
- [Encryption Implementation Summary](docs/encryption-implementation-summary.md) - Overview of encryption features
- [Shell Completion](docs/completion/README.md) - Documentation for shell completion scripts

## Troubleshooting

For detailed troubleshooting information, please see the [Troubleshooting Guide](docs/troubleshooting.md).

### Common Errors and Solutions

#### PGP Encryption Issues

- **Error**: `PGP encryption requires a recipient, use --for <recipient> to specify one`
  **Solution**: Always include a recipient when using PGP encryption:
  ```bash
  echo "secret" | dedpaste send --encrypt --for user@example.com --pgp
  ```

- **Error**: `Failed to find PGP key for recipient`
  **Solution**: Make sure you've added the recipient's PGP key first:
  ```bash
  dedpaste keys --pgp-key user@example.com
  ```

## Security Considerations

- **End-to-End Encryption**: All encryption happens client-side; the server never sees your unencrypted content
- **Key Storage**: Keep your private keys secure; if lost, encrypted content cannot be recovered
- **One-Time Pastes**: Use `--temp` for sensitive content to ensure it's deleted after viewing
- **Key Verification**: Always verify key fingerprints for critical communications
- **Passphrase Protection**: Consider using passphrase-protected keys for additional security

## Configuration

You can configure the CLI using environment variables:

- `DEDPASTE_API_URL`: Set the URL of your deployed Cloudflare Worker (default is https://paste.d3d.dev)
  ```bash
  export DEDPASTE_API_URL="https://your-worker.example.com"
  ```


## 🎨 UI Development

The web interface uses **Material-UI (MUI)** design system for a modern, responsive experience. The UI features:

- **Dark theme** optimized for readability
- **Responsive design** that works on all devices
- **Interactive components** with smooth animations
- **Syntax highlighting** for code and markdown
- **Accessibility** built into every component

### Development

```bash
# Start the development server
npm run dev

# Build for production
npm run build

# Deploy to Cloudflare Workers
npm run deploy
```

## 🔧 Technical Stack

- **Backend**: Cloudflare Workers (Edge computing)
- **Storage**: Cloudflare R2 (S3-compatible object storage)
- **UI Framework**: Material-UI with custom theming
- **Languages**: TypeScript for type safety
- **Encryption**: RSA, PGP/GPG, AES-256
- **CLI**: Node.js with Commander.js

## 📦 Releases

Each release includes:
- Pre-built CLI binaries
- Comprehensive Software Bill of Materials (SBOM)
- Detailed release notes
- NPM package with provenance

View all releases: [GitHub Releases](https://github.com/anoncam/dedpaste/releases)

## 🤝 Contributing

Contributions are welcome! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- Cloudflare Workers team for the excellent edge platform
- Material-UI team for the beautiful component library
- The open-source community for various encryption libraries

---

<p align="center">
  Made with ❤️ for privacy enthusiasts
  <br>
  <a href="https://paste.d3d.dev">paste.d3d.dev</a> • <a href="https://github.com/anoncam/dedpaste">GitHub</a> • <a href="https://www.npmjs.com/package/dedpaste">NPM</a>
</p>