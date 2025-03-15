# DedPaste

A simple pastebin CLI application powered by Cloudflare Workers and R2 storage.

## Features

- Upload plain text or binary files to a pastebin service
- Get a unique URL that can be shared with others
- Create one-time pastes that are deleted after first view
- End-to-end encryption for secure content sharing
- Support for RSA key pairs (PEM format)
- Friend-to-friend encryption with key management
- PGP keyserver integration for adding public keys
- Keybase user integration with proof verification
- Command-line interface for easy integration with scripts and tools
- Dark mode web interface for better readability

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

For more installation options:

```bash
# View Bash installation instructions
dedpaste completion --bash --install

# View Zsh installation instructions
dedpaste completion --zsh --install
```

## Usage

DedPaste CLI has five main command modes:

1. **Default mode** - Basic paste operations (no subcommand)
2. **`keys`** - Key management operations
3. **`send`** - Create and send encrypted pastes
4. **`get`** - Retrieve and decrypt pastes
5. **`completion`** - Generate shell auto-completion scripts

### Basic Usage (Default Command)

```bash
# Post content from stdin
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

# Post encrypted content (for yourself)
echo "Secret data" | dedpaste --encrypt
```

### Key Management (`keys` Command)

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
```

### PGP Integration

```bash
# Add a PGP key from keyservers by email
dedpaste keys --pgp-key user@example.com

# Add a PGP key from keyservers by key ID
dedpaste keys --pgp-key 0x1234ABCD

# Add with custom name
dedpaste keys --pgp-key user@example.com --pgp-name alice

# List all keys including PGP keys
dedpaste keys --list
```

### Keybase Integration

```bash
# Add a Keybase user's key
dedpaste keys --keybase username

# Add with custom name
dedpaste keys --keybase username --keybase-name bob

# Skip verification of proofs
dedpaste keys --keybase username --no-verify

# List all keys including Keybase keys
dedpaste keys --list
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

# Generate a new key pair and encrypt content in one command
echo "Secret data" | dedpaste send --encrypt --gen-key

# Interactive mode for sending encrypted messages
dedpaste send --interactive --encrypt

# Debug mode: show encrypted content without uploading
echo "Test encryption" | dedpaste send --encrypt --for alice --debug
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

### Auto-Completion (`completion` Command)

```bash
# Generate Bash completion script
dedpaste completion --bash > ~/.dedpaste-completion.bash

# Generate Zsh completion script
dedpaste completion --zsh > ~/.dedpaste-completion.zsh

# Show Bash installation instructions
dedpaste completion --bash --install

# Show Zsh installation instructions
dedpaste completion --zsh --install
```

### Interactive Mode

DedPaste provides interactive modes for key management and sending encrypted messages:

```bash
# Interactive key management
dedpaste keys --interactive
# This opens a menu with options to:
# - List all keys
# - Add a friend's key
# - Remove a key
# - Export your public key

# Interactive sending
dedpaste send --interactive --encrypt
# This guides you through:
# - Entering your message in a text editor
# - Selecting a recipient (yourself or a friend)
# - Choosing whether to create a one-time paste
```

### API Usage

