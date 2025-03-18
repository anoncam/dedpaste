# CLAUDE.md - Guidelines for Working in this Repository

## Build & Test Commands
- **Development**: `npm run dev` - Run local development server with Tailwind watch
- **Deploy**: `npm run deploy` - Deploy to Cloudflare Workers
- **Build**: `npm run build` - Build TypeScript files and Tailwind CSS
- **Build Tailwind**: `npm run build:tailwind` - Build and minify Tailwind CSS
- **Watch Tailwind**: `npm run watch:tailwind` - Watch for Tailwind CSS changes
- **Format**: `npm run format` - Format code with Prettier
- **Lint**: `npm run lint` - Lint code with ESLint
- **Test**: `npm test` - Run tests with Mocha
- **Install CLI**: `npm link` - Install CLI for local development

## Code Style Guidelines
- **Formatting**: Use 2-space indentation (spaces, not tabs)
- **Naming**:
  - camelCase for variables, functions, methods
  - PascalCase for classes, interfaces, types, enums
  - UPPER_SNAKE_CASE for constants
- **Imports**: Group imports by external libraries, then internal modules
- **Error Handling**: Use try/catch blocks with appropriate error messages
- **Types**: Use TypeScript types everywhere, avoid `any` type when possible
- **Documentation**: Add JSDoc comments for functions and complex logic

## Project Structure
- `src/` - TypeScript source code for the Cloudflare Worker
- `cli/` - Command line interface implementation
  - `encryptionUtils.js` - Encryption utilities
  - `enhancedInteractiveMode.js` - Enhanced CLI interactive mode
  - `index.js` - Main CLI entry point
  - `interactiveMode.js` - Basic interactive mode
  - `keyDiagnostics.js` - Key diagnostics utilities
  - `keyManager.js` - Key management functions
  - `keybaseUtils.js` - Keybase integration
  - `logger.js` - Logging utilities
  - `pgpUtils.js` - PGP encryption/decryption utilities
  - `unifiedKeyManager.js` - Unified key management
- `completion/` - Shell completion scripts (bash, zsh)
- `public/` - Public assets (CSS)
- `test/` - Test files
  - `encryption.test.js` - Tests for basic encryption functionality
  - `friend-encryption.test.js` - Tests for friend-to-friend encryption
  - `pgp-decryption.test.js` - Tests for PGP decryption
  - `gpg-integration.test.js` - Tests for GPG integration
- `wrangler.toml` - Cloudflare Workers configuration

## Features
- Standard encryption using RSA for key exchange and AES-256-GCM for content encryption
- PGP encryption/decryption with OpenPGP standard
- GPG keyring integration
- Keybase user integration
- One-time, self-destructing encrypted pastes
- Enhanced interactive CLI mode for key management