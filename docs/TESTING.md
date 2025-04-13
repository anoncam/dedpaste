# Testing the Encryption Implementation in Development

This guide provides instructions for testing the end-to-end encryption features in a development environment.

## Navigation

- [Documentation Home](README.md)
- [Main README](../README.md)
- [Contributing Guide](CONTRIBUTING.md)
- [Release Process](RELEASE-PROCESS.md)
- [Troubleshooting Guide](troubleshooting.md)
- [Encryption Implementation Plan](encryption-implementation-plan.md)
- [Encryption Implementation Summary](encryption-implementation-summary.md)
- [Shell Completion](completion/README.md)

## Prerequisites

1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/anoncam/dedpaste.git
   cd dedpaste
   npm install
   ```

## Testing the CLI Locally

There are two main approaches to test the CLI locally:

### Option 1: Using npm link (Recommended)

This creates a symlink to your local development version:

```bash
# From the project root directory
npm link

# Now you can use the 'dedpaste' command globally
dedpaste --help
```

### Option 2: Running the CLI directly

If you don't want to link it globally, you can run it directly:

```bash
# From the project root directory
node ./cli/index.js --help

# For encryption testing
echo "test data" | node ./cli/index.js --encrypt --gen-key
```

### Option 3: Using npx

```bash
# From the project root directory
npx . --help

# For encryption testing
echo "test data" | npx . --encrypt --gen-key
```

## Testing the Server

1. Start the development server:
   ```bash
   npm run dev
   ```

   This will start the Cloudflare Worker in development mode using Wrangler.

2. Note the local development URL (typically `http://localhost:8787`).

## Testing the CLI with Encryption

### 1. Set the API URL to your local development server

```bash
export DEDPASTE_API_URL="http://localhost:8787"
```

### 2. Test generating a new key pair

```bash
echo "secret data" | dedpaste --encrypt --gen-key
```

This should:
- Generate a new key pair in `~/.dedpaste/keys/`
- Encrypt the content
- Upload it to your local server
- Return a URL with the `/e/` prefix

### 3. Test using the default key (no key file specified)

```bash
# This will use an existing key in ~/.dedpaste/keys/public.pem if it exists,
# or generate a new key pair if it doesn't
echo "secret data" | dedpaste --encrypt
```

This should:
- Use the existing key pair or generate a new one (without prompting when stdin is piped)
- Encrypt the content
- Upload it to your local server
- Return a URL with the `/e/` prefix

#### Testing Interactive vs. Piped Input

The CLI now detects whether stdin is a TTY (interactive terminal) or being piped:

1. **Piped input (non-interactive)**: When using a pipe like `echo "data" | dedpaste --encrypt`, the CLI will:
   - Automatically use existing keys without prompting
   - Automatically generate new keys if needed without prompting
   - Display informative messages about the automatic decisions

2. **Interactive input**: When running directly without piping stdin, the CLI will:
   ```bash
   # Run in interactive mode
   dedpaste --encrypt
   # Then type your content and press Ctrl+D when done
   ```
   - Prompt for confirmation before overwriting existing keys
   - Prompt for confirmation before generating new keys for SSH format
   - Wait for user input at each prompt

### 4. Test using an existing key

```bash
echo "more secret data" | dedpaste --encrypt --key-file ~/.dedpaste/keys/public.pem
```

### 5. Test SSH key handling

Create a test SSH key if you don't have one:
```bash
ssh-keygen -t rsa -f ~/.ssh/test_rsa -N ""
```

Then try to use it for encryption:
```bash
echo "ssh key test" | dedpaste --encrypt --key-file ~/.ssh/test_rsa.pub
```

You should see:
- A message indicating SSH keys are not directly supported
- A prompt asking if you want to generate a new key pair
- After answering 'y', a new key pair should be generated and used

#### Testing the Fixed SSH Key Handling

To specifically test the fixed SSH key handling functionality:

1. Make sure you have an SSH key:
   ```bash
   # Check if you have an existing SSH key
   ls -la ~/.ssh/id_rsa.pub
   
   # If not, create one
   ssh-keygen -t rsa -f ~/.ssh/id_rsa -N ""
   ```

2. Test with piped input (non-interactive mode):
   ```bash
   echo "testing ssh key handling" | node ./cli/index.js --encrypt --key-file ~/.ssh/id_rsa.pub
   ```
   
   Verify that:
   - The CLI correctly identifies the SSH key format
   - It automatically generates a new key pair without prompting
   - It displays informative messages about the automatic decisions