```bash
# Post content
curl -X POST -H "Content-Type: text/plain" --data "Your content here" https://paste.d3d.dev/upload

# Post one-time content
curl -X POST -H "Content-Type: text/plain" --data "Your secret content here" https://paste.d3d.dev/temp

# Post encrypted content (client-side encryption required)
curl -X POST -H "Content-Type: application/json" --data "Your encrypted content" https://paste.d3d.dev/e/upload

# Post encrypted one-time content
curl -X POST -H "Content-Type: application/json" --data "Your encrypted content" https://paste.d3d.dev/e/temp

# Get content
curl https://paste.d3d.dev/{paste-id}

# Get encrypted content (requires client-side decryption)
curl https://paste.d3d.dev/e/{paste-id}
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
- Customize the homepage HTML and dark mode styling
- Modify the UI layout and feature presentation

### CLI Customization

You can customize the CLI behavior by modifying `cli/index.js`:

- Add new commands
- Change output formatting
- Add authentication mechanisms
- Modify error handling
- Customize encryption algorithms or key management
- Add support for additional key formats

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

## End-to-End Encryption

DedPaste supports end-to-end encryption, ensuring that your sensitive data remains private. All encryption and decryption happens client-side, meaning the server never sees the unencrypted content or has access to your encryption keys.

### How It Works

1. **Hybrid Encryption**: DedPaste uses a combination of asymmetric (RSA) and symmetric (AES-256-GCM) encryption:
   - A random symmetric key is generated for each paste
   - The content is encrypted with this symmetric key
   - The symmetric key is then encrypted with a public RSA key
   - Only someone with the corresponding private key can decrypt the content

2. **Key Management**:
   - You can generate a new key pair with `--gen-key` (recommended)
   - You can use existing PEM format keys with `--key-file`
   - Standard SSH keys are not directly supported, but the CLI will offer to generate compatible keys
   - Keys are stored in `~/.dedpaste/keys/` by default
   - Friend's public keys are stored in `~/.dedpaste/friends/`
   - PGP keys from keyservers are stored in `~/.dedpaste/pgp/`
   - Keybase user keys are stored in `~/.dedpaste/keybase/`
   - Key database is maintained at `~/.dedpaste/keydb.json`

3. **URL Format**:
   - Encrypted pastes have URLs with an `/e/` prefix (e.g., `https://paste.d3d.dev/e/AbCdEfGh`)
   - This helps the CLI automatically detect when decryption is needed

4. **Metadata and Versioning**:
   - Encrypted pastes include metadata about the sender and intended recipient
   - Version 2 format includes timestamps and fingerprints for verification
   - This allows the CLI to automatically determine if you can decrypt a paste
   - Legacy (version 1) pastes are still supported for backward compatibility

5. **PGP Integration**:
   - Add PGP keys directly from public keyservers
   - Fetch keys by email address or key ID
   - Keys automatically include metadata from PGP user IDs
   - Verifies key fingerprints for enhanced security
   - Uses multiple fallback keyservers for reliability

6. **Keybase Integration**:
   - Add keys directly from Keybase users
   - Optional verification of Keybase proofs
   - Integration with Keybase's web of trust
   - Automatic retrieval of metadata and fingerprints
   - Supports custom naming for added keys

### Key Storage Structure

```
~/.dedpaste/
  ├── keys/
  │   ├── private.pem  # Your private key
  │   └── public.pem   # Your public key
  ├── friends/
  │   ├── alice.pem    # Alice's public key
  │   └── bob.pem      # Bob's public key
  ├── pgp/
  │   └── user@example.com.asc  # PGP public key from keyserver
  ├── keybase/
  │   └── username.asc          # PGP public key from Keybase
  └── keydb.json               # Key database with metadata
```

The key database (`keydb.json`) tracks:
- Your personal key pair
- All friend public keys
- PGP keys fetched from keyservers
- Keybase user keys
- Key fingerprints for verification
- Creation and last-used timestamps
- Default friend settings
- Email addresses and Keybase usernames

### Security Benefits

- **Zero Knowledge**: The server has no knowledge of your encryption keys or plaintext content
- **Forward Secrecy**: Each paste uses a different symmetric key
- **Strong Encryption**: Uses industry-standard AES-256-GCM for content encryption
- **Key Security**: Private keys never leave your device
- **Recipient Verification**: Metadata ensures only the intended recipient can decrypt
- **Fingerprint Verification**: Key fingerprints help verify key authenticity

### Limitations and Troubleshooting

- If you lose your private key, encrypted pastes cannot be recovered
- The system doesn't provide key recovery mechanisms
- If you receive a "No personal key found" error, run `dedpaste keys --gen-key` first
- If you receive a "This paste was encrypted for X, not for you" error, it means you're trying to decrypt a paste intended for someone else
- Use `--debug` flag with the `send` command to test encryption without uploading

## PGP and Keybase Integration Guide

