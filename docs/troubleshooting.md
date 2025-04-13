# Troubleshooting Guide

This guide provides solutions for common issues encountered when using DedPaste.

## Navigation

- [Documentation Home](README.md)
- [Main README](../README.md)
- [Contributing Guide](CONTRIBUTING.md)
- [Release Process](RELEASE-PROCESS.md)
- [Testing Guide](TESTING.md)
- [Encryption Implementation Plan](encryption-implementation-plan.md)
- [Encryption Implementation Summary](encryption-implementation-summary.md)
- [Shell Completion](completion/README.md)

## Common Errors and Solutions

### PGP Encryption Issues

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

- **Error**: `Invalid PGP key format`
  **Solution**: Ensure you're using a properly formatted PGP key. Try:
  ```bash
  dedpaste keys --pgp-key user@example.com --debug
  ```

### Key Management Issues

- **Error**: `No personal key found. Generate one with --gen-key first.`
  **Solution**: Run the command to generate your key pair:
  ```bash
  dedpaste keys --gen-key
  ```

- **Error**: `Friend 'name' not found in key database`
  **Solution**: Add the friend's key first:
  ```bash
  dedpaste keys --add-friend name --key-file path/to/key.pem
  ```

- **Error**: `This paste was encrypted for X, not for you`
  **Solution**: Only the intended recipient can decrypt the message

### CLI Parameter Issues

- **Error**: `File not found` when using `--file`
  **Solution**: Double-check the file path and ensure it exists. For paths with spaces, use quotes:
  ```bash
  dedpaste --file "path/to/my file.txt"
  ```

- **Error**: `--for is required when using --pgp`
  **Solution**: PGP encryption always requires a recipient:
  ```bash
  dedpaste send --encrypt --for recipient@example.com --pgp
  ```

## Debugging Tips

- Use `--debug` flag to see more detailed information:
  ```bash
  dedpaste send --encrypt --for alice --debug
  ```

- Check key database status:
  ```bash
  dedpaste keys --list
  ```

- Verify GPG keyring integration:
  ```bash
  dedpaste keys --list-gpg
  ```

## Advanced Troubleshooting

For issues not covered here, please open an issue on the GitHub repository with the following information:

1. The exact command you're running
2. The full error message (use `--debug` flag)
3. Your operating system and Node.js version
4. Any relevant configuration details