3. Test in interactive mode:
   ```bash
   # Run without piping stdin
   node ./cli/index.js --encrypt --key-file ~/.ssh/id_rsa.pub
   # Then type your content and press Ctrl+D when done
   ```
   
   Verify that:
   - The CLI correctly identifies the SSH key format
   - It displays a prompt asking if you want to generate a new key pair
   - It waits for your input (y/n) before proceeding
   - If you answer 'y', it generates a new key pair and uses it
   - If you answer 'n', it exits with an error message

4. Test with a PEM format key to ensure it works correctly:
   ```bash
   # First generate a key pair
   node ./cli/index.js --encrypt --gen-key
   
   # Then use the generated public key
   echo "testing pem key" | node ./cli/index.js --encrypt --key-file ~/.dedpaste/keys/public.pem
   ```

### 6. Test retrieving and decrypting content

```bash
dedpaste get http://localhost:8787/e/{paste-id}
```

Replace `{paste-id}` with the ID from a previous encrypted paste. You should be prompted for the private key location if not specified.

### 7. Test with the wrong key

Generate another key pair:
```bash
mkdir -p ~/test-keys
ssh-keygen -t rsa -f ~/test-keys/wrong_key -N ""
```

Try to decrypt with the wrong key:
```bash
dedpaste get http://localhost:8787/e/{paste-id} --key-file ~/test-keys/wrong_key
```

This should fail with a decryption error.

## Running the Unit Tests

Run the encryption unit tests:

```bash
npm test
```

This will run the Mocha tests in the `test` directory, including the encryption tests.

## Manual Testing Checklist

- [ ] Generate new key pair
- [ ] Encrypt content with generated key
- [ ] Decrypt content with corresponding private key
- [ ] Test SSH key detection and handling
- [ ] Test one-time encrypted pastes
- [ ] Test error handling (wrong key, invalid format, etc.)
- [ ] Verify the server never sees unencrypted content

## Troubleshooting

### Key Format Issues

If you encounter key format issues:
- Ensure you're using PEM format keys
- Check that the public key starts with `-----BEGIN PUBLIC KEY-----`
- Check that the private key starts with `-----BEGIN PRIVATE KEY-----`

### Server Connection Issues

If you can't connect to the development server:
- Verify the server is running (`npm run dev`)
- Check the DEDPASTE_API_URL environment variable
- Try using the full URL in commands

### Encryption/Decryption Errors

If you encounter encryption or decryption errors:
- Check that you're using the correct key pair
- Verify the content format (especially for binary data)
- Check the console for specific error messages

### SSH Key Handling Issues

If the SSH key handling prompt doesn't wait for input:
- Try running the CLI directly without piping: `node ./cli/index.js --encrypt --key-file ~/.ssh/id_rsa.pub`
- Make sure you're not redirecting both stdin and stdout
- Try running in interactive mode: `node -i ./cli/index.js --encrypt --key-file ~/.ssh/id_rsa.pub`
- Check that the terminal is properly handling interactive prompts

## Debugging the CLI

If you need to debug the CLI code:

### Using Node.js Debugger

1. You can use the Node.js debugger to step through the CLI code:
   ```bash
   node --inspect-brk ./cli/index.js --encrypt --key-file ~/.ssh/id_rsa.pub
   ```

2. Then connect to the debugger using Chrome DevTools:
   - Open Chrome
   - Navigate to `chrome://inspect`
   - Click on "Open dedicated DevTools for Node"
   - Click on the target to connect

### Using Console Logs

You can add temporary console logs to the CLI code to trace execution:

```javascript
// Add to cli/index.js in the convertSshToPem function
console.log('Starting SSH key conversion');
console.log('Before prompt');
const answers = await inquirer.prompt([...]);
console.log('After prompt, answer:', answers.generateNew);
```

### Testing Without Server

To test just the SSH key handling without a server:

```bash
# Temporarily modify the CLI to skip the upload
# Add this before the fetch call in cli/index.js:
console.log('Would upload to:', `${API_URL}${endpoint}`);
console.log('Content type:', contentType);
console.log('Encrypted:', options.encrypt);
process.exit(0); // Exit before actually uploading
```