DedPaste provides deep integration with PGP keyservers and Keybase for enhanced key management and identity verification. With these features, you can leverage existing PGP keys or Keybase identities to securely share encrypted content.

### Comprehensive PGP Integration

#### Adding PGP Keys from Keyservers

```bash
# Add a PGP key by email address
dedpaste keys --pgp-key user@example.com

# Add a PGP key by key ID
dedpaste keys --pgp-key 1234ABCD

# Add a PGP key by full fingerprint
dedpaste keys --pgp-key D6263DD69C2E9A472CC40FAC0D83AE44DE87A5F6

# Add a PGP key with a custom name
dedpaste keys --pgp-key user@example.com --pgp-name alice
```

The CLI will:
1. Search multiple public keyservers (keys.openpgp.org, keyserver.ubuntu.com, pgp.mit.edu)
2. Download the public key if found
3. Extract metadata (name, email, key ID)
4. Store the key under the email address for easy identification
5. Add it to your key database with fingerprint information

DedPaste automatically prioritizes using email addresses as identifiers for PGP keys when available, making them easier to reference in encryption commands.

#### Importing Existing PGP Keys

```bash
# Import a PGP private key (for decryption)
dedpaste keys --import-pgp-key path/to/private.pgp --pgp-passphrase "your passphrase"

# Import a PGP public key file
dedpaste keys --add-friend pgp-user --key-file path/to/public.asc
```

When importing PGP private keys:
- The key is securely stored in `~/.dedpaste/pgp/`
- The passphrase is only used during import and is not stored
- The key is converted to a format compatible with dedpaste

#### Verifying PGP Keys

```bash
# List all keys including PGP keys
dedpaste keys --list
```

The output will show:
- The key name or email address
- The fingerprint for verification
- When the key was last used

You should always verify the fingerprint with the sender through a separate secure channel to ensure the key's authenticity.

#### Using PGP Encryption

DedPaste supports two approaches to PGP encryption:

1. **Standard Hybrid Encryption** (default):
   ```bash
   # Encrypt for a PGP key recipient using RSA/AES hybrid encryption
   echo "Secret message" | dedpaste send --encrypt --for user@example.com
   ```

2. **Native PGP Encryption**:
   ```bash
   # Use direct OpenPGP encryption (compatible with GnuPG/GPG)
   echo "Secret message" | dedpaste send --encrypt --for user@example.com --pgp
   
   # Use a specific PGP key file directly
   echo "Secret message" | dedpaste send --encrypt --pgp-key-file path/to/recipient.asc --pgp
   ```

#### Decrypting PGP Messages

```bash
# Decrypt a PGP-encrypted paste with your default private key
dedpaste get https://paste.d3d.dev/e/AbCdEfGh

# Decrypt with a specific PGP private key
dedpaste get https://paste.d3d.dev/e/AbCdEfGh --pgp-key-file path/to/private.pgp --pgp-passphrase "passphrase"
```

When a paste is encrypted with native PGP:
- The CLI automatically detects the encryption format
- It displays metadata about the recipient and key ID
- It securely handles passphrase entry and decryption

### Using Keybase Integration

#### Adding Keybase User Keys

```bash
# Add a Keybase user's public key
dedpaste keys --keybase username

# Add with a custom name
dedpaste keys --keybase username --keybase-name bob
```

The CLI will:
1. Connect to Keybase's API
2. Verify the user exists
3. Check their identity proofs (by default)
4. Fetch their public PGP key
5. Extract metadata and store the key

#### Bypassing Proof Verification

If you want to skip proof verification (not recommended for sensitive data):

```bash
# Skip verification of Keybase proofs
dedpaste keys --keybase username --no-verify
```

#### Using Keybase Keys

```bash
# List keys to see Keybase keys
dedpaste keys --list

# Encrypt to a Keybase user
echo "Secret message" | dedpaste send --encrypt --for keybase:username

# Or use the custom name if specified
echo "Secret message" | dedpaste send --encrypt --for bob
```

### Advanced Usage

#### Using Both PGP and Keybase in Interactive Mode

```bash
# Start interactive mode
dedpaste send --interactive --encrypt
```

The interactive mode will show all available keys, including PGP and Keybase keys, allowing you to select the recipient from a menu.

#### Removing Keys

```bash
# Remove any type of key (PGP, Keybase, or regular)
dedpaste keys --remove keyname
```

#### Multiple Key Sources

When encrypting to a recipient, DedPaste will search across all key sources (regular keys, PGP keys, and Keybase keys) to find the right recipient.

## Sending Encrypted Messages to a Friend

DedPaste makes it easy to securely share sensitive information with friends. Here's a step-by-step guide for both you and your friend to exchange encrypted messages:

### For the Sender (You)

1. **Set Up (First-time only)**:
   ```bash
   # Install DedPaste
   npm install -g dedpaste
   
   # Generate your encryption key pair (only needed once)
   dedpaste keys --gen-key
   ```
   This will create a public/private key pair in `~/.dedpaste/keys/`.

2. **Share Your Public Key** (First-time only):
   ```bash
   # Output your public key to the console
   dedpaste keys --my-key
   
   # Or export your public key to a file
   dedpaste keys --export
   ```
   Send this public key to your friend through a secure channel (Signal, encrypted email, etc.).

3. **Add Your Friend's Public Key** (First-time only):
   ```bash
   # Add your friend's public key
   dedpaste keys --add-friend alice --key-file alice_public.pem
   
   # Or use interactive mode
   dedpaste keys --interactive
   ```

4. **Send an Encrypted Message**:
   ```bash
   # Create an encrypted one-time paste for your friend
   echo "This is a secret message only Alice can read!" | dedpaste send --encrypt --for alice --temp
   
   # Or use interactive mode
   dedpaste send --interactive --encrypt
   ```

5. **Share the Link**:
   Send the generated link (e.g., `https://paste.d3d.dev/e/AbCdEfGh`) to your friend through any channel.

### For the Recipient (Your Friend)

1. **Set Up (First-time only)**:
   ```bash
   # Install DedPaste
   npm install -g dedpaste
   
   # Generate your own key pair
   dedpaste keys --gen-key
   
   # Add your friend's public key
   dedpaste keys --add-friend sender --key-file sender_public.pem
   ```

2. **Read an Encrypted Message**:
   ```bash
   # Decrypt and read the message
   dedpaste get https://paste.d3d.dev/e/AbCdEfGh
   ```
   The message will be decrypted automatically if it was encrypted for you. If it's a one-time paste, it will be deleted from the server after viewing.

3. **Send a Reply**:
   ```bash
   # Create an encrypted reply
   echo "Here's my secret reply!" | dedpaste send --encrypt --for sender --temp
   ```
   Send the generated link back to your friend.

### Security Tips

1. **Use One-Time Pastes**: Always use the `--temp` flag for sensitive information to ensure the message is deleted after reading.

2. **Key Management**: Keep your private key secure and never share it with anyone.

3. **Verify Keys**: When first exchanging public keys, verify them through a separate secure channel if possible.

4. **Self-Destruct Messages**: For extremely sensitive information, consider adding instructions for the recipient to delete the message after reading.

5. **Key Fingerprints**: Use key fingerprints to verify the authenticity of keys:
   ```bash
   # View key fingerprints
   dedpaste keys --list
   ```

## Advanced CLI Usage

### Error Handling

The DedPaste CLI provides detailed error messages to help troubleshoot issues:

```bash
# Common error messages and solutions:

# "No personal key found. Generate one with --gen-key first."
# Solution: Run the following command to generate your key pair
dedpaste keys --gen-key

# "Friend 'name' not found in key database"
# Solution: Add the friend's key first
dedpaste keys --add-friend name --key-file path/to/key.pem

# "This paste was encrypted for X, not for you"
# Solution: Only the intended recipient can decrypt the message

# "Invalid paste URL format"
# Solution: Ensure the URL follows the format https://paste.d3d.dev/{id} or https://paste.d3d.dev/e/{id}
```

### Environment Variables

DedPaste supports the following environment variables:

```bash
# Set the API URL (default is https://paste.d3d.dev)
export DEDPASTE_API_URL="https://your-worker.example.com"

# Set a custom key directory (advanced usage)
export DEDPASTE_KEY_DIR="/path/to/custom/keys"

# Set a custom friends directory (advanced usage)
export DEDPASTE_FRIENDS_DIR="/path/to/custom/friends"
```

### Piping and Redirection

DedPaste works well with Unix pipes and redirection:

```bash
# Pipe content to create a paste and save the URL to a file
echo "Content" | dedpaste --output > paste_url.txt

# Pipe content through multiple commands
cat file.txt | grep "important" | dedpaste --temp

# Redirect paste output to a file
dedpaste get AbCdEfGh > downloaded_content.txt

# Decrypt and process in one line
dedpaste get https://paste.d3d.dev/e/AbCdEfGh | grep "secret" > filtered_secrets.txt
```

### PGP and Keybase Integration Usage

```bash
# Combine PGP key retrieval and encryption in one workflow
dedpaste keys --pgp-key user@example.com && \
echo "Secret data" | dedpaste send --encrypt --for user@example.com

# Automate Keybase key retrieval and encryption
dedpaste keys --keybase username && \
echo "Secret data" | dedpaste send --encrypt --for keybase:username

# Use PGP keys with one-time pastes
dedpaste keys --pgp-key 0x1234ABCD && \
echo "Self-destructing message" | dedpaste send --encrypt --for 0x1234ABCD --temp

# Verify a Keybase user and then add their key
curl -s https://keybase.io/username | grep "identity" && \
dedpaste keys --keybase username
```

### Scripting Examples

DedPaste can be easily integrated into scripts:

```bash
#!/bin/bash
# Example: Backup script that encrypts and uploads data

# Create a temporary backup
tar -czf /tmp/backup.tar.gz /path/to/important/data

# Upload and encrypt the backup
URL=$(dedpaste --file /tmp/backup.tar.gz --encrypt --output)

# Save the URL for later reference
echo "Backup created at: $URL" >> backup_log.txt

# Clean up
rm /tmp/backup.tar.gz
```

## Security Considerations

- DedPaste doesn't implement authentication out of the box. Anyone with your worker URL can create pastes.
- Consider adding authentication if you're using it in a sensitive environment.
- The data is stored in Cloudflare R2, which provides encryption at rest.
- One-time pastes are designed to be viewed only once but depend on proper client behavior.
- For maximum security, use the encryption features for sensitive content.
- Regularly update your key pairs for enhanced security.
- Consider using a password manager to securely store your private key backup.

## Contributing

### Releases and Versioning

DedPaste uses fully automated releases with automatic version bumping:

1. **Automated Version Bumping**:
   - When a PR is merged to `main`, the version is automatically incremented
   - The PR label determines the type of version bump:
     - `major`: Breaking changes (1.0.0 → 2.0.0)
     - `minor`: New features (1.0.0 → 1.1.0)
     - No label or any other label: Bug fixes (1.0.0 → 1.0.1)

2. **Automated Release Flow**:
   - After a merge, GitHub Actions will:
     - Bump the version in package.json based on PR labels
     - Run tests and build the package
     - Create a GitHub release with the new version
     - Publish the package to npm automatically

3. **Creating a Release**:
   ```bash
   # 1. Create a feature branch
   git checkout -b feature/my-improvement
   
   # 2. Make your changes
   # ... edit files ...
   
   # 3. Commit and push
   git add .
   git commit -m "Add my improvement"
   git push origin feature/my-improvement
   
   # 4. Create a PR on GitHub and add the appropriate label
   # 5. When merged, version will be bumped and release created automatically
   ```

4. **Manual Versioning (Optional)**:
   - If needed, you can manually update the version in package.json
   - The release workflow will respect your manually set version

For detailed information about the release process, see [RELEASE-PROCESS.md](./RELEASE-PROCESS.md).

## License

ISC